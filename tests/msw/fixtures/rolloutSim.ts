import type { Schemas } from '@/api/endpoints';
import { db } from '../db';

type Rollout = Schemas['Rollout'];
type State = Schemas['RolloutDeviceState'];
type Dev = { sn: string; state: State; progress?: number | null };

export interface RolloutMeta {
  lastTick: number;
  wave: number;
  soak: number;
  threshold: number;
  /** After a resume the failures so far are accepted for one wave. */
  override: boolean;
}

export const TERMINAL: readonly State[] = [
  'updated',
  'rolled_back',
  'needs_recovery',
  'skipped',
  'deferred',
];
const isTerminal = (d: Dev) => TERMINAL.includes(d.state);
const SOAK_TICKS = 2;

export const isLive = (r: Rollout) => ['running', 'soaking', 'paused'].includes(r.state);

/** Gateways a rollout to `fw` would touch, oldest serial first. */
export function targetsOf(modelId: string, fw: string) {
  return db.devices
    .filter((d) => d.model_id === modelId && d.lifecycle === 'active' && d.fw_version !== fw)
    .sort((a, b) => a.sn.localeCompare(b.sn));
}

const lowTmp = (d: (typeof db.devices)[number], sizeBytes: number) =>
  d.online && (d.last_metrics?.tmp_free_kb ?? Infinity) * 1024 < sizeBytes;

/** Cumulative gateway counts per wave: at least one more each time, never past `need`. */
export function waveCounts(need: number, percents: number[]): number[] {
  let prev = 0;
  const counts = percents.map(
    (p) => (prev = Math.min(need, Math.max(prev + 1, Math.ceil((need * p) / 100)))),
  );
  return counts.filter((c, i) => i === 0 || c > (counts[i - 1] ?? 0));
}

export function planRollout(req: Schemas['RolloutRequest']): Schemas['RolloutPreview'] {
  const image = db.firmware.find(
    (f) => f.model_id === req.model_id && f.version === req.fw_version,
  );
  const targets = targetsOf(req.model_id, req.fw_version);
  return {
    need: targets.length,
    total: db.devices.filter((d) => d.model_id === req.model_id).length,
    waves: waveCounts(targets.length, req.waves),
    offline_deferred: targets.filter((d) => !d.online).length,
    skipped_low_tmp: targets.filter((d) => lowTmp(d, image?.size ?? 0)).length,
  };
}

/** The API's rules for a rollout request, as a 422 code and message, or null when fine. */
export function invalidRequest(req: Schemas['RolloutRequest']): [string, string] | null {
  const { waves, failure_threshold: t } = req;
  if (!Number.isInteger(t) || t < 1 || t > 100)
    return ['invalid_threshold', 'threshold must be 1..100'];
  if (waves.length === 0 || waves.some((w) => !Number.isInteger(w) || w < 1 || w > 100)) {
    return ['invalid_waves', 'waves must be whole percentages'];
  }
  if (waves.some((w, i) => i > 0 && w <= (waves[i - 1] ?? 0)) || waves[waves.length - 1] !== 100) {
    return ['invalid_waves', 'waves must ascend and end at 100'];
  }
  const image = db.firmware.find(
    (f) => f.model_id === req.model_id && f.version === req.fw_version,
  );
  if (!image) return ['unknown_firmware', 'no such firmware image'];
  if (image.blocked) return ['firmware_blocked', 'that firmware version is blocked'];
  return null;
}

export function recount(r: Rollout) {
  const all = r.waves.flatMap((w) => w.devices ?? []);
  const n = (...states: State[]) => all.filter((d) => states.includes(d.state)).length;
  r.counters = {
    updated: n('updated'),
    in_progress: n('downloading', 'installing'),
    rolled_back: n('rolled_back'),
    needs_recovery: n('needs_recovery'),
    skipped: n('skipped'),
    deferred: n('deferred'),
    waiting: n('waiting'),
  };
}

export function startRollout(req: Schemas['RolloutRequest'], by: string): Rollout {
  const image = db.firmware.find(
    (f) => f.model_id === req.model_id && f.version === req.fw_version,
  );
  const targets = targetsOf(req.model_id, req.fw_version);
  const counts = waveCounts(targets.length, req.waves);
  const number = Math.max(...db.rollouts.map((r) => Number(r.id.slice(2))), 0) + 1;
  const rollout: Rollout = {
    id: `R-${String(number).padStart(3, '0')}`,
    model_id: req.model_id,
    fw_version: req.fw_version,
    created_at: new Date().toISOString(),
    created_by: by,
    state: 'running',
    pause_reason: null,
    counters: {
      updated: 0,
      in_progress: 0,
      rolled_back: 0,
      needs_recovery: 0,
      skipped: 0,
      deferred: 0,
      waiting: 0,
    },
    waves: counts.map((to, i) => ({
      percent: req.waves[i] ?? 100,
      devices: targets.slice(i === 0 ? 0 : (counts[i - 1] ?? 0), to).map((d): Dev => ({
        sn: d.sn,
        state: !d.online ? 'deferred' : lowTmp(d, image?.size ?? 0) ? 'skipped' : 'waiting',
        progress: null,
      })),
    })),
  };
  recount(rollout);
  db.rollouts.unshift(rollout);
  db.rolloutMeta.set(rollout.id, {
    lastTick: Date.now(),
    wave: 0,
    soak: 0,
    threshold: req.failure_threshold,
    override: false,
  });
  return rollout;
}

