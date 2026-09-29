import { useQuery } from '@tanstack/react-query';
import { getOverview, listDevices, listRollouts } from '@/api/endpoints';
import type { Schemas } from '@/api/endpoints';
import { POLL_MS } from '@/api/polling';

const BOARD_PAGE = 200;

/** Fleet counts and the firmware mix, polled while the tab is visible. */
export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: getOverview,
    refetchInterval: POLL_MS.overview,
  });
}

async function allDevices(signal: AbortSignal): Promise<Schemas['Device'][]> {
  const devices: Schemas['Device'][] = [];
  let cursor: string | undefined;
  do {
    const page = await listDevices({ limit: BOARD_PAGE, cursor }, signal);
    devices.push(...page.devices);
    cursor = page.next_cursor;
  } while (cursor);
  return devices;
}

/** Every gateway for the fleet board; /overview carries counts only. */
export function useFleetBoard() {
  return useQuery({
    queryKey: ['overview', 'board'],
    queryFn: ({ signal }) => allDevices(signal),
    refetchInterval: POLL_MS.board,
  });
}

/** Active rollouts, fetched only while the overview counts any. */
export function useActiveRollouts(count: number) {
  return useQuery({
    queryKey: ['rollouts', 'active'],
    queryFn: () => listRollouts({ state: 'active' }),
    enabled: count > 0,
    refetchInterval: POLL_MS.rolloutsSummary,
  });
}
