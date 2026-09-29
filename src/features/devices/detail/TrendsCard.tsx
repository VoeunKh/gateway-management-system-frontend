import { useState } from 'preact/hooks';
import { formatClock } from '@/lib/format';
import { Card, EmptyState, ErrorState, Segmented, Skeleton, TrendChart } from '@/ui';
import { useDeviceMetrics } from '../useDeviceTelemetry';
import { METRICS, RANGES, statsOf, toTrend } from './trends';
import type { MetricKey, RangeKey } from './trends';

const options = <T extends Record<string, { label: string }>>(map: T) =>
  Object.entries(map).map(([value, { label }]) => ({ value, label }));

/** Temperature, CPU, RAM and signal over 6 hours, a day or a week. */
export function TrendsCard({ sn }: { sn: string }) {
  const [metric, setMetric] = useState<MetricKey>('temp_c');
  const [range, setRange] = useState<RangeKey>('24h');
  const series = useDeviceMetrics(sn, range);
  const { label, format } = METRICS[metric];

  let body;
  if (series.isPending) body = <Skeleton lines={5} label="Loading trends" />;
  else if (series.isError) {
    body = <ErrorState message={series.error.message} onRetry={() => void series.refetch()} />;
  } else {
    const trend = toTrend(series.data.points, metric);
    const stats = statsOf(trend);
    body = !stats ? (
      <EmptyState title="No data yet">
        The gateway has not reported {label.toLowerCase()} in the last {RANGES[range].label}.
      </EmptyState>
    ) : (
      <>
        <p class="trend-stats" aria-label={`${label} summary`}>
          <span>
            Now <strong>{format(stats.latest)}</strong>
          </span>
          <span>
            Low <strong>{format(stats.min)}</strong>
          </span>
          <span>
            High <strong>{format(stats.max)}</strong>
          </span>
          <span>as of {formatClock(trend[trend.length - 1]?.t ?? 0)}</span>
        </p>
        <TrendChart
          points={trend}
          format={format}
          withDay={RANGES[range].hours >= 24}
          label={`${label}, last ${RANGES[range].label}`}
        />
      </>
    );
  }

  return (
    <Card title="Trends">
      <div class="trend-controls">
        <Segmented
          legend="Metric"
          value={metric}
          options={options(METRICS)}
          onChange={(v) => setMetric(v as MetricKey)}
        />
        <Segmented
          legend="Time range"
          value={range}
          options={options(RANGES)}
          onChange={(v) => setRange(v as RangeKey)}
        />
      </div>
      {body}
    </Card>
  );
}
