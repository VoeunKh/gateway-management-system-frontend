import { useState } from 'preact/hooks';
import { formatCount } from '@/lib/format';
import { Button, Dialog, ErrorState, Field, Skeleton } from '@/ui';
import { usePushConfig, usePushPreview } from './usePush';

export interface PushDialogProps {
  open: boolean;
  modelId: string;
  version: number;
  onClose: () => void;
  /** Called after the push is accepted, before the dialog closes. */
  onPushed: () => void;
}

/** Shows who a push will reach and needs the model id typed before it can go. */
export function PushDialog({ open, modelId, version, onClose, onPushed }: PushDialogProps) {
  const [typed, setTyped] = useState('');
  const preview = usePushPreview(modelId, version, open);
  const close = () => {
    setTyped('');
    onClose();
  };
  // The hook's own options run even if this component has not subscribed yet.
  const push = usePushConfig(modelId, () => {
    onPushed();
    close();
  });
  const ready = typed === modelId && preview.isSuccess;

  let summary;
  if (preview.isPending) summary = <Skeleton lines={2} label="Checking who would get it" />;
  else if (preview.isError) {
    summary = <ErrorState message={preview.error.message} onRetry={() => void preview.refetch()} />;
  } else {
    const { gateways, offline } = preview.data;
    summary = (
      <p>
        v{version} will be sent to <strong>{formatCount(gateways)}</strong> {modelId} gateways.
        {offline > 0 && (
          <>
            {' '}
            <strong>{formatCount(offline)}</strong> {offline === 1 ? 'is' : 'are'} offline and will
            take it when {offline === 1 ? 'it reconnects' : 'they reconnect'}.
          </>
        )}
      </p>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Push v${version} to ${modelId}?`}
      actions={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            loading={push.isPending}
            disabled={!ready}
            title={ready ? undefined : `Type ${modelId} to enable`}
            onClick={() => push.mutate(version)}
          >
            {`Push v${version}`}
          </Button>
        </>
      }
    >
      {summary}
      <p class="muted">
        Every {modelId} gateway is told to run this version. You can push an older version to roll
        back.
      </p>
      <Field
        label={`Type ${modelId} to confirm`}
        value={typed}
        autoComplete="off"
        spellcheck={false}
        onInput={(event) => setTyped(event.currentTarget.value)}
      />
    </Dialog>
  );
}
