import type { DeviceQuery, Schemas } from '@/api/endpoints';

type Health = Schemas['Health'];

export interface DeviceFilters {
  q?: string;
  model?: string;
  health?: Health;
  /** Only devices whose reported config differs from the target. */
  drift?: boolean;
}

export const HEALTH_OPTIONS: { value: Health; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
  { value: 'offline', label: 'Offline' },
];

const isHealth = (value: string | null): value is Health =>
  HEALTH_OPTIONS.some((option) => option.value === value);

/** Filters live in the query string so a view can be shared and survives reload. */
export function parseFilters(search: string): DeviceFilters {
  const params = new URLSearchParams(search);
  const health = params.get('health');
  return {
    q: params.get('q')?.trim() || undefined,
    model: params.get('model') || undefined,
    health: isHealth(health) ? health : undefined,
    drift: params.get('drift') === 'true' ? true : undefined,
  };
}

export function serializeFilters(filters: DeviceFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.model) params.set('model', filters.model);
  if (filters.health) params.set('health', filters.health);
  if (filters.drift) params.set('drift', 'true');
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function toDeviceQuery(filters: DeviceFilters): DeviceQuery {
  return { q: filters.q, model: filters.model, health: filters.health, drift: filters.drift };
}

export const hasFilters = (filters: DeviceFilters) =>
  Boolean(filters.q || filters.model || filters.health || filters.drift);

/** Human text for the active filters, e.g. `search "GW2", Offline, drifted only`. */
export function describeFilters(filters: DeviceFilters): string[] {
  const parts: string[] = [];
  if (filters.q) parts.push(`search "${filters.q}"`);
  if (filters.model) parts.push(`model ${filters.model}`);
  if (filters.health) {
    parts.push(HEALTH_OPTIONS.find((o) => o.value === filters.health)?.label ?? filters.health);
  }
  if (filters.drift) parts.push('drifted only');
  return parts;
}
