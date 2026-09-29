import type { components } from '@/api/types.gen';
import { minutesAgo } from './random';

type S = components['schemas'];

export interface FixtureModel {
  model: S['Model'];
  firmware: string[];
}

export const MODELS: FixtureModel[] = [
  { model: { id: 'GW200', name: 'GW200 LTE Cat 4' }, firmware: ['1.2.0', '1.3.0'] },
  { model: { id: 'GW210', name: 'GW210 LTE Cat 6' }, firmware: ['1.2.0', '1.3.0', '1.3.1'] },
  { model: { id: 'GW300', name: 'GW300 Dual SIM' }, firmware: ['2.0.4', '2.1.0'] },
  { model: { id: 'GW310L', name: 'GW310L Rail' }, firmware: ['2.1.0'] },
  { model: { id: 'GW400', name: 'GW400 5G' }, firmware: ['3.0.0', '3.0.2'] },
];

const SITE_NAMES = [
  'Depot North',
  'Depot South',
  'Harbour East',
  'Harbour West',
  'Airport Cargo',
  'Rail Yard 1',
  'Rail Yard 2',
  'Pump Station A',
  'Pump Station B',
  'Substation 7',
  'Warehouse 12',
  'Test Lab',
];

// Test Lab has no APN, so rendering a config that needs one fails (config_incomplete).
export const SITES: S['Site'][] = SITE_NAMES.map((name, i) => {
  const vars: Record<string, string> = { ntp: 'pool.ntp.org' };
  if (name !== 'Test Lab') vars.apn = 'iot.example';
  return { id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`, name, vars };
});

export interface FixtureUser {
  user: S['User'];
  password: string;
  locked?: boolean;
}

const userId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Test-only credentials for the mock API.
export const USERS: FixtureUser[] = [
  {
    user: { id: userId(1), email: 'admin@gwfleet.test', name: 'Ada Admin', role: 'admin' },
    password: 'admin-pass',
  },
  {
    user: { id: userId(2), email: 'release@gwfleet.test', name: 'Rui Release', role: 'release' },
    password: 'release-pass',
  },
  {
    user: { id: userId(3), email: 'viewer@gwfleet.test', name: 'Vera Viewer', role: 'viewer' },
    password: 'viewer-pass',
  },
  {
    user: { id: userId(4), email: 'locked@gwfleet.test', name: 'Lou Locked', role: 'viewer' },
    password: 'locked-pass',
    locked: true,
  },
];

const configText = (modelId: string, version: number) =>
  [
    `package network`,
    `config interface 'wan'`,
    `\toption proto 'qmi'`,
    `\toption apn '{{site.apn}}'`,
    version >= 2 ? `\toption mtu '1400'` : `\toption mtu '1500'`,
    `package system`,
    `config system`,
    `\toption hostname '{{device.sn}}'`,
    `\toption timezone 'UTC'`,
    ...(version >= 3 ? [`\toption log_size '128'`] : []),
    `\t# ${modelId} baseline v${version}`,
  ].join('\n');

/** Three versions per model, oldest first; GW400 has none pushed yet. */
export function buildConfigVersions(): Map<string, S['ConfigVersion'][]> {
  return new Map(
    MODELS.map(({ model }) => {
      const count = model.id === 'GW400' ? 0 : 3;
      const versions = Array.from({ length: count }, (_, i) => ({
        version: i + 1,
        text: configText(model.id, i + 1),
        note: ['Initial baseline', 'Lower MTU for carrier', 'Bigger log buffer'][i] ?? '',
        created_by: userId(2),
        created_at: minutesAgo((count - i) * 7 * 24 * 60),
      }));
      return [model.id, versions];
    }),
  );
}
