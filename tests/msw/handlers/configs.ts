import { HttpResponse, http } from 'msw';
import type { components } from '@/api/types.gen';
import { currentUser, denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { pushTargets, startPush } from '../fixtures/pushes';
import { firstInvalidLine, lineDiff, renderTemplate } from '../fixtures/uci';
import { api } from './api';
import { packageHandlers } from './packages';

type S = components['schemas'];
type ModelParams = { id: string };
type VersionParams = { id: string; v: string };

const versionsOf = (modelId: string) => db.configs.get(modelId);
const noModel = () => errorJson(404, 'not_found', 'no such model');

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const findVersion = (modelId: string, v: string) =>
  versionsOf(modelId)?.find((entry) => entry.version === Number(v));

export const configHandlers = [
  // Draft endpoints (api/proposed.yaml): config push.
  http.post<VersionParams>(api('/models/:id/configs/:v/push/preview'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    if (!versionsOf(params.id)) return noModel();
    if (!findVersion(params.id, params.v)) return errorJson(404, 'not_found', 'no such version');
    const targets = pushTargets(params.id);
    return HttpResponse.json({
      gateways: targets.length,
      offline: targets.filter((d) => !d.online).length,
    });
  }),

  http.post<VersionParams>(api('/models/:id/configs/:v/push'), ({ request, params }) => {
    const denied = denyUnless(request, 'release');
    if (denied) return denied;
    if (!versionsOf(params.id)) return noModel();
    if (!findVersion(params.id, params.v)) return errorJson(404, 'not_found', 'no such version');
    return HttpResponse.json({ jobs: startPush(params.id, Number(params.v)) }, { status: 202 });
  }),

  http.get<ModelParams>(api('/models/:id/configs'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const versions = versionsOf(params.id);
    return versions ? HttpResponse.json([...versions].reverse()) : noModel();
  }),

  http.post<ModelParams, S['CreateConfigVersionRequest']>(
    api('/models/:id/configs'),
    async ({ request, params }) => {
      const denied = denyUnless(request, 'release');
      if (denied) return denied;
      const versions = versionsOf(params.id);
      if (!versions) return noModel();
      const body = await request.json();
      if (!body.note?.trim()) return errorJson(422, 'validation_failed', 'note is required');
      const line = firstInvalidLine(body.text);
      if (line !== null) {
        return errorJson(422, 'config_invalid', `line ${line} is not valid UCI`, { line });
      }
      if (versions.at(-1)?.text === body.text) {
        return errorJson(409, 'conflict', 'text is identical to the latest version');
      }
      const created: S['ConfigVersion'] = {
        version: (versions.at(-1)?.version ?? 0) + 1,
        text: body.text,
        note: body.note,
        created_by: currentUser(request)?.id,
        created_at: new Date().toISOString(),
      };
      versions.push(created);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.get<VersionParams>(api('/models/:id/configs/:v'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const found = versionsOf(params.id)?.find((cv) => cv.version === Number(params.v));
    return found ? HttpResponse.json(found) : errorJson(404, 'not_found', 'no such version');
  }),

  http.get<VersionParams>(api('/models/:id/configs/:v/diff'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const against = new URL(request.url).searchParams.get('against');
    if (!against) return errorJson(400, 'bad_request', 'against is required');
    const versions = versionsOf(params.id) ?? [];
    const to = versions.find((cv) => cv.version === Number(params.v));
    const from = versions.find((cv) => cv.version === Number(against));
    if (!to || !from) return errorJson(404, 'not_found', 'no such version');
    return HttpResponse.json(lineDiff(from.text, to.text));
  }),

  http.get<{ sn: string }>(api('/devices/:sn/config/rendered'), async ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const device = db.devices.find((candidate) => candidate.sn === params.sn);
    const latest = device ? versionsOf(device.model_id)?.at(-1) : undefined;
    if (!device || !latest) return errorJson(404, 'not_found', 'no config for this device');
    const site = db.sites.find((candidate) => candidate.id === device.site_id);
    const vars: Record<string, string> = { 'device.sn': device.sn };
    for (const [key, value] of Object.entries(site?.vars ?? {})) vars[`site.${key}`] = value;
    const { rendered, missing } = renderTemplate(latest.text, vars);
    if (missing.length) {
      return errorJson(422, 'config_incomplete', 'config references unset variables', {
        missing,
      });
    }
    const body: S['RenderedConfig'] = { text: rendered, hash: await sha256(rendered) };
    return HttpResponse.json(body);
  }),

  ...packageHandlers,
];
