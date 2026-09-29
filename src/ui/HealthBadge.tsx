import type { components } from '@/api/types.gen';
import { Badge } from './Badge';
import type { Tone } from './Badge';

type Health = components['schemas']['Health'];

const HEALTH: Record<Health, { tone: Tone; label: string }> = {
  healthy: { tone: 'ok', label: 'Healthy' },
  warning: { tone: 'warn', label: 'Warning' },
  critical: { tone: 'danger', label: 'Critical' },
  offline: { tone: 'neutral', label: 'Offline' },
};

/** Dot plus label: colour never carries the state alone. */
export function HealthBadge({ health }: { health: Health }) {
  const { tone, label } = HEALTH[health];
  return <Badge tone={tone}>{label}</Badge>;
}
