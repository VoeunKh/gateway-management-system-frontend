import { useId, useState } from 'preact/hooks';
import { formatClock } from '@/lib/format';

export interface TrendPoint {
  /** Epoch milliseconds. */
  t: number;
  v: number;
}

export interface TrendChartProps {
  points: TrendPoint[];
  /** Accessible name, e.g. "Temperature, last 24 hours". */
  label: string;
  format: (value: number) => string;
  /** Show the weekday on the time axis (ranges over a day). */
  withDay?: boolean;
}

const W = 600;
const H = 180;
const TICKS = 4;

interface Scale {
  min: number;
  max: number;
  t0: number;
  t1: number;
}

/** A little headroom so a flat line sits mid-plot instead of on the frame. */
export function scaleOf(points: TrendPoint[]): Scale {
  const values = points.map((p) => p.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  const first = points[0]?.t ?? 0;
  const last = points[points.length - 1]?.t ?? first + 1;
  return { min: min - pad, max: max + pad, t0: first, t1: Math.max(last, first + 1) };
}

const x = (s: Scale, t: number) => ((t - s.t0) / (s.t1 - s.t0)) * W;
const y = (s: Scale, v: number) => H - ((v - s.min) / (s.max - s.min)) * H;

/**
 * A line-and-area chart drawn as inline SVG. Only the shapes are SVG; axis text is HTML,
 * so it stays crisp and readable at any width. Hovering shows the reading at that time.
 */
export function TrendChart({ points, label, format, withDay = false }: TrendChartProps) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const s = scaleOf(points);
  const line = points.map((p) => `${x(s, p.t).toFixed(1)},${y(s, p.v).toFixed(1)}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  const ticks = Array.from(
    { length: TICKS },
    (_, i) => s.max - ((s.max - s.min) * i) / (TICKS - 1),
  );
  const active = hover === null ? null : points[hover];

  const move = (event: PointerEvent) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  return (
    <figure class="trend">
      <div class="trend__yaxis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{format(tick)}</span>
        ))}
      </div>
      <div class="trend__plot" onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="currentColor" stop-opacity="0.28" />
              <stop offset="1" stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <line key={tick} class="trend__grid" x1="0" x2={W} y1={y(s, tick)} y2={y(s, tick)} />
          ))}
          <polygon points={area} fill={`url(#${gradient})`} />
          <polyline class="trend__line" points={line} vector-effect="non-scaling-stroke" />
          {active && (
            <line class="trend__cursor" x1={x(s, active.t)} x2={x(s, active.t)} y1="0" y2={H} />
          )}
        </svg>
        {active && (
          <div class="trend__tip" role="status" style={{ left: `${(x(s, active.t) / W) * 100}%` }}>
            <strong>{format(active.v)}</strong>
            <span>{formatClock(active.t, withDay)}</span>
          </div>
        )}
      </div>
      <div class="trend__xaxis" aria-hidden="true">
        <span>{formatClock(s.t0, withDay)}</span>
        <span>{formatClock(s.t1, withDay)}</span>
      </div>
    </figure>
  );
}
