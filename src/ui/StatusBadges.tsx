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

export function RolloutStateBadge({ state }: { state: Schemas['RolloutState'] }) {
  const { tone, label } = ROLLOUT[state];
  return <Badge tone={tone}>{label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Schemas['AlertSeverity'] }) {
  const { tone, label } = SEVERITY[severity];
  return <Badge tone={tone}>{label}</Badge>;
}
