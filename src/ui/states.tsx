import type { ComponentChildren } from 'preact';
import { Button } from './Button';
import { IconRefresh, IconSearch, IconWarning } from './icons';

export interface SkeletonProps {
  lines?: number;
  /** Announced to screen readers while content loads. */
  label?: string;
}

export function Skeleton({ lines = 3, label = 'Loading' }: SkeletonProps) {
  return (
    <div class="skeleton" role="status" aria-busy="true">
      <span class="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} class="skeleton__bar" aria-hidden="true" />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  children?: ComponentChildren;
  action?: ComponentChildren;
  icon?: ComponentChildren;
}

export function EmptyState({ title, children, action, icon }: EmptyStateProps) {
  return (
    <div class="state">
      <span class="state__icon">{icon ?? <IconSearch size={32} />}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry: () => void;
}

export function ErrorState({ title = "Couldn't load this", message, onRetry }: ErrorStateProps) {
  return (
    <div class="state state--error" role="alert">
      <span class="state__icon">
        <IconWarning size={32} />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      <Button icon={<IconRefresh />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
