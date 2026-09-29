import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { HttpResponse, http } from 'msw';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { api } from '../../../tests/msw/handlers/api';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

type Detail = (typeof db.devices)[number];

/** A fixture device, optionally reshaped, served at its own SN. */
function device(patch: Partial<Detail> = {}): Detail {
  const base = db.devices.find((d) => d.site_id && d.last_metrics && d.packages.length > 0);
  if (!base) throw new Error('fixture has no complete device');
  Object.assign(base, patch);
  return base;
}

async function openDevice(sn: string) {
  signInAs('viewer');
  const view = renderApp(`/devices/${sn}`);
  await screen.findByRole('heading', { level: 1, name: sn });
  return view;
}

const card = (name: string) => screen.getByRole('region', { name });

describe('DeviceDetailPage', () => {
  it('renders every card from the device', async () => {
    const d = device({ health: 'healthy', lifecycle: 'active' });
    await openDevice(d.sn);
    expect(within(card('Device info')).getByText(d.model_name)).toBeInTheDocument();
    expect(within(card('Health')).getByText('Healthy')).toBeInTheDocument();
    expect(within(card('Hardware interfaces')).getAllByRole('row')).toHaveLength(4);
    expect(within(card('Packages')).getByText('gw-agent')).toBeInTheDocument();
    expect(await within(card('Config')).findByLabelText('Rendered config')).toHaveTextContent(
      "option apn 'iot.example'",
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides rows and cards with nothing to show instead of leaving blanks', async () => {
    const d = device({ packages: [], hw_rev: undefined });
    const metrics = d.last_metrics;
    if (metrics) metrics.signal_dbm = null;
    await openDevice(d.sn);
    expect(screen.queryByRole('region', { name: 'Packages' })).not.toBeInTheDocument();
    expect(within(card('Health')).queryByText('LTE signal')).not.toBeInTheDocument();
    expect(within(card('Device info')).queryByText('Hardware revision')).not.toBeInTheDocument();
    expect(within(card('Health')).getByText('Temperature')).toBeInTheDocument();
  });

  it('says "No data yet" when the gateway has never reported metrics', async () => {
    const d = device({ last_metrics: null });
    await openDevice(d.sn);
    expect(within(card('Health')).getByText(/No data yet/)).toBeInTheDocument();
  });

  it('warns when /tmp has less than 8 MB free', async () => {
    const d = device();
    if (d.last_metrics) d.last_metrics.tmp_free_kb = 6000;
    await openDevice(d.sn);
    expect(within(card('Health')).getByText('Low: under 8 MB')).toBeInTheDocument();
  });

  it.each([
    [{ drift: true, cfg_version: 2, target_cfg_version: 3 }, 'Drift', 'v3', 'v2'],
    [{ drift: false, cfg_version: 3, target_cfg_version: 3 }, 'In sync', 'v3', 'v3'],
  ] as const)('shows %o as "%s"', async (patch, label, desired, reported) => {
    const d = device(patch);
    await openDevice(d.sn);
    const config = card('Config');
    expect(within(config).getByText(label)).toBeInTheDocument();
    const rows = within(config).getAllByRole('definition');
    expect(rows[0]).toHaveTextContent(desired);
    expect(rows[1]).toHaveTextContent(reported);
  });

  it('shows the bricked banner only for bricked gateways', async () => {
    const d = device({ lifecycle: 'bricked' });
    await openDevice(d.sn);
    expect(screen.getByRole('alert')).toHaveTextContent('Needs on-site recovery');
  });

  it('lists missing variables when the config cannot be rendered', async () => {
    const d = device();
    server.use(
      http.get(api('/devices/:sn/config/rendered'), () =>
        HttpResponse.json(
          {
            error: {
              code: 'config_incomplete',
              message: 'config references unset variables',
              details: { missing: ['site.apn', 'site.ntp'] },
            },
          },
          { status: 422 },
        ),
      ),
    );
    await openDevice(d.sn);
    expect(
      await within(card('Config')).findByText('These variables have no value: site.apn, site.ntp.'),
    ).toBeInTheDocument();
  });

  it('says so when the SN does not exist', async () => {
    signInAs('viewer');
    renderApp('/devices/NOPE-0000');
    expect(await screen.findByRole('heading', { name: 'Gateway not found' })).toBeInTheDocument();
  });

  it('goes back to the device list with the filters it came from', async () => {
    signInAs('viewer');
    const { currentPath } = renderApp('/devices?health=offline');
    await screen.findByRole('table', { name: 'Gateways' });
    const first = within(screen.getByRole('table', { name: 'Gateways' })).getAllByRole('link')[0];
    fireEvent.click(first as HTMLElement);
    fireEvent.click(await screen.findByRole('link', { name: '← Back to devices' }));
    await waitFor(() => expect(currentPath()).toBe('/devices?health=offline'));
  });

  it('explains a model with no config pushed yet', async () => {
    const d = device({ drift: false, cfg_version: null, target_cfg_version: null });
    server.use(
      http.get(api('/devices/:sn/config/rendered'), () =>
        HttpResponse.json({ error: { code: 'not_found', message: 'none' } }, { status: 404 }),
      ),
    );
    await openDevice(d.sn);
    const config = card('Config');
    expect(within(config).getByText('Nothing pushed', { selector: '.badge' })).toBeInTheDocument();
    expect(
      await within(config).findByText('No config has been pushed to this model yet.'),
    ).toBeInTheDocument();
  });

  it('marks a gateway that has not reported its config version', async () => {
    const d = device({ cfg_version: null, target_cfg_version: 3, drift: true });
    await openDevice(d.sn);
    expect(
      within(card('Config')).getByText('Not reported', { selector: '.badge' }),
    ).toBeInTheDocument();
  });

  it('notes a decommissioned gateway', async () => {
    const d = device({ lifecycle: 'decommissioned' });
    await openDevice(d.sn);
    const banner = screen.getByText('Decommissioned', { selector: 'strong' }).closest('.notice');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent('no longer expected to report');
    expect(screen.queryByText('Needs on-site recovery')).not.toBeInTheDocument();
  });
});
