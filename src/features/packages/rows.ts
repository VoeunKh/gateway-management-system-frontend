import type { Schemas } from '@/api/endpoints';

type Status = Schemas['PackageStatus']['status'];

export interface PackageRow {
  key: string;
  name: string;
  /** Firmware the gateways run; empty when they haven't reported one. */
  firmware: string;
  installed: string;
  /** What that firmware installs; null when its manifest doesn't list the package. */
  expected: string | null;
  devices: number;
  status: Status;
}

export interface PackageSummary {
  packages: number;
  installs: number;
  matching: number;
  differing: number;
}

// Drifted rows come first inside a package: they are the ones to act on.
const ORDER: Record<Status, number> = { drift: 0, not_in_manifest: 1, unknown: 2, ok: 3 };

/** One row per (package, firmware, installed version), grouped by package. */
export function toRows(fleet: Schemas['FleetPackages']): PackageRow[] {
  return [...fleet.packages]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((pkg) =>
      pkg.installed
        .map((row) => ({
          key: `${pkg.name}@${row.fw_version}@${row.version}`,
          name: pkg.name,
          firmware: row.fw_version,
          installed: row.version,
          expected: pkg.expected.find((e) => e.fw_version === row.fw_version)?.version ?? null,
          devices: row.devices,
          status: row.status,
        }))
        .sort(
          (a, b) =>
            ORDER[a.status] - ORDER[b.status] ||
            b.devices - a.devices ||
            a.firmware.localeCompare(b.firmware),
        ),
    );
}

/** "Installs" count one package on one gateway, so a gateway with 4 packages counts 4. */
export function summarize(rows: PackageRow[]): PackageSummary {
  const sum = (keep: (row: PackageRow) => boolean) =>
    rows.filter(keep).reduce((total, row) => total + row.devices, 0);
  return {
    packages: new Set(rows.map((row) => row.name)).size,
    installs: sum(() => true),
    matching: sum((row) => row.status === 'ok'),
    differing: sum((row) => row.status === 'drift'),
  };
}
