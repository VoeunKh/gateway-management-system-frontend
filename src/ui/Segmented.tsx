import { useId } from 'preact/hooks';

export interface SegmentedOption {
  value: string;
  label: string;
  /** Tooltip, e.g. a model's full name. */
  title?: string;
}

export interface SegmentedProps {
  /** Names the group for screen readers; not shown. */
  legend: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}

/** A native radio group drawn as a segmented control, so arrow keys move between options. */
export function Segmented({ legend, options, value, onChange }: SegmentedProps) {
  const name = useId();
  return (
    <fieldset class="segmented">
      <legend class="sr-only">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} class="segmented__option" title={option.title}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
