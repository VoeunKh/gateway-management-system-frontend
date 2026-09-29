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
