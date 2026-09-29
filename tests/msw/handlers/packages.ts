import { HttpResponse, http } from 'msw';
import type { components } from '@/api/types.gen';
import { denyUnless, errorJson } from '../auth';
import { db, manifestKey } from '../db';
import { api } from './api';

type S = components['schemas'];
type FleetPackage = S['FleetPackages']['packages'][number];
type ManifestParams = { id: string; version: string };

function fleetPackages(modelId: string): S['FleetPackages'] {
  const devices = db.devices.filter((device) => device.model_id === modelId);
  const byName = new Map<string, FleetPackage>();
  for (const device of devices) {
    const fw = device.fw_version ?? '';
    for (const pkg of device.packages) {
      const entry = byName.get(pkg.name) ?? { name: pkg.name, expected: [], installed: [] };
      byName.set(pkg.name, entry);
      if (pkg.expected && !entry.expected.some((e) => e.fw_version === fw)) {
        entry.expected.push({ fw_version: fw, version: pkg.expected });
      }
      const row = entry.installed.find((r) => r.fw_version === fw && r.version === pkg.version);
      if (row) row.devices++;
      else
        entry.installed.push({
          fw_version: fw,
          version: pkg.version,
          devices: 1,
          status: pkg.status,
        });
    }
  }
  return { model_id: modelId, packages: [...byName.values()] };
}

export const packageHandlers = [
  http.get<{ id: string }>(api('/models/:id/packages'), ({ request, params }) => {
    return denyUnless(request) ?? HttpResponse.json(fleetPackages(params.id));
  }),

  http.get<ManifestParams>(api('/models/:id/firmware/:version/manifest'), ({ request, params }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const manifest = db.manifests.get(manifestKey(params.id, params.version));
    return manifest ? HttpResponse.json(manifest) : errorJson(404, 'not_found', 'no manifest');
  }),

  http.post<ManifestParams>(
    api('/models/:id/firmware/:version/manifest'),
    async ({ request, params }) => {
      const denied = denyUnless(request, 'release');
      if (denied) return denied;
      if (!db.models.some((entry) => entry.model.id === params.id)) {
        return errorJson(404, 'not_found', 'no such model');
      }
      const key = manifestKey(params.id, params.version);
      if (db.manifests.has(key)) return errorJson(409, 'conflict', 'manifest already recorded');
      const lines = (await request.text()).split('\n').filter((line) => line.trim());
      const packages = lines.map((line) => line.split(' - '));
      if (packages.some((parts) => parts.length !== 2)) {
        return errorJson(422, 'validation_failed', 'each line must be "<name> - <version>"');
      }
      db.manifests.set(key, {
        model_id: params.id,
        fw_version: params.version,
        packages: packages.map(([name = '', version = '']) => ({ name, version })),
      });
      const created: S['FirmwareManifestCreated'] = {
        model_id: params.id,
        fw_version: params.version,
        packages: packages.length,
      };
      return HttpResponse.json(created, { status: 201 });
    },
  ),
];
