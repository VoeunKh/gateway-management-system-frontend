import { Link, useLocation } from 'wouter-preact';
import type { Schemas } from '@/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Badge, HealthBadge, Table } from '@/ui';
import type { Column } from '@/ui';

type Device = Schemas['Device'];

export const deviceHref = (sn: string) => `/devices/${encodeURIComponent(sn)}`;

const COLUMNS: Column<Device>[] = [
  { key: 'status', header: 'Status', cell: (d) => <HealthBadge health={d.health} /> },
  {
    key: 'sn',
    header: 'Serial number',
    cell: (d) => (
      <Link href={deviceHref(d.sn)} class="mono">
        {d.sn}
      </Link>
    ),
  },
  {
    key: 'model',
    header: 'Model',
    cell: (d) => (
      <>
        {d.model_name}
        {d.hw_rev && <span class="muted"> · rev {d.hw_rev}</span>}
      </>
    ),
  },
  {
    key: 'site',
    header: 'Site',
    cell: (d) => d.site_name || <span class="muted">Unassigned</span>,
  },
  { key: 'fw', header: 'Firmware', cell: (d) => d.fw_version ?? <span class="muted">—</span> },
  {
    key: 'config',
    header: 'Config',
    cell: (d) => (
      <span class="cell-inline">
        {d.cfg_version === null || d.cfg_version === undefined ? (
          <span class="muted">—</span>
        ) : (
          `v${d.cfg_version}`
        )}
        {d.drift && (
          <span title={`Target is v${d.target_cfg_version ?? '?'}`}>
            <Badge tone="warn">Drift</Badge>
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'seen',
    header: 'Last seen',
    cell: (d) =>
      d.last_seen ? (
        <time dateTime={d.last_seen} title={formatDateTime(d.last_seen)}>
          {formatRelative(d.last_seen)}
        </time>
      ) : (
        <span class="muted">Never</span>
      ),
  },
];

export function DeviceTable({ devices }: { devices: Device[] }) {
  const [, navigate] = useLocation();
  return (
    <Table
      caption="Gateways"
      hideCaption
      columns={COLUMNS}
      rows={devices}
      rowKey={(d) => d.sn}
      onRowClick={(device, event) => {
        // The serial number link handles its own clicks (and middle-click / new tab).
        if (event.target instanceof Element && event.target.closest('a')) return;
        navigate(deviceHref(device.sn));
      }}
    />
  );
}
