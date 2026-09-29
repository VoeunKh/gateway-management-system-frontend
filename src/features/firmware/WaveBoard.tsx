import type { JSX } from 'preact';
import { useLocation } from 'wouter-preact';
import type { Schemas } from '@/api/endpoints';
import { formatCount } from '@/lib/format';
import { ROLLOUT_DEVICE_LABEL } from '@/ui';

type State = Schemas['RolloutDeviceState'];

/** Legend order: where a gateway is on its way to done, then how it ended. */
export const STATE_ORDER: readonly State[] = [
  'waiting',
  'downloading',
  'installing',
  'updated',
  'rolled_back',
  'needs_recovery',
  'skipped',
  'deferred',
];

const cellLabel = (d: { sn: string; state: State; progress?: number | null }) =>
  `${d.sn}: ${ROLLOUT_DEVICE_LABEL[d.state]}${d.state === 'downloading' && d.progress != null ? ` ${d.progress}%` : ''}`;

export function WaveLegend() {
  return (
    <ul class="wave-legend" aria-label="Gateway states">
      {STATE_ORDER.map((state) => (
        <li key={state}>
          <span class={`wcell wcell--${state}`} aria-hidden="true" />
          {ROLLOUT_DEVICE_LABEL[state]}
        </li>
      ))}
    </ul>
  );
}

/**
 * One square per gateway per wave. Cheap on purpose: no per-square state, one click handler
 * for the whole board, and the state is in each square's label and shape as well as colour.
 */
export function WaveBoard({ rollout }: { rollout: Schemas['Rollout'] }) {
  const [, navigate] = useLocation();
  const open = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    const sn = (event.target as HTMLElement).closest<HTMLElement>('button[data-sn]')?.dataset.sn;
    if (sn) navigate(`/devices/${encodeURIComponent(sn)}`);
  };
  return (
    <div class="waveboard" onClick={open}>
      {rollout.waves.map((wave, i) => {
        const devices = wave.devices ?? [];
        return (
          <div
            key={wave.percent}
            class="wave"
            role="group"
            aria-label={`Wave ${i + 1}, ${wave.percent}%, ${devices.length} gateways`}
          >
            <p class="wave__title">
              Wave {i + 1}{' '}
              <span class="muted">
                · {wave.percent}% · {formatCount(devices.length)} gateways
              </span>
            </p>
            <div class="wave__cells">
              {devices.map((d) => (
                <button
                  key={d.sn}
                  type="button"
                  data-sn={d.sn}
                  class={`wcell wcell--${d.state}`}
                  aria-label={cellLabel(d)}
                  title={cellLabel(d)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
