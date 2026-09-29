import type { Schemas } from '@/api/endpoints';
import { Notice, ROLLOUT_DEVICE_LABEL } from '@/ui';
import { useDeviceRollout } from '../useDeviceTelemetry';

type Progress = { state: Schemas['RolloutDeviceState']; progress?: number | null };

const own = (rollout: Schemas['Rollout'], sn: string): Progress | undefined =>
  rollout.waves.flatMap((wave) => wave.devices ?? []).find((device) => device.sn === sn);

const TONE: Record<Schemas['RolloutDeviceState'], 'info' | 'warn' | 'danger'> = {
  waiting: 'info',
  downloading: 'info',
  installing: 'info',
  updated: 'info',
  rolled_back: 'warn',
  needs_recovery: 'danger',
  skipped: 'warn',
  deferred: 'warn',
};

/** "In rollout R-014: Downloading firmware 42%", from the draft GET /rollouts?sn=. */
export function RolloutBanner({ sn }: { sn: string }) {
  const rollout = useDeviceRollout(sn).data;
  const mine = rollout ? own(rollout, sn) : undefined;
  if (!rollout || !mine) return null;
  const percent = mine.state === 'downloading' && mine.progress != null ? ` ${mine.progress}%` : '';
  return (
    <Notice tone={TONE[mine.state]} title={`In rollout ${rollout.id}`}>
      {ROLLOUT_DEVICE_LABEL[mine.state]}
      {percent} · target firmware {rollout.fw_version}
    </Notice>
  );
}
