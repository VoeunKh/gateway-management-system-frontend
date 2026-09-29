import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { useToast } from '@/ui';
import { ackAlert, listAlerts } from './endpoints';
import type { Schemas } from './endpoints';
import { POLL_MS } from './polling';

type Alert = Schemas['Alert'];

export const OPEN_ALERTS = ['alerts', 'open'] as const;
const OPEN_LIMIT = 200;

/**
 * Every open alert, newest first. The rail badge, the overview panel and the Alerts page all
 * read this one query, so their counts can never disagree. The rail polls it once a minute;
 * the Alerts page asks for 30 s while it is open.
 */
export function useOpenAlerts(intervalMs: number = POLL_MS.alertBadge) {
  return useQuery({
    queryKey: OPEN_ALERTS,
    queryFn: () => listAlerts({ state: 'open', limit: OPEN_LIMIT }),
    refetchInterval: intervalMs,
  });
}

/**
 * Acknowledge an alert. The row changes at once; if the server refuses, it is put back and a
 * toast says why. Toasts and cache work live in the hook's own options.
 */
export function useAckAlert() {
  const client = useQueryClient();
  const toast = useToast();
  const { user } = useSession();
  return useMutation({
    mutationFn: (alert: Alert) => ackAlert(alert.id),
    onMutate: async (alert) => {
      await client.cancelQueries({ queryKey: OPEN_ALERTS });
      const before = client.getQueryData<Alert[]>(OPEN_ALERTS);
      client.setQueryData<Alert[]>(OPEN_ALERTS, (list) =>
        list?.map((a) =>
          a.id === alert.id
            ? { ...a, acked_by: user?.name ?? null, acked_at: new Date().toISOString() }
            : a,
        ),
      );
      return { before };
    },
    onError: (error, alert, context) => {
      client.setQueryData(OPEN_ALERTS, context?.before);
      toast({ message: `Not acknowledged (${alert.sn}): ${error.message}`, tone: 'danger' });
    },
    onSuccess: (alert) => toast({ message: `Acknowledged the alert on ${alert.sn}`, tone: 'ok' }),
    onSettled: () => client.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
