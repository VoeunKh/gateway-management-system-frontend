export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off switch; the label always states what "on" means. */
export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label class="toggle">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span class="toggle__track" aria-hidden="true" />
      {label}
    </label>
  );
}