/** A repeatable pass/fail per gateway, so a given failure rate always hits the same ones. */
function outcome(sn: string, rolloutId: string): 'ok' | 'rolled_back' | 'needs_recovery' {
  let h = 0;
  for (const c of `${rolloutId}:${sn}`) h = (h * 31 + c.charCodeAt(0)) % 1000;
  if (h % 100 >= db.rolloutFailurePct) return 'ok';
  return h % 10 < 3 ? 'needs_recovery' : 'rolled_back';
}

function finishWave(r: Rollout, meta: RolloutMeta) {
  const done = r.waves.slice(0, meta.wave + 1).flatMap((w) => w.devices ?? []);
  const touched = done.filter((d) =>
    ['updated', 'rolled_back', 'needs_recovery'].includes(d.state),
  );
  const bad = touched.filter((d) => d.state !== 'updated').length;
  const rate = touched.length ? (bad / touched.length) * 100 : 0;
  if (!meta.override && rate > meta.threshold) {
    r.state = 'paused';
    r.pause_reason = `Auto-paused after wave ${meta.wave + 1}: ${bad} of ${touched.length} updated gateways failed (${Math.round(rate)}%, limit ${meta.threshold}%).`;
  } else if (meta.wave >= r.waves.length - 1) {
    r.state = 'completed';
  } else {
    r.state = 'soaking';
    meta.soak = SOAK_TICKS;
  }
}

function tick(r: Rollout, meta: RolloutMeta) {
  if (r.state === 'soaking') {
    if (--meta.soak <= 0) {
      meta.wave++;
      meta.override = false;
      r.state = 'running';
    }
    return;
  }
  const devices = r.waves[meta.wave]?.devices ?? [];
  const open = devices.filter((d) => !isTerminal(d));
  if (open.length === 0) return finishWave(r, meta);
  for (const d of open) {
    if (d.state === 'waiting') {
      d.state = 'downloading';
      d.progress = 0;
    } else if (d.state === 'downloading') {
      d.progress = Math.min(100, (d.progress ?? 0) + 40);
      if (d.progress >= 100) {
        d.state = 'installing';
        d.progress = null;
      }
    } else {
      const result = outcome(d.sn, r.id);
      d.state = result === 'ok' ? 'updated' : result;
      const device = db.devices.find((x) => x.sn === d.sn);
      if (device && d.state === 'updated') device.fw_version = r.fw_version;
    }
  }
}

/** Moves every rollout the console started forward by the time that has passed. */
export function advanceRollouts(now = Date.now()) {
  for (const [id, meta] of db.rolloutMeta) {
    const r = db.rollouts.find((x) => x.id === id);
    if (!r) continue;
    if (r.state !== 'running' && r.state !== 'soaking') {
      meta.lastTick = now;
      continue;
    }
    const steps = Math.max(0, Math.min(50, Math.floor((now - meta.lastTick) / db.rolloutStepMs)));
    for (let i = 0; i < steps && (r.state === 'running' || r.state === 'soaking'); i++)
      tick(r, meta);
    meta.lastTick += steps * db.rolloutStepMs;
    recount(r);
  }
}

/** Test helper: move every simulated rollout forward `ticks` steps, without waiting. */
export function stepRollouts(ticks: number) {
  advanceRollouts(Date.now() + ticks * db.rolloutStepMs);
}

export function control(r: Rollout, action: 'pause' | 'resume' | 'abort'): boolean {
  const meta = db.rolloutMeta.get(r.id);
  if (action === 'pause') {
    if (r.state !== 'running' && r.state !== 'soaking') return false;
    r.state = 'paused';
    r.pause_reason = null;
  } else if (action === 'resume') {
    if (r.state !== 'paused') return false;
    r.pause_reason = null;
    const devices = r.waves[meta?.wave ?? 0]?.devices ?? [];
    if (meta && devices.every(isTerminal)) {
      if (meta.wave >= r.waves.length - 1) r.state = 'completed';
      else {
        meta.wave++;
        meta.override = true;
        r.state = 'running';
      }
    } else r.state = 'running';
    if (meta) meta.lastTick = Date.now();
  } else {
    if (r.state === 'completed' || r.state === 'aborted') return false;
    r.state = 'aborted';
    for (const w of r.waves)
      for (const d of w.devices ?? []) if (d.state === 'waiting') d.state = 'deferred';
    recount(r);
  }
  return true;
}
