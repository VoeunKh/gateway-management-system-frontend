import { Link } from 'wouter-preact';
import type { Schemas } from '@/api/endpoints';
import { Can } from '@/auth/guards';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Button, Card, ErrorState, SeverityBadge, Skeleton } from '@/ui';
import { PREVIEW_LIMIT, useAckAlert, useOpenAlerts } from './useOverview';

type Alert = Schemas['Alert'];

function AlertRow({ alert, ack }: { alert: Alert; ack: ReturnType<typeof useAckAlert> }) {
  const busy = ack.isPending && ack.variables?.id === alert.id;
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
            loading={busy}
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

/** The newest open alerts, with a way to acknowledge them. */
export function AlertsPreview({ count }: { count: number }) {
  const alerts = useOpenAlerts(count);
  const ack = useAckAlert();
  const shown = alerts.data?.slice(0, PREVIEW_LIMIT) ?? [];
  return (
    <Card title="Open alerts" aside={<Link href="/alerts">All alerts</Link>}>
      {count > 0 && alerts.isPending ? (
        <Skeleton lines={3} label="Loading alerts" />
      ) : alerts.isError ? (
        <ErrorState message={alerts.error.message} onRetry={() => void alerts.refetch()} />
      ) : count === 0 || shown.length === 0 ? (
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
