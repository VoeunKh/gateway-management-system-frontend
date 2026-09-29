import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createConfigVersion,
  diffConfigVersions,
  listConfigVersions,
  listDevices,
} from '@/api/endpoints';
import type { Schemas } from '@/api/endpoints';

/** Versions of a model's config, newest first. */
export function useConfigVersions(modelId: string | undefined) {
  return useQuery({
    queryKey: ['config-versions', modelId],
    queryFn: () => listConfigVersions(modelId ?? ''),
    enabled: Boolean(modelId),
  });
}

/** Line diff of `version` against the one before it; none for version 1. */
export function useVersionDiff(modelId: string, version: number | undefined) {
  return useQuery({
    queryKey: ['config-diff', modelId, version],
    queryFn: () => diffConfigVersions(modelId, version ?? 0, (version ?? 0) - 1),
    enabled: version !== undefined && version > 1,
  });
}

export function useCreateVersion(modelId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['CreateConfigVersionRequest']) => createConfigVersion(modelId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['config-versions', modelId] }),
  });
}

export interface ModelFleet {
  /** The version the model's gateways are told to run; null until something is pushed. */
  target: number | null;
  total: number;
  inSync: number;
  drifted: number;
  notReported: number;
}

export function summarizeFleet(devices: Schemas['Device'][]): ModelFleet {
  const target = devices.find((d) => d.target_cfg_version != null)?.target_cfg_version ?? null;
  const notReported = devices.filter((d) => d.cfg_version == null).length;
  const drifted = devices.filter((d) => d.cfg_version != null && d.drift).length;
  return {
    target,
    total: devices.length,
    inSync: devices.length - drifted - notReported,
    drifted,
    notReported,
  };
}

/**
 * Target version and sync counts for one model. The API has no summary endpoint, so this
 * pages through the model's devices (about 60 per model, one or two requests).
 */
export function useModelFleet(modelId: string | undefined) {
  return useQuery({
    queryKey: ['model-fleet', modelId],
    enabled: Boolean(modelId),
    queryFn: async ({ signal }) => {
      const devices: Schemas['Device'][] = [];
      let cursor: string | undefined;
      do {
        const page = await listDevices({ model: modelId, limit: 200, cursor }, signal);
        devices.push(...page.devices);
        cursor = page.next_cursor;
      } while (cursor);
      return summarizeFleet(devices);
    },
  });
}
