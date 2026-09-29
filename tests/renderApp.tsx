import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { Router } from 'wouter-preact';
import { memoryLocation } from 'wouter-preact/memory-location';
import { App } from '@/App';
import { createQueryClient } from '@/api/queryClient';
import { SessionProvider } from '@/auth/session';
import { ToastProvider } from '@/ui';

/** The whole app at `path`, with an in-memory address bar. */
export function renderApp(path = '/') {
  const location = memoryLocation({ path, record: true });
  const view = render(<App router={{ hook: location.hook }} />);
  return { ...view, currentPath: () => location.history.at(-1) };
}

/** Just the providers (session, toasts, query client, router) around `ui`. */
export function renderWithProviders(ui: ComponentChildren, path = '/') {
  const location = memoryLocation({ path, record: true });
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <SessionProvider>
          <Router hook={location.hook}>{ui}</Router>
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, currentPath: () => location.history.at(-1) };
}
