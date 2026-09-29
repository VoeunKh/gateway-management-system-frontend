import type { ComponentChildren } from 'preact';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
export const TONES: readonly Tone[] = ['ok', 'warn', 'danger', 'info', 'neutral'];

export interface BadgeProps {
  tone: Tone;
  /** The label is required: colour never carries meaning alone. */
  children: ComponentChildren;
}

export function Badge({ tone, children }: BadgeProps) {
  return <span class={`badge badge--${tone}`}>{children}</span>;
}
