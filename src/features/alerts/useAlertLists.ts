import { useQuery } from '@tanstack/react-query';
import { listAlertRules, listAlerts } from '@/api/endpoints';

const RESOLVED_LIMIT = 15;

/** The most recently resolved alerts. They do not change, so no polling. */
export function useResolvedAlerts() {
  return useQuery({
    queryKey: ['alerts', 'resolved', RESOLVED_LIMIT],
    queryFn: () => listAlerts({ state: 'resolved', limit: RESOLVED_LIMIT }),
  });
}

/** The fixed v1 rules, for reference. Ten minutes fresh: they change with a release. */
export function useAlertRules() {
  return useQuery({
    queryKey: ['alerts', 'rules'],
    queryFn: listAlertRules,
    staleTime: 10 * 60_000,
  });
}
