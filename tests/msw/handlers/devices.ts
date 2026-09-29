import { HttpResponse, http } from 'msw';
import type { components } from '@/api/types.gen';
import { denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { toListItem } from '../fixtures/devices';
import { api } from './api';

type S = components['schemas'];

const HEALTH: readonly string[] = ['healthy', 'warning', 'critical', 'offline'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (message: string) => errorJson(422, 'validation_failed', message);

function matchesQuery(device: S['DeviceDetail'], q: string): boolean {
  const needle = q.toLowerCase();
  return (
    device.sn.toLowerCase().startsWith(needle) ||
    device.site_name.toLowerCase().includes(needle) ||
    device.interfaces.some((hw) => hw.identifier.toLowerCase().includes(needle))
  );
}

export const deviceHandlers = [
  http.get(api('/devices'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const health = params.get('health');
    const site = params.get('site');
    const limit = Number(params.get('limit') ?? 50);
    if (health && !HEALTH.includes(health)) return invalid(`unknown health "${health}"`);
    if (site && !UUID.test(site)) return invalid('site must be a uuid');
    if (!Number.isInteger(limit) || limit < 1) return invalid('limit must be at least 1');

    const model = params.get('model');
    const drift = params.get('drift');
    const packageDrift = params.get('package_drift');
    const q = params.get('q');
    const cursor = params.get('cursor');
    const matching = db.devices.filter(
      (d) =>
        (!model || d.model_id === model) &&
        (!site || d.site_id === site) &&
        (!health || d.health === health) &&
        (drift === null || String(d.drift) === drift) &&
        (packageDrift === null || (d.package_drift === 'drift') === (packageDrift === 'true')) &&
        (!q || matchesQuery(d, q)) &&
        (!cursor || d.sn > cursor),
    );
    const page = matching.slice(0, Math.min(limit, 200));
    const last = page.at(-1);
    const body: S['DeviceList'] = { devices: page.map(toListItem) };
    if (last && matching.length > page.length) body.next_cursor = last.sn;
    return HttpResponse.json(body);
  }),

  http.get<{ sn: string }>(api('/devices/:sn'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const device = db.devices.find((candidate) => candidate.sn === params.sn);
    return device ? HttpResponse.json(device) : errorJson(404, 'not_found', 'no such device');
  }),

  http.patch<{ sn: string }, S['DevicePatch']>(api('/devices/:sn'), async ({ request, params }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const device = db.devices.find((candidate) => candidate.sn === params.sn);
    if (!device) return errorJson(404, 'not_found', 'no such device');
    const patch = await request.json();
    if (patch.site_id === undefined && patch.lifecycle === undefined) {
      return invalid('nothing to update');
    }
    if (patch.site_id !== undefined) {
      const newSite = patch.site_id === null ? null : db.sites.find((s) => s.id === patch.site_id);
      if (newSite === undefined) return invalid('site does not exist');
      device.site_id = newSite?.id ?? null;
      device.site_name = newSite?.name ?? '';
    }
    if (patch.lifecycle) device.lifecycle = patch.lifecycle;
    return HttpResponse.json(device);
  }),
];
