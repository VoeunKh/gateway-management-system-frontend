import { useState } from 'preact/hooks';
import { Button, Dialog, Field } from '@/ui';

export interface RebootDialogProps {
  open: boolean;
  sn: string;
  onClose: () => void;
  onConfirm: () => void;
}

/** A reboot drops the gateway offline, so the serial number must be typed to confirm. */
export function RebootDialog({ open, sn, onClose, onConfirm }: RebootDialogProps) {
  const [typed, setTyped] = useState('');
  const close = () => {
    setTyped('');
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Reboot ${sn}?`}
      actions={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="danger"
            disabled={typed !== sn}
            title={typed === sn ? undefined : 'Type the serial number to enable'}
            onClick={() => {
              setTyped('');
              onConfirm();
            }}
          >
            Reboot
          </Button>
        </>
      }
    >
      <p>
        The gateway goes offline for a minute or two while it restarts. Anything it is doing right
        now is interrupted.
      </p>
      <Field
        label={`Type ${sn} to confirm`}
        value={typed}
        autoComplete="off"
        spellcheck={false}
        onInput={(event) => setTyped(event.currentTarget.value)}
      />
    </Dialog>
  );
}
