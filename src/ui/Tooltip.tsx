import type { ComponentChildren } from 'preact';

export interface TooltipProps {
  text: string;
  children: ComponentChildren;
}

/** Plain title tooltip; for disabled controls pass `title` to Button directly. */
export function Tooltip({ text, children }: TooltipProps) {
  return <span title={text}>{children}</span>;
}
