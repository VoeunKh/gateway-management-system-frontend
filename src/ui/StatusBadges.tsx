import type { Schemas } from '@/api/endpoints';
import { Badge } from './Badge';
import type { Tone } from './Badge';

type Label = { tone: Tone; label: string };

const ROLLOUT: Record<Schemas['RolloutState'], Label> = {
  running: { tone: 'info', label: 'Running' },
  soaking: { tone: 'info', label: 'Soaking' },
  paused: { tone: 'warn', label: 'Paused' },
  completed: { tone: 'ok', label: 'Completed' },
  aborted: { tone: 'danger', label: 'Aborted' },
};

const SEVERITY: Record<Schemas['AlertSeverity'], Label> = {
  info: { tone: 'info', label: 'Info' },
  warning: { tone: 'warn', label: 'Warning' },
  critical: { tone: 'danger', label: 'Critical' },
};

const PACKAGE: Record<Schemas['PackageStatus']['status'], Label> = {
  ok: { tone: 'ok', label: 'Matches' },
  drift: { tone: 'warn', label: 'Differs' },
  not_in_manifest: { tone: 'neutral', label: 'Not in manifest' },
  unknown: { tone: 'neutral', label: 'Unknown' },
};

export function PackageStatusBadge({ status }: { status: Schemas['PackageStatus']['status'] }) {
  const { tone, label } = PACKAGE[status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** What a gateway is doing inside a rollout, in words. */
export const ROLLOUT_DEVICE_LABEL: Record<Schemas['RolloutDeviceState'], string> = {
  waiting: 'Waiting for its wave',
  downloading: 'Downloading firmware',
  installing: 'Installing',
  updated: 'Updated',
  rolled_back: 'Rolled back',
  needs_recovery: 'Needs on-site recovery',
  skipped: 'Skipped by pre-check',
  deferred: 'Offline, deferred',
};

const JOB: Record<Schemas['JobState'], Label> = {
  pending: { tone: 'neutral', label: 'Pending' },
  running: { tone: 'info', label: 'Running' },
  succeeded: { tone: 'ok', label: 'Succeeded' },
  failed: { tone: 'danger', label: 'Failed' },
  timed_out: { tone: 'danger', label: 'Timed out' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

/** Job states the API will not change again; polling stops on these. */
export const FINAL_JOB_STATES: readonly Schemas['JobState'][] = [
  'succeeded',
  'failed',
  'timed_out',
  'cancelled',
];

export function JobStateBadge({ state }: { state: string }) {
  const known = JOB[state as Schemas['JobState']];
  return <Badge tone={known?.tone ?? 'neutral'}>{known?.label ?? state}</Badge>;
}

export function RolloutStateBadge({ state }: { state: Schemas['RolloutState'] }) {
  const { tone, label } = ROLLOUT[state];
  return <Badge tone={tone}>{label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Schemas['AlertSeverity'] }) {
  const { tone, label } = SEVERITY[severity];
  return <Badge tone={tone}>{label}</Badge>;
}
