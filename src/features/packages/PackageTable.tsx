import { formatCount } from '@/lib/format';
import { Badge, PackageStatusBadge, Table } from '@/ui';
import type { PackageRow, PackageSummary } from './rows';

/** "3 packages · 210 installs · 190 match their firmware · 12 differ". */
export function PackageSummaryLine({ summary }: { summary: PackageSummary }) {
  return (
    <p class="fleet-summary" aria-label="Package summary">
      <span>{formatCount(summary.packages)} packages</span>
      <span>{formatCount(summary.installs)} installs</span>
      <Badge tone="ok">{`${formatCount(summary.matching)} match their firmware`}</Badge>
      <Badge tone={summary.differing ? 'warn' : 'neutral'}>
        {`${formatCount(summary.differing)} differ`}
      </Badge>
    </p>
  );
}

export function PackageTable({ rows }: { rows: PackageRow[] }) {
  return (
    <Table
      caption="Installed package versions"
      rows={rows}
      rowKey={(row) => row.key}
      columns={[
        { key: 'name', header: 'Package', cell: (row) => <span class="mono">{row.name}</span> },
        {
          key: 'status',
          header: 'Status',
          cell: (row) => <PackageStatusBadge status={row.status} />,
        },
        {
          key: 'firmware',
          header: 'Firmware',
          cell: (row) =>
            row.firmware ? <span class="mono">{row.firmware}</span> : <span class="muted">—</span>,
        },
        { key: 'installed', header: 'Installed', cell: (row) => row.installed },
        {
          key: 'expected',
          header: 'Firmware ships',
          cell: (row) => row.expected ?? <span class="muted">—</span>,
        },
        {
          key: 'devices',
          header: 'Gateways',
          numeric: true,
          cell: (row) => formatCount(row.devices),
        },
      ]}
    />
  );
}
