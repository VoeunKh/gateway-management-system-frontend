import type { UseQueryResult } from '@tanstack/react-query';
import { useLocation } from 'wouter-preact';
import type { Schemas } from '@/api/endpoints';
import { formatCount } from '@/lib/format';
import { Card, ErrorState, Skeleton } from '@/ui';

type Device = Schemas['Device'];
type Health = Schemas['Health'];

export const HEALTH_ORDER: readonly Health[] = ['critical', 'warning', 'offline', 'healthy'];
const HEALTH_LABEL: Record<Health, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  offline: 'Offline',
};

export const squareLabel = (d: Device) =>
  `${d.sn}, ${d.health}, firmware ${d.fw_version || 'not reported'}`;

function groupByModel(devices: Device[]): [string, Device[]][] {
  const groups = new Map<string, Device[]>();
  for (const device of devices) {
    const group = groups.get(device.model_id) ?? [];
    group.push(device);
    groups.set(device.model_id, group);
  }
  return [...groups];
}

/** Colour, fill pattern and the legend's words: a state never rests on colour alone. */
function Legend({ devices }: { devices: Device[] }) {
  return (
    <ul class="board__legend" aria-label="Health legend">
      {HEALTH_ORDER.map((health) => (
        <li key={health}>
          <span class={`board__cell board__cell--${health}`} aria-hidden="true" />
          {HEALTH_LABEL[health]}{' '}
          <span class="muted">
            {formatCount(devices.filter((d) => d.health === health).length)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One square per gateway, grouped by model. Each square opens its gateway. */
export function FleetBoard({ board }: { board: UseQueryResult<Device[]> }) {
  if (board.isPending) {
    return (
      <Card title="Fleet">
        <Skeleton lines={4} label="Loading gateways" />
      </Card>
    );
  }
  if (board.isError) {
    return (
      <Card title="Fleet">
        <ErrorState message={board.error.message} onRetry={() => void board.refetch()} />
      </Card>
    );
  }
  return <Board devices={board.data} />;
}

function Board({ devices }: { devices: Device[] }) {
  const [, navigate] = useLocation();
  return (
    <Card title="Fleet" aside={<Legend devices={devices} />}>
      <div class="board">
        {groupByModel(devices).map(([model, group]) => (
          <div key={model} class="board__group" role="group" aria-label={`${model} gateways`}>
            <h3 class="board__model">
              {model} <span class="muted">{formatCount(group.length)}</span>
            </h3>
            <div class="board__cells">
              {group.map((device) => (
                <button
                  key={device.sn}
                  type="button"
                  class={`board__cell board__cell--${device.health}`}
                  aria-label={squareLabel(device)}
                  title={squareLabel(device)}
                  onClick={() => navigate(`/devices/${encodeURIComponent(device.sn)}`)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
