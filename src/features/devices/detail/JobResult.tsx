import type { Schemas } from '@/api/endpoints';
import { Button, IconUpload } from '@/ui';
import { useDownloadLogs } from '../useJob';

/** What the job produced: a ping line, a logs download, reboot progress or the error. */
export function JobResult({ job }: { job: Schemas['Job'] }) {
  const download = useDownloadLogs();
  if (job.error) {
    return (
      <p class="job__error" role="alert">
        <strong class="mono">{job.error.code}</strong> {job.error.message}
      </p>
    );
  }
  if (job.type === 'ping' && job.detail) return <p>{job.detail}</p>;
  if (job.type === 'reboot' && job.state === 'running') return <p>Gateway is rebooting.</p>;
  if (job.type === 'reboot' && job.state === 'succeeded') {
    return <p>The gateway rebooted and is back online.</p>;
  }
  if (job.type === 'logs' && job.state === 'succeeded') {
    return (
      <div>
        <Button
          icon={<IconUpload />}
          loading={download.isPending}
          onClick={() => download.mutate(job)}
        >
          Download logs
        </Button>
      </div>
    );
  }
  return null;
}
