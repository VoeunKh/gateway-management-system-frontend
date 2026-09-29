import { signInAs } from '../../tests/msw/auth';
import { db } from '../../tests/msw/db';
import * as apiCalls from './endpoints';
import { getAccessToken, setAccessToken } from './token';

describe('auth endpoints', () => {
  it('logs in and reports the user', async () => {
    const res = await apiCalls.login({ email: 'admin@gwfleet.test', password: 'admin-pass' });
    expect(res.user.role).toBe('admin');
    expect(res.access_token).toMatch(/^mock-token-/);
  });

  it('reports locked accounts and bad passwords with their codes', async () => {
    await expect(
      apiCalls.login({ email: 'locked@gwfleet.test', password: 'locked-pass' }),
    ).rejects.toMatchObject({ status: 401, code: 'account_locked' });
    await expect(
      apiCalls.login({ email: 'admin@gwfleet.test', password: 'nope' }),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
  });

  it('bootstraps /auth/me after a reload by refreshing from the cookie', async () => {
    signInAs('viewer');
    // A reload loses the in-memory token; the refresh cookie survives.
    setAccessToken(null);
    await expect(apiCalls.getMe()).resolves.toMatchObject({ role: 'viewer' });
    expect(getAccessToken()).toMatch(/^mock-token-/);
  });

  it('logs out', async () => {
    signInAs('viewer');
    await expect(apiCalls.logout()).resolves.toBeUndefined();
    expect(db.refreshUserId).toBeNull();
  });
});

describe('users endpoints', () => {
  it('lets an admin list, create, read, update and delete users', async () => {
    signInAs('admin');
    expect(await apiCalls.listUsers()).toHaveLength(4);
    const created = await apiCalls.createUser({
      email: 'new@gwfleet.test',
      name: 'New Person',
      password: 'pw-123456',
      role: 'viewer',
    });
    await expect(apiCalls.getUser(created.id)).resolves.toMatchObject({ name: 'New Person' });
    await expect(apiCalls.updateUser(created.id, { role: 'release' })).resolves.toMatchObject({
      role: 'release',
    });
    await apiCalls.deleteUser(created.id);
    await expect(apiCalls.getUser(created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('forbids a viewer', async () => {
    signInAs('viewer');
    await expect(apiCalls.listUsers()).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });
});

describe('model and site endpoints', () => {
  it('lists, creates and renames', async () => {
    signInAs('admin');
    expect((await apiCalls.listModels()).map((m) => m.id)).toEqual([
      'GW200',
      'GW210',
      'GW300',
      'GW310L',
      'GW400',
    ]);
    await apiCalls.createModel({ id: 'GW500', name: 'GW500' });
    await expect(apiCalls.updateModel('GW500', { name: 'GW500 Wi-Fi 7' })).resolves.toEqual({
      id: 'GW500',
      name: 'GW500 Wi-Fi 7',
    });
    expect(await apiCalls.listSites()).toHaveLength(12);
    const site = await apiCalls.createSite({ name: 'Quay 3', vars: { apn: 'x' } });
    await expect(apiCalls.updateSite(site.id, { name: 'Quay 4', vars: {} })).resolves.toMatchObject(
      { name: 'Quay 4' },
    );
  });
});

describe('config endpoints', () => {
  it('lists newest first, reads, diffs and saves versions', async () => {
    signInAs('release');
    const versions = await apiCalls.listConfigVersions('GW200');
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
    await expect(apiCalls.getConfigVersion('GW200', 2)).resolves.toMatchObject({ version: 2 });
    const diff = await apiCalls.diffConfigVersions('GW200', 2, 1);
    expect(diff).toContainEqual({ op: '+', text: "\toption mtu '1400'" });
    expect(diff).toContainEqual({ op: '-', text: "\toption mtu '1500'" });
    const text = `${versions[0]?.text ?? ''}\n\toption zonename 'UTC'`;
    await expect(
      apiCalls.createConfigVersion('GW200', { text, note: 'Zone name' }),
    ).resolves.toMatchObject({ version: 4 });
  });

  it('names the offending line of invalid UCI', async () => {
    signInAs('release');
    await expect(
      apiCalls.createConfigVersion('GW200', { text: 'package network\nbogus line', note: 'x' }),
    ).rejects.toMatchObject({ status: 422, code: 'config_invalid', details: { line: 2 } });
  });

  it('renders a device config with secrets masked, or lists missing variables', async () => {
    signInAs('viewer');
    const assigned = db.devices.find((d) => d.site_name && d.site_name !== 'Test Lab');
    const rendered = await apiCalls.getRenderedConfig(assigned?.sn ?? '');
    expect(rendered.text).toContain("option apn 'iot.example'");
    expect(rendered.hash).toMatch(/^[0-9a-f]{64}$/);

    const lab = db.devices.find((d) => d.site_name === 'Test Lab' && d.model_id !== 'GW400');
    await expect(apiCalls.getRenderedConfig(lab?.sn ?? '')).rejects.toMatchObject({
      code: 'config_incomplete',
      details: { missing: ['site.apn'] },
    });
  });
});

describe('package endpoints', () => {
  it('summarises fleet packages and records manifests once', async () => {
    signInAs('release');
    const fleet = await apiCalls.getFleetPackages('GW200');
    expect(fleet.packages.map((p) => p.name)).toContain('gw-agent');
    await expect(apiCalls.getFirmwareManifest('GW200', '1.2.0')).resolves.toMatchObject({
      fw_version: '1.2.0',
    });
    await expect(
      apiCalls.recordFirmwareManifest('GW300', '2.0.4', 'base-files - 1\ngw-agent - 0.1.0-r1\n'),
    ).resolves.toEqual({ model_id: 'GW300', fw_version: '2.0.4', packages: 2 });
    await expect(
      apiCalls.recordFirmwareManifest('GW300', '2.0.4', 'base-files - 1'),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('device endpoints', () => {
  it('pages through the whole fleet with the cursor', async () => {
    signInAs('viewer');
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await apiCalls.listDevices({ limit: 200, cursor });
      seen.push(...page.devices.map((d) => d.sn));
      cursor = page.next_cursor;
    } while (cursor);
    expect(seen).toHaveLength(300);
    expect(new Set(seen).size).toBe(300);
  });

  it('filters and rejects malformed filters', async () => {
    signInAs('viewer');
    const offline = await apiCalls.listDevices({ health: 'offline', limit: 200 });
    expect(offline.devices.length).toBeGreaterThan(0);
    expect(offline.devices.every((d) => d.health === 'offline' && !d.online)).toBe(true);
    const gw300 = await apiCalls.listDevices({ model: 'GW300', q: 'GW300-000' });
    expect(gw300.devices.every((d) => d.sn.startsWith('GW300-000'))).toBe(true);
    await expect(apiCalls.listDevices({ site: 'not-a-uuid' })).rejects.toMatchObject({
      status: 422,
      code: 'validation_failed',
    });
  });

  it('reads and updates one device', async () => {
    signInAs('admin');
    const detail = await apiCalls.getDevice('GW200-0001');
    expect(detail.interfaces.map((i) => i.type)).toEqual(['mac', 'imei', 'iccid']);
    await expect(
      apiCalls.updateDevice('GW200-0001', { site_id: null, lifecycle: 'decommissioned' }),
    ).resolves.toMatchObject({ site_id: null, site_name: '', lifecycle: 'decommissioned' });
    await expect(apiCalls.getDevice('NOPE-0000')).rejects.toMatchObject({ status: 404 });
  });
});

describe('overview, rollout and alert endpoints', () => {
  it('counts the fleet by health and firmware', async () => {
    signInAs('viewer');
    const overview = await apiCalls.getOverview();
    const { healthy, warning, critical, offline } = overview.health;
    expect(healthy + warning + critical + offline).toBe(overview.devices);
    const gw200 = overview.models.find((m) => m.model_id === 'GW200');
    expect(gw200?.firmware.reduce((sum, f) => sum + f.devices, 0)).toBe(gw200?.devices);
  });

  it('lists active rollouts without their wave devices', async () => {
    signInAs('viewer');
    const rollouts = await apiCalls.listRollouts({ state: 'active' });
    expect(rollouts.map((r) => r.state).sort()).toEqual(['paused', 'running', 'soaking']);
    expect(rollouts.every((r) => r.waves.every((w) => w.devices === undefined))).toBe(true);
  });

  it('lists open alerts newest first, up to the limit', async () => {
    signInAs('viewer');
    const alerts = await apiCalls.listAlerts({ state: 'open', limit: 3 });
    expect(alerts).toHaveLength(3);
    expect(alerts.every((a) => a.resolved_at === null)).toBe(true);
    expect([...alerts].sort((a, b) => b.opened_at.localeCompare(a.opened_at))).toEqual(alerts);
  });

  it('lets only an admin acknowledge, once', async () => {
    const open = db.alerts.find((a) => a.resolved_at === null && !a.acked_at);
    signInAs('viewer');
    await expect(apiCalls.ackAlert(open?.id ?? '')).rejects.toMatchObject({ status: 403 });
    signInAs('admin');
    await expect(apiCalls.ackAlert(open?.id ?? '')).resolves.toMatchObject({
      acked_by: 'Ada Admin',
    });
    await expect(apiCalls.ackAlert(open?.id ?? '')).rejects.toMatchObject({
      status: 409,
      code: 'already_acknowledged',
    });
  });
});
