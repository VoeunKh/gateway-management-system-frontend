import { Button } from '@/ui';
import { HEALTH_OPTIONS } from './filters';
import type { DeviceFilters } from './filters';

interface Chip {
  key: keyof DeviceFilters;
  label: string;
}

function chipsFor(filters: DeviceFilters): Chip[] {
  const chips: Chip[] = [];
  if (filters.q) chips.push({ key: 'q', label: `Search: ${filters.q}` });
  if (filters.model) chips.push({ key: 'model', label: `Model: ${filters.model}` });
  if (filters.health) {
    const health = HEALTH_OPTIONS.find((o) => o.value === filters.health)?.label;
    chips.push({ key: 'health', label: `Health: ${health ?? filters.health}` });
  }
  if (filters.drift) chips.push({ key: 'drift', label: 'Drifted only' });
  return chips;
}

export interface FilterChipsProps {
  filters: DeviceFilters;
  onChange: (next: DeviceFilters) => void;
}

/** One removable chip per active filter, plus Clear filters. */
export function FilterChips({ filters, onChange }: FilterChipsProps) {
  const chips = chipsFor(filters);
  if (chips.length === 0) return null;
  return (
    <ul class="chips" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Button
            size="sm"
            aria-label={`Remove filter ${chip.label}`}
            onClick={() => onChange({ ...filters, [chip.key]: undefined })}
          >
            {chip.label} <span aria-hidden="true">×</span>
          </Button>
        </li>
      ))}
      <li>
        <Button size="sm" variant="ghost" onClick={() => onChange({})}>
          Clear filters
        </Button>
      </li>
    </ul>
  );
}
