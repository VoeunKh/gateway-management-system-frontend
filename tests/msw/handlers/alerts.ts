import { HttpResponse, http } from 'msw';
import { currentUser, denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { ALERT_RULES } from '../fixtures/alertRules';
import { api } from './api';

/** Draft endpoints (api/proposed.yaml): alerts, their rules and acknowledging. */
export const alertHandlers = [
  http.get(api('/alerts'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const state = params.get('state');
    const limit = Math.min(Number(params.get('limit') ?? 50), 200);
    const alerts = db.alerts.filter(
      (a) => !state || (state === 'open') === (a.resolved_at === null),
    );
    return HttpResponse.json(alerts.slice(0, limit));
  }),

  http.get(api('/alerts/rules'), ({ request }) => {
    return denyUnless(request) ?? HttpResponse.json(ALERT_RULES);
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
