import { formatCount } from '@/lib/format';
import { Badge, Skeleton } from '@/ui';
import { useModelFleet } from './useConfig';

/** "Target v3 · 52 in sync · 8 drifted · 1 not reported" for the selected model. */
export function FleetSummary({ modelId }: { modelId: string }) {
  const fleet = useModelFleet(modelId);
  if (fleet.isPending) return <Skeleton lines={1} label="Loading fleet summary" />;
  if (fleet.isError) return <p class="muted">Gateway counts are unavailable right now.</p>;
  const { target, total, inSync, drifted, notReported } = fleet.data;
  return (
    <p class="fleet-summary" aria-label="Fleet summary">
      <span>
        Target <strong>{target === null ? 'nothing pushed yet' : `v${target}`}</strong>
      </span>
      <span>{formatCount(total)} gateways</span>
      <Badge tone="ok">{`${formatCount(inSync)} in sync`}</Badge>
      <Badge tone={drifted ? 'warn' : 'neutral'}>{`${formatCount(drifted)} drifted`}</Badge>
      {notReported > 0 && (
        <Badge tone="neutral">{`${formatCount(notReported)} not reported`}</Badge>
      )}
    </p>
  );
}
