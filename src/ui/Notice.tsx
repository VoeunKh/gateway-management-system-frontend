import type { ComponentChildren } from 'preact';
import { IconWarning } from './icons';

export interface NoticeProps {
  tone: 'warn' | 'danger' | 'info';
  /** Short label read before the message, e.g. "Needs on-site recovery". */
  title: string;
  children?: ComponentChildren;
}

/** A page-level banner: icon, bold title and text, so colour never carries the meaning. */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div class={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <IconWarning size={18} />
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}
