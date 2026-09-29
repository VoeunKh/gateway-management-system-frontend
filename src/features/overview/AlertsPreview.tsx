import { Link } from 'wouter-preact';
import type { Schemas } from '@/api/endpoints';
import { useAckAlert, useOpenAlerts } from '@/api/useAlerts';
import { Can } from '@/auth/guards';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Button, Card, ErrorState, SeverityBadge, Skeleton } from '@/ui';

type Alert = Schemas['Alert'];

export const PREVIEW_LIMIT = 5;

function AlertRow({ alert, ack }: { alert: Alert; ack: ReturnType<typeof useAckAlert> }) {
  return (
    <li class="alert-row">
      <SeverityBadge severity={alert.severity} />
      <div class="alert-row__body">
        <Link href={`/devices/${encodeURIComponent(alert.sn)}`} class="mono">
          {alert.sn}
        </Link>
        <span>{alert.message}</span>
        <time class="muted" dateTime={alert.opened_at} title={formatDateTime(alert.opened_at)}>
          {formatRelative(alert.opened_at)}
        </time>
      </div>
      {alert.acked_at ? (
        <span class="muted alert-row__ack">Acknowledged by {alert.acked_by ?? 'someone'}</span>
      ) : (
        <Can perm="ackAlert">
          <Button
            size="sm"
            aria-label={`Acknowledge alert on ${alert.sn}`}
            onClick={() => ack.mutate(alert)}
          >
            Acknowledge
          </Button>
        </Can>
      )}
    </li>
  );
}

/** The newest open alerts, from the same query as the rail badge and the Alerts page. */
export function AlertsPreview() {
  const alerts = useOpenAlerts();
  const ack = useAckAlert();
  const shown = alerts.data?.slice(0, PREVIEW_LIMIT) ?? [];
  return (
    <Card title="Open alerts" aside={<Link href="/alerts">All alerts</Link>}>
      {alerts.isPending ? (
        <Skeleton lines={3} label="Loading alerts" />
      ) : alerts.isError ? (
        <ErrorState message={alerts.error.message} onRetry={() => void alerts.refetch()} />
      ) : shown.length === 0 ? (
        <p class="muted">No open alerts.</p>
      ) : (
        <ul class="alert-rows">
          {shown.map((alert) => (
            <AlertRow key={alert.id} alert={alert} ack={ack} />
          ))}
        </ul>
      )}
    </Card>
  );
}
