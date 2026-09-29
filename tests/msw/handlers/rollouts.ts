import { HttpResponse, http } from 'msw';
import type { Schemas } from '@/api/endpoints';
import { currentUser, denyUnless, errorJson } from '../auth';
import { db } from '../db';
import {
  advanceRollouts,
  control,
  invalidRequest,
  isLive,
  planRollout,
  startRollout,
} from '../fixtures/rolloutSim';
import { api } from './api';

const listView = (r: Schemas['Rollout'], sn: string | null) => ({
  ...r,
  // The list returns no gateways; a device lookup returns just that gateway.
  waves: r.waves.map(({ percent, devices }) => ({
    percent,
    ...(sn
      ? {
          devices: (devices ?? [])
            .filter((d) => d.sn === sn)
            .map((d) => ({
              ...d,
              progress: d.state === 'downloading' ? (d.progress ?? 42) : null,
            })),
        }
      : {}),
  })),
});

const invalid = (req: Schemas['RolloutRequest']) => {
  const problem = invalidRequest(req);
  return problem ? errorJson(422, problem[0], problem[1]) : null;
};

/** Draft endpoints (api/proposed.yaml): rollouts. */
export const rolloutHandlers = [
  http.get(api('/rollouts'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    advanceRollouts();
    const q = new URL(request.url).searchParams;
    const state = q.get('state');
    const sn = q.get('sn');
    const rollouts = db.rollouts
      .filter((r) => !state || (state === 'active') === isLive(r))
      .filter((r) => !sn || r.waves.some((w) => w.devices?.some((d) => d.sn === sn)))
      .map((r) => listView(r, sn));
    return HttpResponse.json(rollouts);
  }),

  http.post<never, Schemas['RolloutRequest']>(api('/rollouts/preview'), async ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const req = await request.json();
    return invalid(req) ?? HttpResponse.json(planRollout(req));
  }),

  http.post<never, Schemas['RolloutRequest']>(api('/rollouts'), async ({ request }) => {
    const denied = denyUnless(request, 'release');
    if (denied) return denied;
    const req = await request.json();
    const problem = invalid(req);
    if (problem) return problem;
    if (db.rollouts.some((r) => r.model_id === req.model_id && isLive(r))) {
      return errorJson(409, 'rollout_active', `A ${req.model_id} rollout is already active.`);
    }
    const by = currentUser(request)?.name ?? 'someone';
    return HttpResponse.json(startRollout(req, by), { status: 201 });
  }),

  http.get<{ id: string }>(api('/rollouts/:id'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    advanceRollouts();
    const rollout = db.rollouts.find((r) => r.id === params.id);
    return rollout ? HttpResponse.json(rollout) : errorJson(404, 'not_found', 'no such rollout');
  }),

  ...(['pause', 'resume', 'abort'] as const).map((action) =>
    http.post<{ id: string }>(api(`/rollouts/:id/${action}`), ({ request, params }) => {
      const denied = denyUnless(request, 'release');
      if (denied) return denied;
      advanceRollouts();
      const rollout = db.rollouts.find((r) => r.id === params.id);
      if (!rollout) return errorJson(404, 'not_found', 'no such rollout');
      if (!control(rollout, action)) {
        return errorJson(409, 'conflict', `A ${rollout.state} rollout can't be ${action}d.`);
      }
      return HttpResponse.json(rollout);
    }),
  ),
];
