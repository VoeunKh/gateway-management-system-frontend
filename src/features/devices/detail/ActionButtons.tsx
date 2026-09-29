import { useState } from 'preact/hooks';
import type { DeviceView, Schemas } from '@/api/endpoints';
import { Can } from '@/auth/guards';
import { Button, IconPlay, IconRefresh, IconUpload } from '@/ui';
import { useCreateAction } from '../useJob';
import { RebootDialog } from './RebootDialog';

/** Why actions can't run on this gateway right now, or undefined when they can. */
export function unavailableReason(device: DeviceView): string | undefined {
  if (device.lifecycle === 'bricked') return 'This gateway needs on-site recovery';
  if (device.lifecycle === 'decommissioned') return 'This gateway is decommissioned';
  return device.online ? undefined : 'The gateway is offline';
}

export interface ActionButtonsProps {
  device: DeviceView;
  onStarted: (job: Schemas['Job']) => void;
}

/** Reboot (confirmed by typing the SN), Pull logs and Run ping: admin only, online gateways. */
export function ActionButtons({ device, onStarted }: ActionButtonsProps) {
  const create = useCreateAction(device.sn, onStarted);
  const [confirming, setConfirming] = useState(false);
  const reason = unavailableReason(device);
  const busy = (type: Schemas['JobType']) => create.isPending && create.variables === type;

  return (
    <div class="actions" role="group" aria-label="Remote actions">
      <Can perm="action">
        <Button
          icon={<IconRefresh />}
          disabled={Boolean(reason)}
          title={reason}
          onClick={() => setConfirming(true)}
        >
          Reboot
        </Button>
      </Can>
      <Can perm="action">
        <Button
          icon={<IconUpload />}
          disabled={Boolean(reason)}
          title={reason}
          loading={busy('logs')}
          onClick={() => create.mutate('logs')}
        >
          Pull logs
        </Button>
      </Can>
      <Can perm="action">
        <Button
          icon={<IconPlay />}
          disabled={Boolean(reason)}
          title={reason}
          loading={busy('ping')}
          onClick={() => create.mutate('ping')}
        >
          Run ping test
        </Button>
      </Can>
      <RebootDialog
        open={confirming}
        sn={device.sn}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          create.mutate('reboot');
        }}
      />
    </div>
  );
}
