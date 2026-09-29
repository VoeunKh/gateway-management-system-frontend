import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'preact/hooks';
import { Router } from 'wouter-preact';
import type { RouterProps } from 'wouter-preact';
import { createQueryClient } from './api/queryClient';
import { AppRoutes } from './app/router';
import { SessionProvider } from './auth/session';
import { ToastProvider } from './ui';

export interface AppProps {
  /** Tests pass a memory location; the browser uses the address bar. */
  router?: Omit<RouterProps, 'children'>;
}

export function App({ router }: AppProps) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <Router {...router}>
            <AppRoutes />
          </Router>
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
