import type { Schemas } from '@/api/endpoints';
import { summarize, toRows } from './rows';

const fleet: Schemas['FleetPackages'] = {
  model_id: 'GW300',
  packages: [
    {
      name: 'gw-agent',
      expected: [{ fw_version: '2.1.0', version: '0.9.2' }],
      installed: [
        { fw_version: '2.1.0', version: '0.9.2', devices: 30, status: 'ok' },
        { fw_version: '2.1.0', version: '0.9.1', devices: 4, status: 'drift' },
        { fw_version: '2.0.4', version: '0.8.0', devices: 9, status: 'unknown' },
      ],
    },
    {
      name: 'base-files',
      expected: [],
      installed: [{ fw_version: '2.1.0', version: '1711', devices: 2, status: 'not_in_manifest' }],
    },
  ],
};

describe('toRows', () => {
  it('groups by package name, drifted rows first inside a package', () => {
    const rows = toRows(fleet);
    expect(rows.map((r) => `${r.name} ${r.installed} ${r.status}`)).toEqual([
      'base-files 1711 not_in_manifest',
      'gw-agent 0.9.1 drift',
      'gw-agent 0.8.0 unknown',
      'gw-agent 0.9.2 ok',
    ]);
  });

  it('looks up what each firmware ships, and leaves it null when unlisted', () => {
    const rows = toRows(fleet);
    expect(rows.find((r) => r.installed === '0.9.1')?.expected).toBe('0.9.2');
    expect(rows.find((r) => r.installed === '0.8.0')?.expected).toBeNull();
    expect(rows.find((r) => r.name === 'base-files')?.expected).toBeNull();
  });
});

describe('summarize', () => {
  it('counts packages and installs by status', () => {
    expect(summarize(toRows(fleet))).toEqual({
      packages: 2,
      installs: 45,
      matching: 30,
      differing: 4,
    });
  });

  it('is all zero for an empty fleet', () => {
    expect(summarize([])).toEqual({ packages: 0, installs: 0, matching: 0, differing: 0 });
  });
});
