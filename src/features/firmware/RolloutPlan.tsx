import type { UseQueryResult } from '@tanstack/react-query';
import type { Schemas } from '@/api/endpoints';
import { formatCount } from '@/lib/format';
import { Skeleton } from '@/ui';

export interface RolloutPlanProps {
  /** False while the form has errors: there is nothing to preview. */
  enabled: boolean;
  preview: UseQueryResult<Schemas['RolloutPreview']>;
  /** The form changed since this plan was asked for; the numbers are the last ones known. */
  stale: boolean;
}

/** "42 of 60 gateways need this version; waves 1, 5, 21, 42; 3 offline will be deferred". */
export function RolloutPlan({ enabled, preview, stale }: RolloutPlanProps) {
  if (!enabled) return <p class="muted rollout-plan">Fix the fields above to see the plan.</p>;
  if (preview.isError)
    return (
      <p class="rollout-plan rollout-plan--error" role="alert">
        {preview.error.message}
      </p>
    );
  if (!preview.data) return <Skeleton lines={1} label="Working out the plan" />;
  const p = preview.data;
  return (
    <p
      class={stale ? 'rollout-plan rollout-plan--stale' : 'rollout-plan'}
      aria-live="polite"
      aria-busy={stale ? 'true' : undefined}
    >
      <strong>{formatCount(p.need)}</strong> of {formatCount(p.total)} gateways need this version
      {p.need > 0 && <>; waves {p.waves.map(formatCount).join(', ')}</>}
      {p.offline_deferred > 0 && <>; {formatCount(p.offline_deferred)} offline will be deferred</>}
      {p.skipped_low_tmp > 0 && <>; {formatCount(p.skipped_low_tmp)} skipped for low /tmp</>}.
    </p>
  );
}
