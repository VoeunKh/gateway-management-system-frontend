import type { Schemas } from '@/api/endpoints';
import { formatCelsius, formatDbm, formatPercent } from '@/lib/format';
import type { TrendPoint } from '@/ui';

type Point = Schemas['MetricsPoint'];

export const RANGES = {
  '6h': { label: '6 hours', hours: 6, step: 60 },
  '24h': { label: '24 hours', hours: 24, step: 300 },
  '7d': { label: '7 days', hours: 168, step: 1800 },
} as const;
export type RangeKey = keyof typeof RANGES;

export const METRICS = {
  temp_c: { label: 'Temperature', format: formatCelsius },
  cpu_pct: { label: 'CPU', format: formatPercent },
  mem_pct: { label: 'RAM', format: formatPercent },
  signal_dbm: { label: 'LTE signal', format: formatDbm },
} as const;
export type MetricKey = keyof typeof METRICS;

/** The series for one metric; buckets without a reading (null signal) are left out. */
export function toTrend(points: Point[], metric: MetricKey): TrendPoint[] {
  return points.flatMap((p) => {
    const v = p[metric];
    return v === null || v === undefined ? [] : [{ t: Date.parse(p.time), v }];
  });
}

export interface TrendStats {
  latest: number;
  min: number;
  max: number;
}

export function statsOf(trend: TrendPoint[]): TrendStats | null {
  const last = trend[trend.length - 1];
  if (!last) return null;
  const values = trend.map((p) => p.v);
  return { latest: last.v, min: Math.min(...values), max: Math.max(...values) };
}
