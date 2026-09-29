import type { components } from '@/api/types.gen';
import { MODELS, SITES, USERS, buildConfigVersions } from './fixtures/catalog';
import type { FixtureModel, FixtureUser } from './fixtures/catalog';
import { PACKAGES, buildDevices, expectedVersion } from './fixtures/devices';

type S = components['schemas'];

export interface MockDb {
  users: FixtureUser[];
  models: FixtureModel[];
  sites: S['Site'][];
  configs: Map<string, S['ConfigVersion'][]>;
  devices: S['DeviceDetail'][];
  manifests: Map<string, S['FirmwareManifest']>;
  /** access token -> user id */
  tokens: Map<string, string>;
  /** Stands in for the HttpOnly refresh cookie: whose session refresh would renew. */
  refreshUserId: string | null;
  tokenSerial: number;
}

export const manifestKey = (modelId: string, fw: string) => `${modelId}@${fw}`;

function fresh(): MockDb {
  const configs = buildConfigVersions();
  const targets = new Map(
    [...configs].map(([modelId, versions]) => [modelId, versions.at(-1)?.version ?? null]),
  );
  const manifests = new Map<string, S['FirmwareManifest']>();
  for (const { model, firmware } of MODELS) {
    for (const fw of firmware.filter((v) => v !== '2.0.4')) {
      manifests.set(manifestKey(model.id, fw), {
        model_id: model.id,
        fw_version: fw,
        packages: PACKAGES.map((name) => ({ name, version: expectedVersion(name, fw) })),
      });
    }
  }
  return {
    users: structuredClone(USERS),
    models: structuredClone(MODELS),
    sites: structuredClone(SITES),
    configs,
    devices: buildDevices(targets),
    manifests,
    tokens: new Map(),
    refreshUserId: null,
    tokenSerial: 0,
  };
}

/** Shared mock state. MSW handlers read and write it; tests reset it after each case. */
export const db: MockDb = fresh();

export function resetDb(): void {
  Object.assign(db, fresh());
}
