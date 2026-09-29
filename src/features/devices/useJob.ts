import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'preact/hooks';
import { cancelJob, createAction, getJob, getJobLogs } from '@/api/endpoints';
import type { Schemas } from '@/api/endpoints';
import { POLL_MS } from '@/api/polling';
import { FINAL_JOB_STATES, useToast } from '@/ui';

type Job = Schemas['Job'];

export const ACTION_LABEL: Record<Job['type'], string> = {
  reboot: 'Reboot',
  logs: 'Pull logs',
  ping: 'Ping test',
};

export const isFinalJob = (job: Job | undefined) =>
  job !== undefined && FINAL_JOB_STATES.includes(job.state);

/** The last 8 characters of the id: short enough to read out, unique enough to find. */
export const shortId = (id: string) => id.slice(-8);

/**
 * Starts an action. Toasts and `onStarted` live in the hook's own options, which always
 * run, rather than in per-call mutate() callbacks that TanStack skips when the component
 * has not subscribed yet.
 */
export function useCreateAction(sn: string, onStarted: (job: Job) => void) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (type: Job['type']) => createAction(sn, type),
    onSuccess: (job) => {
      // The panel starts from the job as created (pending, cancellable), not a refetch.
      client.setQueryData(['job', job.id], job);
      toast({ message: `${ACTION_LABEL[job.type]} started (job ${shortId(job.id)})`, tone: 'ok' });
      onStarted(job);
    },
    onError: (error) => toast({ message: error.message, tone: 'danger' }),
  });
}

/**
 * One job, polled every 3 s until it reaches a final state, never after. Each state change
 * refreshes the gateway (a reboot takes it offline and back) and its history.
 */
export function useJob(jobId: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    staleTime: POLL_MS.job,
    refetchInterval: (q) => (isFinalJob(q.state.data) ? false : POLL_MS.job),
  });
  const { sn, state } = query.data ?? {};
  useEffect(() => {
    if (sn && state) void client.invalidateQueries({ queryKey: ['device', sn] });
  }, [client, sn, state]);
  return query;
}

export function useCancelJob() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (job: Job) => cancelJob(job.id),
    onSuccess: (job) => client.setQueryData(['job', job.id], job),
    onError: (error) => toast({ message: `Not cancelled: ${error.message}`, tone: 'danger' }),
  });
}

/** Asks for the download link of a finished logs job and opens it. */
export function useDownloadLogs() {
  const toast = useToast();
  return useMutation({
    mutationFn: (job: Job) => getJobLogs(job.id),
    onSuccess: ({ url }) => void window.open(url, '_blank', 'noopener'),
    onError: (error) => toast({ message: `No download: ${error.message}`, tone: 'danger' }),
  });
}
