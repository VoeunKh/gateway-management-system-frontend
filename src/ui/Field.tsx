import type { JSX, Ref } from 'preact';
import { useId } from 'preact/hooks';

type InputAttrs = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'class' | 'className' | 'ref'
>;

export interface FieldProps extends InputAttrs {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  /** Reaches the <input> (a plain `ref` on a function component would not). */
  inputRef?: Ref<HTMLInputElement>;
}

export function Field({ label, hint, error, id, inputRef, ...input }: FieldProps) {
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
        ref={inputRef}
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
