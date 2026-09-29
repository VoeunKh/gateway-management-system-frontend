import type { Schemas } from '@/api/endpoints';
import {
  formatBytes,
  formatCelsius,
  formatDateTime,
  formatDbm,
  formatPercent,
  formatRelative,
} from '@/lib/format';
import { Badge, Card, DetailList, HealthBadge, Sparkline } from '@/ui';
import { useDeviceMetrics } from '../useDeviceTelemetry';
import { LOW_TMP_KB } from './labels';
import { toTrend } from './trends';

type Metrics = Schemas['LastMetrics'];

/** null/undefined stays null so DetailList hides the row. */
const maybe = <T,>(value: T | null | undefined, format: (v: T) => string) =>
  value === null || value === undefined ? null : format(value);

function TmpFree({ kb }: { kb: number }) {
  return (
    <span class="cell-inline">
      {formatBytes(kb * 1024)}
      {kb < LOW_TMP_KB && <Badge tone="warn">Low: under 8 MB</Badge>}
    </span>
  );
}

function rows(m: Metrics) {
  return [
    { label: 'Temperature', value: maybe(m.temp_c, formatCelsius) },
    { label: 'CPU', value: maybe(m.cpu_pct, formatPercent) },
    { label: 'RAM used', value: maybe(m.mem_pct, formatPercent) },
    {
      label: '/tmp free',
      value:
        m.tmp_free_kb === null || m.tmp_free_kb === undefined ? null : (
          <TmpFree kb={m.tmp_free_kb} />
        ),
    },
    { label: 'LTE signal', value: maybe(m.signal_dbm, formatDbm) },
    { label: 'Received', value: maybe(m.rx_bytes, formatBytes) },
    { label: 'Sent', value: maybe(m.tx_bytes, formatBytes) },
    {
      label: 'Sampled',
      value: (
        <time dateTime={m.time} title={formatDateTime(m.time)}>
          {formatRelative(m.time)}
        </time>
      ),
    },
  ];
}

function TemperatureSpark({ sn }: { sn: string }) {
  const series = useDeviceMetrics(sn, '24h');
  const trend = toTrend(series.data?.points ?? [], 'temp_c');
  if (trend.length === 0) return null;
  return (
    <div class="health-spark">
      <span class="muted">Temperature, last 24 hours</span>
      <Sparkline values={trend.map((p) => p.v)} label="Temperature, last 24 hours" />
    </div>
  );
}

export function HealthCard({ device }: { device: Schemas['DeviceDetail'] }) {
  const metrics = device.last_metrics;
  return (
    <Card title="Health" aside={<HealthBadge health={device.health} />}>
      {metrics ? (
        <>
          <DetailList items={rows(metrics)} />
          <TemperatureSpark sn={device.sn} />
        </>
      ) : (
        <p class="muted">No data yet. The gateway hasn't reported any metrics.</p>
      )}
    </Card>
  );
}
