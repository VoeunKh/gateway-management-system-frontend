import { useEffect, useRef, useState } from 'preact/hooks';
import { useModels } from '@/api/useModels';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Field, SelectField, Toggle } from '@/ui';
import { HEALTH_OPTIONS } from './filters';
import type { DeviceFilters } from './filters';

export const SEARCH_DEBOUNCE_MS = 300;

export interface DeviceFilterBarProps {
  filters: DeviceFilters;
  onChange: (next: DeviceFilters) => void;
}

export function DeviceFilterBar({ filters, onChange }: DeviceFilterBarProps) {
  const models = useModels();
  const [text, setText] = useState(filters.q ?? '');
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const latest = useRef({ filters, onChange });
  latest.current = { filters, onChange };
  // The q this box last wrote to the URL; any other q came from outside (chip, back button).
  const pushed = useRef(filters.q);

  useEffect(() => {
    const q = debounced || undefined;
    if (q === latest.current.filters.q) return;
    pushed.current = q;
    latest.current.onChange({ ...latest.current.filters, q });
  }, [debounced]);

  useEffect(() => {
    if (filters.q === pushed.current) return;
    pushed.current = filters.q;
    setText(filters.q ?? '');
  }, [filters.q]);

  const set = (patch: Partial<DeviceFilters>) => onChange({ ...filters, ...patch });

  return (
    <div class="filter-bar">
      <Field
        label="Search"
        type="search"
        placeholder="Serial number, site, MAC, IMEI or ICCID"
        value={text}
        onInput={(event) => setText(event.currentTarget.value)}
      />
      <SelectField
        label="Model"
        value={filters.model ?? ''}
        options={[
          { value: '', label: 'All models' },
          ...(models.data ?? []).map((m) => ({ value: m.id, label: m.name })),
        ]}
        onChange={(value) => set({ model: value || undefined })}
      />
      <SelectField
        label="Health"
        value={filters.health ?? ''}
        options={[{ value: '', label: 'Any health' }, ...HEALTH_OPTIONS]}
        onChange={(value) =>
          set({ health: HEALTH_OPTIONS.find((option) => option.value === value)?.value })
        }
      />
      <Toggle
        label="Drifted only"
        checked={Boolean(filters.drift)}
        onChange={(checked) => set({ drift: checked || undefined })}
      />
    </div>
  );
}
