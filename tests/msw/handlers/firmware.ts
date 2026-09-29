import { HttpResponse, http } from 'msw';
import { denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { VALID_SIGNATURE, imageFileName } from '../fixtures/firmware';
import { api } from './api';

const sha256 = async (bytes: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const find = (id: string) => db.firmware.find((f) => f.id === id);
const noImage = () => errorJson(404, 'not_found', 'no such firmware image');

/** Draft endpoints (api/proposed.yaml): firmware images. */
export const firmwareHandlers = [
  http.get(api('/firmware'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const model = new URL(request.url).searchParams.get('model');
    const images = db.firmware.filter((f) => !model || f.model_id === model);
    return HttpResponse.json(
      images.map((f) => ({
        ...f,
        gateways: db.devices.filter((d) => d.model_id === f.model_id && d.fw_version === f.version)
          .length,
      })),
    );
  }),

  http.post(api('/firmware'), async ({ request }) => {
    const denied = denyUnless(request, 'release');
    if (denied) return denied;
    const form = await request.formData();
    const field = (name: string) => String(form.get(name) ?? '').trim();
    const image = form.get('image');
    const signature = form.get('signature');
    const [modelId, version, channel] = [field('model_id'), field('version'), field('channel')];
    if (
      !modelId ||
      !version ||
      !['stable', 'beta'].includes(channel) ||
      !(image instanceof File) ||
      !(signature instanceof File)
    ) {
      return errorJson(
        422,
        'validation_failed',
        'model, version, channel, image and signature are required',
      );
    }
    if (!db.models.some((m) => m.model.id === modelId))
      return errorJson(422, 'validation_failed', 'unknown model');
    if (db.firmware.some((f) => f.model_id === modelId && f.version === version)) {
      return errorJson(409, 'version_exists', `${modelId} ${version} already exists.`);
    }
    if (!(await signature.text()).startsWith(VALID_SIGNATURE)) {
      return errorJson(422, 'signature_invalid', 'The signature does not match the image.');
    }
    const created = {
      id: `fw-${modelId.toLowerCase()}-${version}`,
      model_id: modelId,
      version,
      channel: channel as 'stable' | 'beta',
      size: image.size,
      file_name: image.name || imageFileName(modelId, version),
      sha256: await sha256(await image.arrayBuffer()),
      gateways: 0,
      blocked: false,
      blocked_reason: null,
    };
    db.firmware.unshift(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post<{ id: string }, { reason?: string }>(
    api('/firmware/:id/block'),
    async ({ request, params }) => {
      const denied = denyUnless(request, 'release');
      if (denied) return denied;
      const image = find(params.id);
      if (!image) return noImage();
      const body = await request.json().catch(() => ({}) as { reason?: string });
      image.blocked = true;
      image.blocked_reason = body.reason?.trim() || null;
      return HttpResponse.json(image);
    },
  ),

  http.post<{ id: string }>(api('/firmware/:id/unblock'), ({ request, params }) => {
    const denied = denyUnless(request, 'release');
    if (denied) return denied;
    const image = find(params.id);
    if (!image) return noImage();
    image.blocked = false;
    image.blocked_reason = null;
    return HttpResponse.json(image);
  }),
];
