import { formatCount, formatDateTime, formatRelative } from './format';

const NOW = Date.parse('2026-09-29T08:00:00Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

describe('formatRelative', () => {
  it.each([
    [10, 0, 'second'],
    [5 * 60, -5, 'minute'],
    [3 * 3600, -3, 'hour'],
    [86_400, -1, 'day'],
    [9 * 86_400, -9, 'day'],
  ] as const)('%is ago matches Intl', (seconds, value, unit) => {
    expect(formatRelative(ago(seconds), NOW)).toBe(rtf.format(value, unit));
  });

  it('says Never (or the fallback) without a timestamp', () => {
    expect(formatRelative(null, NOW)).toBe('Never');
    expect(formatRelative(undefined, NOW, '—')).toBe('—');
  });
});

describe('number and date formatting', () => {
  it('uses Intl', () => {
    expect(formatCount(1234.4)).toBe(new Intl.NumberFormat(undefined).format(1234));
    const iso = '2026-09-29T08:00:00Z';
    expect(formatDateTime(iso)).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(iso),
      ),
    );
  });
});
