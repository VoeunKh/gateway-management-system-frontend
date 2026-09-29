import { Link } from 'wouter-preact';
import type { Schemas } from '@/api/endpoints';
import { formatCount } from '@/lib/format';
import { Card, ErrorState, RolloutStateBadge, Skeleton } from '@/ui';
import { useActiveRollouts } from './useOverview';

type Rollout = Schemas['Rollout'];

export function rolloutProgress(rollout: Rollout) {
  const total = Object.values(rollout.counters).reduce((sum, n) => sum + n, 0);
  return { done: rollout.counters.updated, total };
}

function RolloutRow({ rollout }: { rollout: Rollout }) {
  const { done, total } = rolloutProgress(rollout);
  const pct = total ? (done / total) * 100 : 0;
  return (
    <li class="mini-rollout">
      <div class="mini-rollout__head">
        <Link href="/firmware" class="mono">
          {rollout.id}
        </Link>
        <span>
          {rollout.model_id} to <span class="mono">{rollout.fw_version}</span>
        </span>
        <RolloutStateBadge state={rollout.state} />
      </div>
      <div
        class="progress"
        role="progressbar"
        aria-label={`${rollout.id} progress`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span class="progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <p class="mini-rollout__meta">
        {formatCount(done)} of {formatCount(total)} updated
        {rollout.pause_reason && <> · {rollout.pause_reason}</>}
      </p>
    </li>
  );
}

/** Active rollouts at a glance; nothing at all when none is running. */
export function RolloutMini({ count }: { count: number }) {
  const rollouts = useActiveRollouts(count);
  if (count === 0 || rollouts.data?.length === 0) return null;
  return (
    <Card title="Active rollouts" aside={<Link href="/firmware">Firmware</Link>}>
      {rollouts.isPending ? (
        <Skeleton lines={2} label="Loading rollouts" />
      ) : rollouts.isError ? (
        <ErrorState message={rollouts.error.message} onRetry={() => void rollouts.refetch()} />
      ) : (
        <ul class="mini-rollouts">
          {rollouts.data.map((rollout) => (
            <RolloutRow key={rollout.id} rollout={rollout} />
          ))}
        </ul>
      )}
    </Card>
  );
}
