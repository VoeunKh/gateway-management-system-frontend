import { Can } from '@/auth/guards';
import { formatDuration } from '@/lib/format';
import { Button, Card, ErrorState, JobStateBadge, Skeleton } from '@/ui';
import type { Schemas } from '@/api/endpoints';
import { ACTION_LABEL, isFinalJob, useCancelJob, useCreateAction, useJob } from '../useJob';
import { JobResult } from './JobResult';

type Job = Schemas['Job'];

function Elapsed({ job }: { job: Job }) {
  const end = job.finished_at ? Date.parse(job.finished_at) : Date.now();
  const seconds = Math.max(0, (end - Date.parse(job.created_at)) / 1000);
  return (
    <span class="muted">
      {isFinalJob(job) ? 'Took' : 'Running for'} {formatDuration(seconds)}
    </span>
  );
}

export interface JobPanelProps {
  jobId: string;
  /** A retry starts a new job; the panel follows it. */
  onStarted: (job: Job) => void;
  onClose: () => void;
}

/** The one place a job's state is shown on the device page (no toast repeats it). */
export function JobPanel({ jobId, onStarted, onClose }: JobPanelProps) {
  const job = useJob(jobId);
  const cancel = useCancelJob();
  const retry = useCreateAction(job.data?.sn ?? '', onStarted);

  if (job.isPending) {
    return (
      <Card title="Remote action">
        <Skeleton lines={2} label="Loading job" />
      </Card>
    );
  }
  if (job.isError) {
    return (
      <Card title="Remote action">
        <ErrorState message={job.error.message} onRetry={() => void job.refetch()} />
      </Card>
    );
  }
  const data = job.data;
  const final = isFinalJob(data);
  const failed = data.state === 'failed' || data.state === 'timed_out';
  return (
    <Card title={ACTION_LABEL[data.type]} aside={<JobStateBadge state={data.state} />}>
      <div class="job">
        <Elapsed job={data} />
        {data.progress !== null && (
          <div
            class="progress"
            role="progressbar"
            aria-label={`${ACTION_LABEL[data.type]} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={data.progress}
          >
            <span class="progress__fill" style={{ width: `${data.progress}%` }} />
          </div>
        )}
        <JobResult job={data} />
        <div class="job__actions">
          {data.state === 'pending' && (
            <Can perm="action">
              <Button loading={cancel.isPending} onClick={() => cancel.mutate(data)}>
                Cancel
              </Button>
            </Can>
          )}
          {failed && (
            <Can perm="action">
              <Button
                variant="primary"
                loading={retry.isPending}
                onClick={() => retry.mutate(data.type)}
              >
                Retry
              </Button>
            </Can>
          )}
          {final && (
            <Button variant="ghost" onClick={onClose}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
