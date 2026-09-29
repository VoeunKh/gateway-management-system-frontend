import type { ComponentChildren, JSX } from 'preact';
import { useId, useLayoutEffect, useRef } from 'preact/hooks';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
  /** Footer buttons, right-aligned. */
  actions?: ComponentChildren;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/**
 * Native modal <dialog>. Focus moves to the first control on open, Tab wraps inside
 * the dialog, Escape closes, and focus returns to whatever opened it.
 */
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Layout effect: close and restore focus in the same commit that removes the content.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    (focusables(dialog)[0] ?? dialog).focus();

    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      trigger?.focus();
    };
  }, [open]);

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(event.currentTarget);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div class="dialog__body">
          <h2 id={titleId}>{title}</h2>
          {children}
          {actions && <div class="dialog__actions">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
