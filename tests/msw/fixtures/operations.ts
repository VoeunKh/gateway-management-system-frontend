import type { Schemas } from '@/api/endpoints';
import { minutesAgo, seeded } from './random';

type Device = Schemas['DeviceDetail'];
type DeviceState = Schemas['RolloutDeviceState'];

const WAVES = [1, 10, 50, 100];

interface RolloutSeed {
  id: string;
  model_id: string;
  fw_version: string;
  state: Schemas['RolloutState'];
  pause_reason?: string;
  /** How far through the waves it is: devices before this share are done. */
  done: number;
  startedMinutesAgo: number;
}

const SEEDS: RolloutSeed[] = [
  {
    id: 'R-014',
    model_id: 'GW200',
    fw_version: '1.3.0',
    state: 'running',
    done: 0.5,
    startedMinutesAgo: 95,
  },
  {
    id: 'R-013',
    model_id: 'GW210',
    fw_version: '1.3.1',
    state: 'paused',
    pause_reason: 'Failure threshold reached: 2 gateways rolled back (threshold 2)',
    done: 0.1,
    startedMinutesAgo: 300,
  },
  {
    id: 'R-012',
    model_id: 'GW300',
    fw_version: '2.1.0',
    state: 'soaking',
    done: 0.5,
    startedMinutesAgo: 1440,
  },
  {
    id: 'R-011',
    model_id: 'GW400',
    fw_version: '3.0.2',
    state: 'completed',
    done: 1,
    startedMinutesAgo: 8000,
  },
];

function deviceState(device: Device, seed: RolloutSeed, index: number, size: number): DeviceState {
  if (!device.online) return 'deferred';
  if (index / size >= seed.done) return 'waiting';
  if (seed.id === 'R-013' && index < 2) return 'rolled_back';
  if (seed.state === 'running' && index >= size * seed.done - 3) return 'downloading';
  return 'updated';
}

const COUNTER: Record<DeviceState, keyof Schemas['RolloutCounters']> = {
  waiting: 'waiting',
  downloading: 'in_progress',
  installing: 'in_progress',
  updated: 'updated',
  rolled_back: 'rolled_back',
  needs_recovery: 'needs_recovery',
  skipped: 'skipped',
  deferred: 'deferred',
};

/** Rollouts over the seeded fleet: one running, one auto-paused, one soaking, one done. */
export function buildRollouts(devices: Device[]): Schemas['Rollout'][] {
  return SEEDS.map((seed) => {
    const fleet = devices.filter((d) => d.model_id === seed.model_id);
    const counters: Schemas['RolloutCounters'] = {
      updated: 0,
      in_progress: 0,
      rolled_back: 0,
      needs_recovery: 0,
      skipped: 0,
      deferred: 0,
      waiting: 0,
    };
    const states = fleet.map((device, i) => {
      const state = deviceState(device, seed, i, fleet.length);
      counters[COUNTER[state]] += 1;
      return { sn: device.sn, state };
    });
    let from = 0;
    const waves = WAVES.map((percent) => {
      const to = Math.ceil((fleet.length * percent) / 100);
      const wave = { percent, devices: states.slice(from, to) };
      from = to;
      return wave;
    });
    return {
      id: seed.id,
      model_id: seed.model_id,
      fw_version: seed.fw_version,
      created_at: minutesAgo(seed.startedMinutesAgo),
      created_by: 'Rui Release',
      state: seed.state,
      pause_reason: seed.pause_reason ?? null,
      counters,
      waves,
    };
  });
}

function alertFor(device: Device): Pick<Schemas['Alert'], 'rule' | 'severity' | 'message'> | null {
  const m = device.last_metrics;
  if (device.lifecycle !== 'active') return null;
  if (!device.online) return { rule: 'offline', severity: 'warning', message: 'Not reporting' };
  if ((m?.temp_c ?? 0) >= 80) {
    return { rule: 'temp_high', severity: 'critical', message: `Temperature ${m?.temp_c} °C` };
  }
  if ((m?.mem_pct ?? 0) >= 90) {
    return { rule: 'mem_high', severity: 'critical', message: `Memory ${m?.mem_pct} % used` };
  }
  if (device.health === 'warning') {
    return { rule: 'health_warning', severity: 'warning', message: 'Running hot or low on memory' };
  }
  if (device.package_drift === 'drift') {
    return { rule: 'package_drift', severity: 'info', message: 'Packages differ from manifest' };
  }
  return null;
}

/** One alert per gateway that has a problem, newest first; a few acknowledged or resolved. */
export function buildAlerts(devices: Device[]): Schemas['Alert'][] {
  const rand = seeded(20260929);
  const alerts: Schemas['Alert'][] = [];
  for (const device of devices) {
    const found = alertFor(device);
    if (!found) continue;
    const n = alerts.length;
    const opened = rand.int(5, 3000);
    const acked = n % 4 === 3;
    alerts.push({
      id: `A-${String(n + 1).padStart(4, '0')}`,
      sn: device.sn,
      ...found,
      opened_at: minutesAgo(opened),
      resolved_at: found.rule === 'package_drift' && n % 3 === 0 ? minutesAgo(opened - 2) : null,
      acked_by: acked ? 'Ada Admin' : null,
      acked_at: acked ? minutesAgo(opened - 1) : null,
    });
  }
  return alerts.sort((a, b) => b.opened_at.localeCompare(a.opened_at));
}
