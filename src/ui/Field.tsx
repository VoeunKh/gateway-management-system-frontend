import type { JSX } from 'preact';
import { useId } from 'preact/hooks';

type InputAttrs = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'id' | 'class' | 'className'>;

export interface FieldProps extends InputAttrs {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

export function Field({ label, hint, error, id, ...input }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div class="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...input}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <span id={hintId} class="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} class="field__error">
          {error}
        </span>
      )}
    </div>
  );
}
