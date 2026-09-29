import type { Schemas } from '@/api/endpoints';
import { formatCount, formatDateTime } from '@/lib/format';
import { Card, ErrorState, Notice, RolloutStateBadge, Skeleton } from '@/ui';
import { RolloutControls } from './RolloutControls';
import { WaveBoard, WaveLegend } from './WaveBoard';
import { isLiveRollout, useRollout } from './useRollouts';

function Counters({ counters }: { counters: Schemas['RolloutCounters'] }) {
  const items = [
    ['Updated', counters.updated],
    ['In progress', counters.in_progress],
    ['Rolled back', counters.rolled_back],
    ['Need on-site recovery', counters.needs_recovery],
    ['Skipped or deferred', counters.skipped + counters.deferred],
    ['Waiting', counters.waiting],
  ] as const;
  return (
    <dl class="counters" aria-label="Rollout counts">
      {items.map(([label, value]) => (
        <div key={label} class="counters__item">
          <dt>{label}</dt>
          <dd>{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A live rollout: state, controls, the wave board and its counts. Polls while it is live. */
export function RolloutCard({ id }: { id: string }) {
  const query = useRollout(id);
  const title = `${id}`;
  if (query.isPending) {
    return (
      <Card title={title}>
        <Skeleton lines={4} label={`Loading ${id}`} />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card title={title}>
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      </Card>
    );
  }
  const r = query.data;
  return (
    <Card
      title={`${r.id}: ${r.model_id} to ${r.fw_version}`}
      aside={<RolloutStateBadge state={r.state} />}
    >
      <p class="muted rollout-meta">
        Started {formatDateTime(r.created_at)} by {r.created_by}
        {r.state === 'soaking' && ' · waiting before the next wave'}
      </p>
      {r.state === 'paused' && (
        <Notice tone="warn" title={r.pause_reason ? 'Paused automatically' : 'Paused'}>
          {r.pause_reason ??
            'Someone paused this rollout. Resume it to continue with the next gateways.'}
        </Notice>
      )}
      {isLiveRollout(r) && <RolloutControls rollout={r} />}
      <WaveBoard rollout={r} />
      <Counters counters={r.counters} />
      <WaveLegend />
    </Card>
  );
}
