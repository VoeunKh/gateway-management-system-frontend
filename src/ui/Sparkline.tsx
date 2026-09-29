export interface SparklineProps {
  values: number[];
  /** Accessible name, e.g. "Signal strength, last 24 hours". */
  label: string;
}

const WIDTH = 100;
const HEIGHT = 30;
const PAD = 2;

/** Maps values to "x,y" pairs inside the viewBox; a flat series sits mid-height. */
export function sparklinePoints(values: number[]): string {
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  return values
    .map((value, i) => {
      const x = values.length > 1 ? i * step : WIDTH / 2;
      const y = span === 0 ? HEIGHT / 2 : PAD + (1 - (value - min) / span) * (HEIGHT - 2 * PAD);
      return `${round(x)},${round(y)}`;
    })
    .join(' ');
}

const round = (n: number) => Math.round(n * 100) / 100;

export function Sparkline({ values, label }: SparklineProps) {
  if (values.length === 0) return null;
  return (
    <svg
      class="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polyline points={sparklinePoints(values)} vector-effect="non-scaling-stroke" />
    </svg>
  );
}
