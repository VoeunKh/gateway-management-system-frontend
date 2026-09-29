import { HttpResponse, http } from 'msw';
import type { Schemas } from '@/api/endpoints';
import { currentUser, denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { api } from './api';

const ACTIVE: readonly Schemas['RolloutState'][] = ['running', 'soaking', 'paused'];
const isActive = (rollout: Schemas['Rollout']) => ACTIVE.includes(rollout.state);
const isOpen = (alert: Schemas['Alert']) => alert.resolved_at === null;

/** GET /overview, counted from the same devices, rollouts and alerts the other handlers use. */
export function buildOverview(): Schemas['Overview'] {
  const health: Schemas['OverviewHealth'] = { healthy: 0, warning: 0, critical: 0, offline: 0 };
  for (const device of db.devices) health[device.health] += 1;
  const models = db.models.map(({ model }) => {
    const fleet = db.devices.filter((d) => d.model_id === model.id);
    const counts = new Map<string, number>();
    for (const { fw_version: fw = '' } of fleet) counts.set(fw, (counts.get(fw) ?? 0) + 1);
    return {
      model_id: model.id,
      model_name: model.name,
      devices: fleet.length,
      firmware: [...counts].map(([fw_version, devices]) => ({ fw_version, devices })),
    };
  });
  return {
    devices: db.devices.length,
    health,
    models,
    active_rollouts: db.rollouts.filter(isActive).length,
    open_alerts: db.alerts.filter(isOpen).length,
  };
}

export const overviewHandlers = [
  http.get(api('/overview'), ({ request }) => {
    const denied = denyUnless(request);
    return denied ?? HttpResponse.json(buildOverview());
  }),

  // Draft endpoints (api/proposed.yaml)
  http.get(api('/rollouts'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const state = new URL(request.url).searchParams.get('state');
    const rollouts = db.rollouts
      .filter((r) => !state || (state === 'active') === isActive(r))
      .map((r) => ({ ...r, waves: r.waves.map(({ percent }) => ({ percent })) }));
    return HttpResponse.json(rollouts);
  }),

  http.get(api('/alerts'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const state = params.get('state');
    const limit = Math.min(Number(params.get('limit') ?? 50), 200);
    const alerts = db.alerts.filter((a) => !state || (state === 'open') === isOpen(a));
    return HttpResponse.json(alerts.slice(0, limit));
  }),

  http.post<{ id: string }>(api('/alerts/:id/ack'), ({ request, params }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const alert = db.alerts.find((candidate) => candidate.id === params.id);
    if (!alert) return errorJson(404, 'not_found', 'no such alert');
    if (alert.acked_at) return errorJson(409, 'already_acknowledged', 'already acknowledged');
    alert.acked_by = currentUser(request)?.name ?? null;
    alert.acked_at = new Date().toISOString();
    return HttpResponse.json(alert);
  }),
];
