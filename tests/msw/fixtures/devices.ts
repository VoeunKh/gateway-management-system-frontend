import type { components } from '@/api/types.gen';
import { MODELS, SITES } from './catalog';
import { hex, minutesAgo, seeded } from './random';

type S = components['schemas'];

export const DEVICE_COUNT = 300;

export const PACKAGES = ['base-files', 'gw-agent', 'luci', 'modemmanager'];

/** The spec's health rule: offline, then critical, then warning, else healthy. */
export function computeHealth(online: boolean, m: S['LastMetrics'] | null): S['Health'] {
  if (!online) return 'offline';
  if (!m) return 'healthy';
  if ((m.temp_c ?? 0) >= 80 || (m.mem_pct ?? 0) >= 90) return 'critical';
  const lowTmp = m.tmp_free_kb !== null && m.tmp_free_kb !== undefined && m.tmp_free_kb < 8192;
  if ((m.temp_c ?? 0) >= 72 || (m.mem_pct ?? 0) >= 80 || lowTmp) return 'warning';
  return 'healthy';
}

/** What firmware `fw` installs for a package (manifest view). */
export const expectedVersion = (pkg: string, fw: string) => `${fw}-r${pkg.length % 3}`;

function packagesFor(fw: string, drifted: boolean): S['PackageStatus'][] {
  return PACKAGES.map((name, i) => {
    const expected = expectedVersion(name, fw);
    const version = drifted && i === 1 ? `${fw}-r9` : expected;
    return { name, version, expected, status: version === expected ? 'ok' : 'drift' };
  });
}

export function buildDevices(targets: Map<string, number | null>): S['DeviceDetail'][] {
  const rand = seeded(20261020);
  const devices: S['DeviceDetail'][] = [];

  for (let i = 0; i < DEVICE_COUNT; i++) {
    const { model, firmware } = MODELS[i % MODELS.length] ?? rand.pick(MODELS);
    const sn = `${model.id}-${String(Math.floor(i / MODELS.length) + 1).padStart(4, '0')}`;
    const site = i % 23 === 0 ? null : rand.pick(SITES);
    const lifecycle =
      i === 17 || i === 144 ? 'bricked' : i % 97 === 5 ? 'decommissioned' : 'active';
    const online = lifecycle === 'active' && rand.next() > 0.1;
    const reported = i % 41 !== 3;
    const fw = rand.pick(firmware);
    const target = targets.get(model.id) ?? null;
    const cfg = target === null ? null : rand.next() > 0.85 ? Math.max(1, target - 1) : target;
    const hot = rand.next();
    const metrics: S['LastMetrics'] | null = reported
      ? {
          time: minutesAgo(online ? rand.int(0, 2) : rand.int(60, 4000)),
          cpu_pct: rand.int(2, 95),
          mem_pct: hot > 0.97 ? 92 : hot > 0.92 ? 83 : rand.int(20, 70),
          temp_c: hot > 0.95 ? 81 : hot > 0.9 ? 74 : rand.int(38, 65),
          tmp_free_kb: rand.int(6000, 60000),
          signal_dbm: i % 11 === 0 ? null : -rand.int(60, 105),
          rx_bytes: rand.int(1e6, 9e9),
          tx_bytes: rand.int(1e6, 4e9),
        }
      : null;
    const packageDrift = rand.next() > 0.9;
    const knownManifest = fw !== '2.0.4';

    devices.push({
      sn,
      model_id: model.id,
      model_name: model.name,
      site_id: site?.id ?? null,
      site_name: site?.name ?? '',
      lifecycle,
      hw_rev: rand.pick(['A1', 'A2', 'B1']),
      online,
      last_seen: reported ? minutesAgo(online ? rand.int(0, 2) : rand.int(60, 4000)) : null,
      fw_version: fw,
      cfg_version: cfg,
      cfg_hash: hex(rand.next, 64),
      target_cfg_version: target,
      drift: target !== null && cfg !== target,
      health: computeHealth(online, metrics),
      package_drift: !knownManifest ? 'unknown' : packageDrift ? 'drift' : 'ok',
      created_at: minutesAgo(rand.int(10, 400) * 24 * 60),
      interfaces: [
        {
          type: 'mac',
          identifier: hex(rand.next, 12)
            .toUpperCase()
            .replace(/(..)(?!$)/g, '$1:'),
        },
        { type: 'imei', identifier: `35${String(rand.int(0, 1e12)).padStart(13, '0')}` },
        { type: 'iccid', identifier: `8944${String(rand.int(0, 1e14)).padStart(15, '0')}` },
      ],
      last_metrics: metrics,
      packages: knownManifest ? packagesFor(fw, packageDrift) : [],
    });
  }
  return devices.sort((a, b) => a.sn.localeCompare(b.sn));
}

/** The list endpoint returns Device, not DeviceDetail. */
export function toListItem(device: S['DeviceDetail']): S['Device'] {
  const { created_at, interfaces, last_metrics, packages, ...item } = device;
  return item;
}
