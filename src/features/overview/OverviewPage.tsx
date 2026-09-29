import type { Schemas } from '@/api/endpoints';
import { formatCount } from '@/lib/format';
import { EmptyState, ErrorState, Skeleton } from '@/ui';
import { AlertsPreview } from './AlertsPreview';
import { FirmwareSplit } from './FirmwareSplit';
import { FleetBoard } from './FleetBoard';
import { RolloutMini } from './RolloutMini';
import { useFleetBoard, useOverview } from './useOverview';

/** Header counts. Drift comes from the board's device list; /overview doesn't count it. */
export function totalsOf(overview: Schemas['Overview'], devices?: Schemas['Device'][]) {
  const { warning, critical, offline } = overview.health;
  return {
    gateways: overview.devices,
    online: overview.devices - offline,
    attention: warning + critical,
    drifted: devices?.filter((d) => d.drift).length,
  };
}

function Totals({ totals }: { totals: ReturnType<typeof totalsOf> }) {
  const items = [
    ['Gateways', totals.gateways],
    ['Online', totals.online],
    ['Need attention', totals.attention],
    ['Config drift', totals.drifted],
  ] as const;
  return (
    <dl class="totals">
      {items.map(([label, value]) => (
        <div key={label} class="totals__item">
          <dt>{label}</dt>
          <dd>{value === undefined ? '–' : formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OverviewPage() {
  const overview = useOverview();
  const board = useFleetBoard();
  const body = () => {
    if (overview.isPending) return <Skeleton lines={8} label="Loading overview" />;
    if (overview.isError) {
      return (
        <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
      );
    }
    const o = overview.data;
    if (o.devices === 0) {
      return (
        <EmptyState title="No gateways yet">
          Install the agent on a gateway to get started.
        </EmptyState>
      );
    }
    return (
      <>
        <Totals totals={totalsOf(o, board.data)} />
        <div class="overview-grid">
          <div class="overview-grid__wide">
            <FleetBoard board={board} />
          </div>
          <FirmwareSplit models={o.models} />
          <div class="overview-grid__stack">
            <RolloutMini count={o.active_rollouts} />
            <AlertsPreview />
          </div>
        </div>
      </>
    );
  };
  return (
    <section class="page">
      <h1>Overview</h1>
      {body()}
    </section>
  );
}
