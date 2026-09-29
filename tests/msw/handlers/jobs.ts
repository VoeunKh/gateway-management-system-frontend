import { HttpResponse, http } from 'msw';
import type { Schemas } from '@/api/endpoints';
import { denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { cancelPending, isFinal, startJob, stepJob } from '../fixtures/jobs';
import { api } from './api';

const TYPES: readonly string[] = ['reboot', 'logs', 'ping'];
const noJob = () => errorJson(404, 'not_found', 'no such job');

/** Draft endpoints (api/proposed.yaml): remote actions and their jobs. */
export const jobHandlers = [
  http.post<{ sn: string }, { type?: string }>(
    api('/devices/:sn/actions'),
    async ({ request, params }) => {
      const denied = denyUnless(request, 'admin');
      if (denied) return denied;
      const device = db.devices.find((d) => d.sn === params.sn);
      if (!device) return errorJson(404, 'not_found', 'no such device');
      const { type } = await request.json();
      if (!type || !TYPES.includes(type)) {
        return errorJson(422, 'validation_failed', 'type must be reboot, logs or ping');
      }
      if (!device.online) return errorJson(409, 'device_offline', 'The gateway is offline.');
      if (db.jobs.some((j) => j.sn === device.sn && j.type === type && !isFinal(j))) {
        return errorJson(409, 'action_pending', `A ${type} is already pending for this gateway.`);
      }
      return HttpResponse.json(startJob(device.sn, type as Schemas['JobType']), { status: 201 });
    },
  ),

  http.get<{ id: string }>(api('/jobs/:id'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const job = db.jobs.find((j) => j.id === params.id);
    return job ? HttpResponse.json({ ...stepJob(job) }) : noJob();
  }),

  http.post<{ id: string }>(api('/jobs/:id/cancel'), ({ request, params }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const job = db.jobs.find((j) => j.id === params.id);
    if (!job) return noJob();
    if (job.state !== 'pending')
      return errorJson(409, 'not_cancellable', 'Only a pending job can be cancelled.');
    return HttpResponse.json({ ...cancelPending(job) });
  }),

  http.get<{ id: string }>(api('/jobs/:id/logs'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const job = db.jobs.find((j) => j.id === params.id);
    if (!job) return noJob();
    if (job.type !== 'logs' || job.state !== 'succeeded') {
      return errorJson(409, 'no_logs', 'This job has no log archive.');
    }
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();
    return HttpResponse.json({ url: `/api/v1/dl/mock-${job.id.slice(-4)}`, expires_at: expires });
  }),
];
