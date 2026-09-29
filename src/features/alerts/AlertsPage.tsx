import { useState } from 'preact/hooks';
import { POLL_MS } from '@/api/polling';
import { useAckAlert, useOpenAlerts } from '@/api/useAlerts';
import { Button, EmptyState, ErrorState, SeverityBadge, Skeleton, Table } from '@/ui';
import { OpenAlertsTable, ResolvedAlertsTable } from './AlertsTable';
import { useAlertRules, useResolvedAlerts } from './useAlertLists';

/** Open alerts appear this many at a time; the rest are one click away. */
export const PAGE = 25;

function Open() {
  const open = useOpenAlerts(POLL_MS.alerts);
  const ack = useAckAlert();
  const [shown, setShown] = useState(PAGE);
  if (open.isPending) return <Skeleton lines={4} label="Loading alerts" />;
  if (open.isError) {
    return <ErrorState message={open.error.message} onRetry={() => void open.refetch()} />;
  }
  if (open.data.length === 0) {
    return (
      <EmptyState title="No open alerts">
        Everything is quiet. Alerts appear here when a gateway crosses one of the rules below.
      </EmptyState>
    );
  }
  const hidden = open.data.length - shown;
  return (
    <>
      <OpenAlertsTable alerts={open.data.slice(0, shown)} ack={ack} />
      {hidden > 0 && (
        <Button onClick={() => setShown((n) => n + PAGE)}>{`Show more (${hidden} more)`}</Button>
      )}
    </>
  );
}

function Resolved() {
  const resolved = useResolvedAlerts();
  if (resolved.isPending) return <Skeleton lines={2} label="Loading resolved alerts" />;
  if (resolved.isError) {
    return <ErrorState message={resolved.error.message} onRetry={() => void resolved.refetch()} />;
  }
  if (resolved.data.length === 0) return <p class="muted">Nothing has been resolved recently.</p>;
  return <ResolvedAlertsTable alerts={resolved.data} />;
}

function Rules() {
  const rules = useAlertRules();
  if (rules.isPending) return <Skeleton lines={3} label="Loading alert rules" />;
  if (rules.isError) {
    return <ErrorState message={rules.error.message} onRetry={() => void rules.refetch()} />;
  }
  return (
    <>
      <Table
        caption="Alert rules"
        hideCaption
        rows={rules.data}
        rowKey={(rule) => rule.id}
        columns={[
          { key: 'name', header: 'Rule', cell: (rule) => rule.name },
          { key: 'condition', header: 'Fires when', cell: (rule) => rule.condition },
          {
            key: 'severity',
            header: 'Severity',
            cell: (rule) => <SeverityBadge severity={rule.severity} />,
          },
        ]}
      />
      <p class="muted">
        Notifications by email, Telegram or webhook are not set up yet (Telegram is on the to-do
        list). For now, alerts show up here and on the overview.
      </p>
    </>
  );
}

export function AlertsPage() {
  return (
    <section class="page">
      <h1>Alerts</h1>
      <p class="muted">
        Raised from gateway heartbeats and metrics. An alert closes by itself when the condition
        clears.
      </p>
      <h2>Open</h2>
      <Open />
      <h2>Recently resolved</h2>
      <Resolved />
      <h2>Alert rules</h2>
      <Rules />
    </section>
  );
}
