import {
  formatBytes,
  formatClock,
  formatCelsius,
  formatCount,
  formatDateTime,
  formatDbm,
  formatDuration,
  formatPercent,
  formatRelative,
} from './format';

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

describe('unit formatting', () => {
  it('uses Intl units', () => {
    const unit = (u: string, v: number) =>
      new Intl.NumberFormat(undefined, {
        style: 'unit',
        unit: u,
        unitDisplay: 'short',
        maximumFractionDigits: 1,
      }).format(v);
    expect(formatCelsius(71.25)).toBe(
      new Intl.NumberFormat(undefined, {
        style: 'unit',
        unit: 'celsius',
        maximumFractionDigits: 1,
      }).format(71.25),
    );
    expect(formatPercent(42)).toBe(
      new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.42),
    );
    expect(formatDbm(-87)).toBe('-87 dBm');
    expect(formatBytes(512)).toBe(unit('byte', 512));
    expect(formatBytes(7_900_000)).toBe(unit('megabyte', 7.9));
    expect(formatBytes(1_234_000_000)).toBe(unit('gigabyte', 1.234));
  });
});

describe('formatDuration and formatClock', () => {
  it('keeps the two largest non-zero units', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(3 * 3600 + 20 * 60 + 5)).toBe('3h 20m');
    expect(formatDuration(2 * 86400 + 4 * 3600 + 59)).toBe('2d 4h');
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats clock times, with the weekday when asked', () => {
    const iso = '2026-09-29T14:30:00Z';
    expect(formatClock(iso)).toMatch(/\d/);
    expect(formatClock(iso, true).length).toBeGreaterThan(formatClock(iso).length);
  });
});
