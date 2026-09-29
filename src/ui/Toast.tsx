import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { IconCheck, IconWarning } from './icons';

export type ToastTone = 'ok' | 'danger' | 'info' | 'neutral';

export interface ToastInput {
  message: string;
  tone?: ToastTone;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export const TOAST_LIMIT = 3;
export const TOAST_TIMEOUT_MS = 5000;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'ok') return <IconCheck title="Success" />;
  if (tone === 'danger') return <IconWarning title="Error" />;
  return null;
}

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    ({ message, tone = 'neutral' }: ToastInput) => {
      const id = ++nextId.current;
      // Oldest toasts drop off once more than TOAST_LIMIT are queued.
      setItems((list) => [...list, { id, message, tone }].slice(-TOAST_LIMIT));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_TIMEOUT_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div class="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} class={`toast toast--${item.tone}`}>
            <ToastIcon tone={item.tone} />
            <span>{item.message}</span>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
