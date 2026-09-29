import { ApiError } from './errors';
import { POLL_MS } from './polling';
import { GC_TIME_MS, createQueryClient, shouldRetryQuery } from './queryClient';

describe('query client', () => {
  it('keeps data 5 minutes, never polls in the background and never retries writes', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(GC_TIME_MS).toBe(300_000);
    expect(defaults.queries?.gcTime).toBe(GC_TIME_MS);
    expect(defaults.queries?.refetchIntervalInBackground).toBe(false);
    expect(defaults.mutations?.retry).toBe(0);
  });

  it('retries a failed GET once, but not a 4xx', () => {
    const serverError = new ApiError(503, 'http_503', 'down');
    expect(shouldRetryQuery(0, serverError)).toBe(true);
    expect(shouldRetryQuery(1, serverError)).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(0, 'network_error', 'offline'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(404, 'not_found', 'gone'))).toBe(false);
  });

  it('keeps every polling interval in one table', () => {
    expect(POLL_MS).toEqual({
      rollout: 5_000,
      job: 3_000,
      overview: 30_000,
      board: 60_000,
      alerts: 30_000,
      devices: 30_000,
      metrics: 60_000,
    });
  });
});
