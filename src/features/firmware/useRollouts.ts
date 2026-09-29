import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRollout,
  getRollout,
  listRollouts,
  previewRollout,
  rolloutAction,
} from '@/api/endpoints';
import type { Schemas } from '@/api/endpoints';
import { POLL_MS } from '@/api/polling';
import { useToast } from '@/ui';

type Rollout = Schemas['Rollout'];
const LIVE: readonly Rollout['state'][] = ['running', 'soaking', 'paused'];

export const isLiveRollout = (r: Rollout | undefined) => r !== undefined && LIVE.includes(r.state);

/** Active rollouts are polled; finished ones never change, so they are fetched once. */
export function useRollouts(state: 'active' | 'finished') {
  return useQuery({
    queryKey: ['rollouts', state],
    queryFn: () => listRollouts({ state }),
    refetchInterval: state === 'active' ? POLL_MS.rollout : false,
  });
}

/** One rollout with every gateway of every wave; polled only while it is running, soaking or paused. */
export function useRollout(id: string) {
  return useQuery({
    queryKey: ['rollout', id],
    queryFn: () => getRollout(id),
    refetchInterval: (query) => (isLiveRollout(query.state.data) ? POLL_MS.rollout : false),
  });
}

/** What the request would do; refreshes as the form changes and keeps the last answer meanwhile. */
export function useRolloutPreview(request: Schemas['RolloutRequest'] | null) {
  return useQuery({
    queryKey: ['rollout-preview', request],
    queryFn: () => previewRollout(request as Schemas['RolloutRequest']),
    enabled: request !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

const refreshAll = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ['rollouts'] }),
    client.invalidateQueries({ queryKey: ['overview'] }),
    client.invalidateQueries({ queryKey: ['firmware'] }),
  ]);

/** Start a rollout. The toast lives in the hook's own options. */
export function useStartRollout() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (request: Schemas['RolloutRequest']) => createRollout(request),
    onSuccess: async (rollout) => {
      toast({
        message: `Started ${rollout.id}: ${rollout.model_id} to ${rollout.fw_version}`,
        tone: 'ok',
      });
      client.setQueryData(['rollout', rollout.id], rollout);
      await refreshAll(client);
    },
    onError: (error) => toast({ message: `Not started: ${error.message}`, tone: 'danger' }),
  });
}

/** Pause, resume or abort; the card updates from the response at once. */
export function useRolloutControl() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' | 'abort' }) =>
      rolloutAction(id, action),
    onSuccess: async (rollout, { action }) => {
      toast({
        message: `${rollout.id} ${action === 'abort' ? 'aborted' : `${action}d`}`,
        tone: 'ok',
      });
      client.setQueryData(['rollout', rollout.id], rollout);
      await refreshAll(client);
    },
    onError: (error) => toast({ message: error.message, tone: 'danger' }),
  });
}
