import type { Schemas } from '@/api/endpoints';
import { formatCount, formatPercent } from '@/lib/format';
import { Card } from '@/ui';

type ModelSummary = Schemas['OverviewModel'];

/** Segments narrower than this carry no text; the legend still names them. */
const LABEL_MIN_PCT = 12;
const SERIES = 5;

/** Versions most common first, with their share of the model and a series colour. */
export function shares(model: ModelSummary) {
  const total = model.firmware.reduce((sum, v) => sum + v.devices, 0);
  return [...model.firmware]
    .sort((a, b) => b.devices - a.devices || a.fw_version.localeCompare(b.fw_version))
    .map((v, i) => ({
      version: v.fw_version || 'Not reported',
      count: v.devices,
      pct: total ? (v.devices / total) * 100 : 0,
      series: (i % SERIES) + 1,
    }));
}

function ModelSplit({ model }: { model: ModelSummary }) {
  const parts = shares(model);
  const summary = parts
    .map((p) => `${p.version} on ${formatCount(p.count)} (${formatPercent(p.pct)})`)
    .join(', ');
  return (
    <li class="split">
      <h3 class="split__model">
        {model.model_name} <span class="muted">{formatCount(model.devices)}</span>
      </h3>
      <div class="split__bar" role="img" aria-label={`${model.model_id}: ${summary}`}>
        {parts.map((p) => (
          <div
            key={p.version}
            class={`split__part split__part--${p.series}`}
            style={{ width: `${p.pct}%` }}
            title={`${p.version}: ${formatCount(p.count)}`}
          >
            {p.pct >= LABEL_MIN_PCT && p.version}
          </div>
        ))}
      </div>
      <ul class="split__legend">
        {parts.map((p) => (
          <li key={p.version}>
            <span class={`split__swatch split__part--${p.series}`} aria-hidden="true" />
            <span class="mono">{p.version}</span> {formatCount(p.count)}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** One stacked bar per model showing which firmware its gateways run. */
export function FirmwareSplit({ models }: { models: ModelSummary[] }) {
  const shown = models.filter((m) => m.firmware.length > 0);
  return (
    <Card title="Firmware by model">
      {shown.length === 0 ? (
        <p class="muted">No gateway has reported its firmware yet.</p>
      ) : (
        <ul class="splits">
          {shown.map((model) => (
            <ModelSplit key={model.model_id} model={model} />
          ))}
        </ul>
      )}
    </Card>
  );
}
