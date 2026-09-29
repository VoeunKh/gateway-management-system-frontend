import type { Schemas } from '@/api/endpoints';
import { db } from '../db';
import { seedHistory } from './telemetry';

type Job = Schemas['Job'];

const FINAL: readonly Job['state'][] = ['succeeded', 'failed', 'timed_out', 'cancelled'];
export const isFinal = (job: Job) => FINAL.includes(job.state);

const uuid = (n: number) => `00000000-0000-4000-b000-${String(n).padStart(12, '0')}`;

/** Mirrors the job into the gateway's history feed, so the History card shows it. */
function record(job: Job) {
  const device = db.devices.find((d) => d.sn === job.sn);
  if (!device) return;
  if (!db.history.has(job.sn)) db.history.set(job.sn, seedHistory(device));
  const feed = db.history.get(job.sn) ?? [];
  const entry: Schemas['HistoryEntry'] = {
    id: job.id,
    kind: 'job',
    type: job.type,
    state: job.state,
    progress: job.progress,
    error_code: null,
    detail: job.error?.message ?? job.detail,
    created_at: job.created_at,
  };
  const at = feed.findIndex((e) => e.id === job.id);
  if (at >= 0) feed[at] = entry;
  else feed.unshift(entry);
}

export function startJob(sn: string, type: Job['type']): Job {
  const job: Job = {
    id: uuid(db.jobs.length + 1),
    type,
    sn,
    state: 'pending',
    created_at: new Date().toISOString(),
    finished_at: null,
    progress: null,
    detail: null,
    error: null,
  };
  db.jobs.push(job);
  record(job);
  return job;
}

function finish(job: Job, state: Job['state']) {
  job.state = state;
  job.finished_at = new Date().toISOString();
}

/** Every poll moves a job one step: pending, running, (progress,) then a final state. */
export function stepJob(job: Job): Job {
  if (isFinal(job)) return job;
  const device = db.devices.find((d) => d.sn === job.sn);
  if (job.state === 'pending') {
    job.state = 'running';
    if (job.type === 'reboot' && device) {
      device.online = false;
      device.health = 'offline';
    }
  } else if (db.failActions.has(job.type)) {
    finish(job, 'failed');
    job.error = { code: 'agent_unreachable', message: 'The gateway agent did not answer in time.' };
    if (job.type === 'reboot' && device) {
      device.online = true;
      device.health = 'healthy';
    }
  } else if (job.type === 'logs' && (job.progress ?? 0) < 100) {
    job.progress = Math.min(100, (job.progress ?? 0) + 50);
  } else {
    finish(job, 'succeeded');
    if (job.type === 'ping') job.detail = '0% packet loss, avg 42 ms';
    if (job.type === 'reboot' && device) {
      device.online = true;
      device.health = 'healthy';
      device.uptime_s = 12;
    }
  }
  record(job);
  return job;
}

export function cancelPending(job: Job): Job {
  finish(job, 'cancelled');
  record(job);
  return job;
}
