// Every date and number the console shows goes through these Intl helpers.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** "just now", "5 minutes ago", "yesterday"…; `fallback` when there is no timestamp. */
export function formatRelative(
  iso: string | null | undefined,
  now = Date.now(),
  fallback = 'Never',
) {
  if (!iso) return fallback;
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(0, 'second');
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatCount(value: number): string {
  return integer.format(value);
}

const celsius = new Intl.NumberFormat(undefined, {
  style: 'unit',
  unit: 'celsius',
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export const formatCelsius = (value: number) => celsius.format(value);

/** 0–100 in, "42%" out. */
export const formatPercent = (value: number) => percent.format(value / 100);

export const formatDbm = (value: number) => `${oneDecimal.format(value)} dBm`;

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;
const byteFormats = BYTE_UNITS.map(
  (unit) =>
    new Intl.NumberFormat(undefined, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }),
);

/** Bytes in decimal units (1 kB = 1000 B), e.g. "1.2 GB". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let index = 0;
  while (Math.abs(value) >= 1000 && index < BYTE_UNITS.length - 1) {
    value /= 1000;
    index++;
  }
  return (byteFormats[index] ?? byteFormats[0])?.format(value) ?? String(bytes);
}
