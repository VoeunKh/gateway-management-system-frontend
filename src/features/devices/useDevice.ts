import { useQuery } from '@tanstack/react-query';
import { getDevice, getRenderedConfig } from '@/api/endpoints';
import { POLL_MS } from '@/api/polling';

/**
 * One gateway with its interfaces, packages and newest metrics sample. The metrics come
 * with the device, so the device polls at the metrics interval.
 */
export function useDevice(sn: string) {
  return useQuery({
    queryKey: ['device', sn],
    queryFn: () => getDevice(sn),
    refetchInterval: POLL_MS.metrics,
  });
}

/** The model's latest config rendered for this device, secrets already masked by the server. */
export function useRenderedConfig(sn: string, cfgHash: string | undefined) {
  return useQuery({
    // A new reported hash means the config changed, so it is part of the key.
    queryKey: ['device', sn, 'rendered-config', cfgHash],
    queryFn: () => getRenderedConfig(sn),
  });
}
