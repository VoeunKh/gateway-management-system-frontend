import type { Schemas } from '@/api/endpoints';
import { Segmented } from './Segmented';

export interface ModelPickerProps {
  models: Schemas['Model'][];
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  return (
    <Segmented
      legend="Model"
      value={value}
      onChange={onChange}
      options={models.map((model) => ({ value: model.id, label: model.id, title: model.name }))}
    />
  );
}
