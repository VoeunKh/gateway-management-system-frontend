import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

export const GC_TIME_MS = 5 * 60_000;

/** GETs retry once, except on a 4xx (asking again cannot change the answer). */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: GC_TIME_MS,
        retry: shouldRetryQuery,
        refetchIntervalInBackground: false,
      },
      mutations: { retry: 0 },
    },
  });
}
