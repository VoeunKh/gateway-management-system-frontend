import { Link } from 'wouter-preact';
import type { Schemas } from '@/api/endpoints';
import type { useAckAlert } from '@/api/useAlerts';
import { Can } from '@/auth/guards';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Button, SeverityBadge, Table } from '@/ui';
import type { Column } from '@/ui';

type Alert = Schemas['Alert'];

const when = (iso: string) => (
  <time dateTime={iso} title={formatDateTime(iso)}>
    {formatRelative(iso)}
  </time>
);

const common: Column<Alert>[] = [
  { key: 'severity', header: 'Severity', cell: (a) => <SeverityBadge severity={a.severity} /> },
  {
    key: 'sn',
    header: 'Gateway',
    cell: (a) => (
      <Link href={`/devices/${encodeURIComponent(a.sn)}`} class="mono">
        {a.sn}
      </Link>
    ),
  },
  { key: 'message', header: 'What happened', cell: (a) => a.message },
  { key: 'opened', header: 'Opened', cell: (a) => when(a.opened_at) },
];

export interface OpenAlertsTableProps {
  alerts: Alert[];
  ack: ReturnType<typeof useAckAlert>;
}

/** Open alerts: acknowledging is admin-only, and the row shows who did it. */
export function OpenAlertsTable({ alerts, ack }: OpenAlertsTableProps) {
  return (
    <Table
      caption="Open alerts"
      hideCaption
      stack
      rows={alerts}
      rowKey={(a) => a.id}
      columns={[
        ...common,
        {
          key: 'ack',
          header: 'Acknowledged',
          cell: (a) =>
            a.acked_at ? (
              <span class="muted">By {a.acked_by ?? 'someone'}</span>
            ) : (
              <Can perm="ackAlert">
                <Button
                  size="sm"
                  aria-label={`Acknowledge alert on ${a.sn}`}
                  onClick={() => ack.mutate(a)}
                >
                  Acknowledge
                </Button>
              </Can>
            ),
        },
      ]}
    />
  );
}

/** Resolved alerts close on their own when the condition clears. */
export function ResolvedAlertsTable({ alerts }: { alerts: Alert[] }) {
  return (
    <Table
      caption="Recently resolved alerts"
      hideCaption
      stack
      rows={alerts}
      rowKey={(a) => a.id}
      columns={[
        ...common,
        {
          key: 'resolved',
          header: 'Resolved',
          cell: (a) => (a.resolved_at ? when(a.resolved_at) : null),
        },
      ]}
    />
  );
}
