import type { ComponentChildren, JSX } from 'preact';
import { cx } from '@/lib/cx';

type ButtonAttrs = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'className'>;

export interface ButtonProps extends ButtonAttrs {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  /** Shows a spinner and blocks clicks while an action runs. */
  loading?: boolean;
  icon?: ComponentChildren;
  class?: string;
}

/**
 * A disabled button stays focusable (aria-disabled, not the disabled attribute) so
 * keyboard users can reach it and hear why it is disabled from its title.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  type = 'button',
  class: className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const blocked = Boolean(disabled) || loading;
  const handleClick = (event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      class={cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', className)}
      aria-disabled={blocked ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      onClick={handleClick}
    >
      {loading ? <span class="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
