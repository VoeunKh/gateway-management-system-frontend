import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getDeviceHistory, getDeviceMetrics, listRollouts } from '@/api/endpoints';
import { POLL_MS } from '@/api/polling';
import { RANGES } from './detail/trends';
import type { RangeKey } from './detail/trends';

/** A device's telemetry over `range`, ending now; refreshed every minute. */
export function useDeviceMetrics(sn: string, range: RangeKey) {
  const { hours, step } = RANGES[range];
  return useQuery({
    queryKey: ['device', sn, 'metrics', range],
    queryFn: () => {
      const to = Date.now();
      return getDeviceMetrics(sn, {
        from: new Date(to - hours * 3_600_000).toISOString(),
        to: new Date(to).toISOString(),
        step,
      });
    },
    refetchInterval: POLL_MS.metrics,
  });
}

/** Events and jobs, newest first, 50 at a time. */
export function useDeviceHistory(sn: string) {
  return useInfiniteQuery({
    queryKey: ['device', sn, 'history'],
    queryFn: ({ pageParam }) => getDeviceHistory(sn, { cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor,
  });
}

/** The rollout this gateway is part of right now, if any (draft: GET /rollouts?sn=). */
export function useDeviceRollout(sn: string) {
  return useQuery({
    queryKey: ['device', sn, 'rollout'],
    queryFn: () => listRollouts({ state: 'active', sn }),
    refetchInterval: POLL_MS.rollout,
    select: (rollouts) => rollouts[0] ?? null,
  });
}
