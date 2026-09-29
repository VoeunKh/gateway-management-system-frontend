import { HttpResponse, http } from 'msw';
import { denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { MAX_POINTS, buildSeries, seedHistory } from '../fixtures/telemetry';
import { api } from './api';

const invalid = (message: string) => errorJson(422, 'validation_failed', message);
const DAY = 86_400_000;
const PAGE = 50;

export const telemetryHandlers = [
  http.get<{ sn: string }>(api('/devices/:sn/metrics'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const device = db.devices.find((d) => d.sn === params.sn);
    if (!device) return errorJson(404, 'not_found', 'no such device');
    const q = new URL(request.url).searchParams;
    const to = q.has('to') ? Date.parse(q.get('to') ?? '') : Date.now();
    const from = q.has('from') ? Date.parse(q.get('from') ?? '') : to - DAY;
    let step = Number(q.get('step') ?? 60);
    if (Number.isNaN(to) || Number.isNaN(from)) return invalid('from and to must be RFC 3339');
    if (from >= to) return invalid('from must be before to');
    if (to - from > 30 * DAY) return invalid('the range is at most 30 days');
    if (!Number.isInteger(step) || step < 1 || step > 86_400)
      return invalid('step must be 1..86400');
    step = Math.max(step, Math.ceil((to - from) / 1000 / MAX_POINTS));
    return HttpResponse.json({
      sn: device.sn,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      step,
      points: buildSeries(device, from, to, step),
    });
  }),

  http.get<{ sn: string }>(api('/devices/:sn/history'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const device = db.devices.find((d) => d.sn === params.sn);
    if (!device) return errorJson(404, 'not_found', 'no such device');
    const q = new URL(request.url).searchParams;
    const limit = Math.min(Number(q.get('limit') ?? PAGE), 200);
    const start = q.has('cursor') ? Number(q.get('cursor')?.replace(/^o/, '')) : 0;
    if (!Number.isInteger(limit) || limit < 1) return invalid('limit must be at least 1');
    if (!Number.isInteger(start) || start < 0)
      return invalid('cursor is not one this API handed out');
    if (!db.history.has(device.sn)) db.history.set(device.sn, seedHistory(device));
    const all = db.history.get(device.sn) ?? [];
    const entries = all.slice(start, start + limit);
    const next = start + entries.length;
    return HttpResponse.json({
      entries,
      ...(next < all.length ? { next_cursor: `o${next}` } : {}),
    });
  }),
];
