import { useState } from 'preact/hooks';
import type { Schemas } from '@/api/endpoints';
import { Can } from '@/auth/guards';
import { Button, Dialog, Field, IconPause, IconPlay, IconStop } from '@/ui';
import { useRolloutControl } from './useRollouts';

/** Aborting is for good, so the rollout id must be typed to confirm. */
function AbortDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const control = useRolloutControl();
  const close = () => {
    setTyped('');
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Abort ${id}?`}
      actions={
        <>
          <Button onClick={close}>Keep going</Button>
          <Button
            variant="danger"
            disabled={typed !== id}
            title={typed === id ? undefined : `Type ${id} to enable`}
            loading={control.isPending}
            onClick={() => {
              control.mutate({ id, action: 'abort' });
              close();
            }}
          >
            Abort rollout
          </Button>
        </>
      }
    >
      <p>
        No more gateways will be updated. Ones already updated stay on the new firmware, and the
        rest keep what they run now. This can't be undone.
      </p>
      <Field
        label={`Type ${id} to confirm`}
        value={typed}
        autoComplete="off"
        spellcheck={false}
        onInput={(event) => setTyped(event.currentTarget.value)}
      />
    </Dialog>
  );
}

/** Pause while it runs, Resume while paused, Abort any time before it ends. */
export function RolloutControls({ rollout }: { rollout: Schemas['Rollout'] }) {
  const control = useRolloutControl();
  const [aborting, setAborting] = useState(false);
  const running = rollout.state === 'running' || rollout.state === 'soaking';
  const busy = (action: string) => control.isPending && control.variables?.action === action;
  return (
    <div class="rollout-controls">
      {running && (
        <Can perm="rollout">
          <Button
            icon={<IconPause />}
            loading={busy('pause')}
            onClick={() => control.mutate({ id: rollout.id, action: 'pause' })}
          >
            Pause
          </Button>
        </Can>
      )}
      {rollout.state === 'paused' && (
        <Can perm="rollout">
          <Button
            variant="primary"
            icon={<IconPlay />}
            loading={busy('resume')}
            onClick={() => control.mutate({ id: rollout.id, action: 'resume' })}
          >
            Resume
          </Button>
        </Can>
      )}
      <Can perm="rollout">
        <Button variant="danger" icon={<IconStop />} onClick={() => setAborting(true)}>
          Abort
        </Button>
      </Can>
      <AbortDialog id={rollout.id} open={aborting} onClose={() => setAborting(false)} />
    </div>
  );
}
