import { HttpResponse, http } from 'msw';
import type { components } from '@/api/types.gen';
import { denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { api } from './api';

type S = components['schemas'];

export const catalogHandlers = [
  http.get(api('/models'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const models: S['Model'][] = db.models.map((entry) => entry.model);
    return HttpResponse.json(models);
  }),

  http.post<never, S['CreateModelRequest']>(api('/models'), async ({ request }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const model = await request.json();
    if (db.models.some((entry) => entry.model.id === model.id)) {
      return errorJson(409, 'conflict', 'model id already exists');
    }
    db.models.push({ model, firmware: [] });
    db.configs.set(model.id, []);
    return HttpResponse.json(model, { status: 201 });
  }),

  http.patch<{ id: string }, S['UpdateModelRequest']>(
    api('/models/:id'),
    async ({ request, params }) => {
      const denied = denyUnless(request, 'admin');
      if (denied) return denied;
      const entry = db.models.find((candidate) => candidate.model.id === params.id);
      if (!entry) return errorJson(404, 'not_found', 'no such model');
      entry.model.name = (await request.json()).name;
      return HttpResponse.json(entry.model);
    },
  ),

  http.get(api('/sites'), ({ request }) => denyUnless(request) ?? HttpResponse.json(db.sites)),

  http.post<never, S['SiteRequest']>(api('/sites'), async ({ request }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const site: S['Site'] = { id: crypto.randomUUID(), ...(await request.json()) };
    db.sites.push(site);
    return HttpResponse.json(site, { status: 201 });
  }),

  http.patch<{ id: string }, S['SiteRequest']>(api('/sites/:id'), async ({ request, params }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const site = db.sites.find((candidate) => candidate.id === params.id);
    if (!site) return errorJson(404, 'not_found', 'no such site');
    Object.assign(site, await request.json());
    return HttpResponse.json(site);
  }),
];
