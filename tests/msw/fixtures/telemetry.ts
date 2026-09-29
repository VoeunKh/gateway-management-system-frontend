import type { DeviceView, Schemas } from '@/api/endpoints';
import { FIXTURE_NOW, minutesAgo, seeded } from './random';

type Point = Schemas['MetricsPoint'];

export const MAX_POINTS = 2000;
const HOUR = 3_600_000;

/** A smooth daily wave plus a little repeatable jitter, so charts look real and stay stable. */
const wave = (t: number, period: number, phase: number) =>
  Math.sin(((t / period) * 2 + phase) * Math.PI);

const jitter = (t: number, salt: number) => (seeded((t / 1000 + salt) | 0).next() - 0.5) * 2;

function base(device: DeviceView) {
  const m = device.last_metrics;
  return {
    temp: m?.temp_c ?? 50,
    cpu: m?.cpu_pct ?? 20,
    mem: m?.mem_pct ?? 45,
    tmp: m?.tmp_free_kb ?? 30_000,
    dbm: m?.signal_dbm ?? null,
  };
}

/** One bucket per `stepS` seconds, epoch-aligned, from `from` to `to`, up to when the gateway last reported. */
export function buildSeries(device: DeviceView, from: number, to: number, stepS: number): Point[] {
  const step = stepS * 1000;
  const b = base(device);
  const lastSeen = device.last_seen ? Date.parse(device.last_seen) : FIXTURE_NOW;
  const salt = device.sn.length * 31 + device.sn.charCodeAt(device.sn.length - 1);
  const points: Point[] = [];
  for (let t = Math.ceil(from / step) * step; t <= Math.min(to, lastSeen); t += step) {
    const day = wave(t, 24 * HOUR, salt % 7);
    points.push({
      time: new Date(t).toISOString(),
      temp_c: round(b.temp + 4 * day + jitter(t, salt)),
      cpu_pct: clamp(round(b.cpu + 8 * wave(t, 3 * HOUR, salt) + 3 * jitter(t, salt + 1)), 1, 99),
      mem_pct: clamp(round(b.mem + 3 * day + jitter(t, salt + 2)), 5, 99),
      tmp_free_kb: Math.round(b.tmp + 800 * jitter(t, salt + 3)),
      signal_dbm: b.dbm === null ? null : round(b.dbm + 5 * wave(t, 5 * HOUR, salt) + jitter(t, 9)),
      rx_bytes: Math.round(2e6 * (1 + wave(t, 12 * HOUR, 0))),
      tx_bytes: Math.round(8e5 * (1 + wave(t, 12 * HOUR, 0.3))),
    });
  }
  return points;
}

const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Older events for a gateway, newest first. Jobs join them as they are run. */
export function seedHistory(device: DeviceView): Schemas['HistoryEntry'][] {
  const rand = seeded(device.sn.length * 977 + device.sn.charCodeAt(device.sn.length - 1));
  const n = (rand.next() * 1e9) | 0;
  const id = (k: number) =>
    `00000000-0000-4000-a000-${String(n + k)
      .padStart(12, '0')
      .slice(-12)}`;
  const ev = (k: number, type: string, ago: number, detail: unknown): Schemas['HistoryEntry'] => ({
    id: id(k),
    kind: 'event',
    type,
    state: null,
    progress: null,
    error_code: null,
    detail: detail as Schemas['HistoryEntry']['detail'],
    created_at: minutesAgo(ago),
  });
  const entries = [
    ev(1, 'provisioned', 60 * 24 * rand.int(60, 300), {
      message: 'Provisioned with factory certificate',
    }),
    ev(2, 'fw_updated', 60 * 24 * rand.int(20, 59), { from: '1.1.0', to: device.fw_version ?? '' }),
    ev(3, 'cfg_applied', 60 * 24 * rand.int(2, 19), { version: device.cfg_version ?? 1 }),
  ];
  if (!device.online)
    entries.push(ev(4, 'offline', rand.int(60, 900), { message: 'Heartbeat lost' }));
  return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
