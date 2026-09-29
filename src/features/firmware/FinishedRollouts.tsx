import type { Schemas } from '@/api/endpoints';
import { formatCount, formatDateTime } from '@/lib/format';
import { ErrorState, RolloutStateBadge, Skeleton, Table } from '@/ui';
import { useRollouts } from './useRollouts';

const summary = (c: Schemas['RolloutCounters']) =>
  [
    `${formatCount(c.updated)} updated`,
    c.rolled_back + c.needs_recovery > 0 &&
      `${formatCount(c.rolled_back + c.needs_recovery)} failed`,
    c.skipped + c.deferred > 0 && `${formatCount(c.skipped + c.deferred)} skipped or deferred`,
  ]
    .filter(Boolean)
    .join(' · ');

/** Completed and aborted rollouts, one row each. */
export function FinishedRollouts() {
  const finished = useRollouts('finished');
  if (finished.isPending) return <Skeleton lines={2} label="Loading finished rollouts" />;
  if (finished.isError) {
    return <ErrorState message={finished.error.message} onRetry={() => void finished.refetch()} />;
  }
  if (finished.data.length === 0) return <p class="muted">No finished rollouts yet.</p>;
  return (
    <Table
      caption="Finished rollouts"
      hideCaption
      stack
      rows={finished.data}
      rowKey={(r) => r.id}
      columns={[
        { key: 'id', header: 'Rollout', cell: (r) => <span class="mono">{r.id}</span> },
        { key: 'what', header: 'Firmware', cell: (r) => `${r.model_id} to ${r.fw_version}` },
        { key: 'state', header: 'Result', cell: (r) => <RolloutStateBadge state={r.state} /> },
        { key: 'counts', header: 'Outcome', cell: (r) => summary(r.counters) },
        { key: 'when', header: 'Started', cell: (r) => formatDateTime(r.created_at) },
      ]}
    />
  );
}
