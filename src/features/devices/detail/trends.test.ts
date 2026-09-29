import type { Schemas } from '@/api/endpoints';
import { describe as text, typeLabel } from './historyText';
import { statsOf, toTrend } from './trends';

const point = (time: string, signal: number | null): Schemas['MetricsPoint'] => ({
  time,
  cpu_pct: 10,
  mem_pct: 40,
  temp_c: 55,
  tmp_free_kb: 30000,
  signal_dbm: signal,
  rx_bytes: 1,
  tx_bytes: 1,
});

describe('trends', () => {
  const points = [
    point('2026-09-29T08:00:00Z', -80),
    point('2026-09-29T08:05:00Z', null),
    point('2026-09-29T08:10:00Z', -70),
  ];

  it('leaves out buckets with no reading (a null signal is not 0)', () => {
    expect(toTrend(points, 'signal_dbm').map((p) => p.v)).toEqual([-80, -70]);
    expect(toTrend(points, 'temp_c')).toHaveLength(3);
  });

  it('summarises latest, low and high', () => {
    expect(statsOf(toTrend(points, 'signal_dbm'))).toEqual({ latest: -70, min: -80, max: -70 });
    expect(statsOf([])).toBeNull();
  });
});

describe('history text', () => {
  const entry = (type: string, detail: unknown): Schemas['HistoryEntry'] => ({
    id: 'x',
    kind: 'event',
    type,
    state: null,
    progress: null,
    error_code: null,
    detail: detail as Schemas['HistoryEntry']['detail'],
    created_at: '2026-09-29T08:00:00Z',
  });

  it('names known tags and turns unknown ones into sentences', () => {
    expect(typeLabel(entry('cfg_applied', null))).toBe('Config applied');
    expect(typeLabel(entry('modem_reset', null))).toBe('Modem reset');
  });

  it('reads a message, a from-to pair, a version, or lists fields', () => {
    expect(text(entry('e', { message: 'Heartbeat lost' }))).toBe('Heartbeat lost');
    expect(text(entry('e', { from: '1.1.0', to: '1.2.0' }))).toBe('1.1.0 → 1.2.0');
    expect(text(entry('e', { version: 3 }))).toBe('v3');
    expect(text(entry('e', { a: 1, b: 'x' }))).toBe('a: 1, b: x');
    expect(text(entry('job', '0% loss, avg 42 ms'))).toBe('0% loss, avg 42 ms');
    expect(text(entry('e', null))).toBe('');
  });
});
