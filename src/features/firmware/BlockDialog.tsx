import { useState } from 'preact/hooks';
import type { Schemas } from '@/api/endpoints';
import { Button, Dialog, Field } from '@/ui';
import { useBlockFirmware } from './useFirmware';

export interface BlockDialogProps {
  image: Schemas['FirmwareImage'] | null;
  onClose: () => void;
}

/** Blocking keeps an image out of new rollouts; running ones are not touched. */
export function BlockDialog({ image, onClose }: BlockDialogProps) {
  const [reason, setReason] = useState('');
  const close = () => {
    setReason('');
    onClose();
  };
  const block = useBlockFirmware(close);
  return (
    <Dialog
      open={image !== null}
      onClose={close}
      title={`Block ${image?.model_id ?? ''} ${image?.version ?? ''}?`}
      actions={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="danger"
            loading={block.isPending}
            onClick={() => image && block.mutate({ image, reason: reason.trim() || undefined })}
          >
            Block
          </Button>
        </>
      }
    >
      <p>
        It can't be picked for new rollouts until someone unblocks it. Rollouts already running keep
        going.
      </p>
      <Field
        label="Reason (shown to the team)"
        value={reason}
        placeholder="For example: boot loop on revision B1"
        onInput={(event) => setReason(event.currentTarget.value)}
      />
    </Dialog>
  );
}
