import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { listDevices } from '@/api/endpoints';
import { POLL_MS } from '@/api/polling';
import { toDeviceQuery } from './filters';
import type { DeviceFilters } from './filters';

export const DEVICE_PAGE_SIZE = 100;

/** The fleet list, 100 rows a page; "Load more" follows next_cursor. */
export function useDevices(filters: DeviceFilters) {
  const query = useInfiniteQuery({
    queryKey: ['devices', filters],
    queryFn: ({ pageParam, signal }) =>
      listDevices(
        { ...toDeviceQuery(filters), limit: DEVICE_PAGE_SIZE, cursor: pageParam },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor,
    // Keep showing the previous result while a new search loads, so the table doesn't flash.
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS.devices,
  });
  const devices = query.data?.pages.flatMap((page) => page.devices) ?? [];
  return { ...query, devices };
}
