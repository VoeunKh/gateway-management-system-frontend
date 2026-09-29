import { useId } from 'preact/hooks';
import type { Schemas } from '@/api/endpoints';

export interface ModelPickerProps {
  models: Schemas['Model'][];
  value: string;
  onChange: (modelId: string) => void;
}

/** Segmented control: a native radio group, so arrow keys move between models. */
export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  const name = useId();
  return (
    <fieldset class="segmented">
      <legend class="sr-only">Model</legend>
      {models.map((model) => (
        <label key={model.id} class="segmented__option" title={model.name}>
          <input
            type="radio"
            name={name}
            value={model.id}
            checked={model.id === value}
            onChange={() => onChange(model.id)}
          />
          <span>{model.id}</span>
        </label>
      ))}
    </fieldset>
  );
}
