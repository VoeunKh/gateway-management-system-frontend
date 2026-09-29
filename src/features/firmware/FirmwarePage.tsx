import { useState } from 'preact/hooks';
import { useModels } from '@/api/useModels';
import { Can } from '@/auth/guards';
import { Button, EmptyState, ErrorState, IconUpload, Skeleton } from '@/ui';
import type { Schemas } from '@/api/endpoints';
import { BlockDialog } from './BlockDialog';
import { FinishedRollouts } from './FinishedRollouts';
import { ImageTable } from './ImageTable';
import { RolloutCard } from './RolloutCard';
import { RolloutForm } from './RolloutForm';
import { UploadDialog } from './UploadDialog';
import { useFirmwareImages } from './useFirmware';
import { useRollouts } from './useRollouts';

function ActiveRollouts() {
  const active = useRollouts('active');
  if (active.isPending) return <Skeleton lines={3} label="Loading rollouts" />;
  if (active.isError) {
    return <ErrorState message={active.error.message} onRetry={() => void active.refetch()} />;
  }
  if (active.data.length === 0) return <p class="muted">No rollout is running.</p>;
  return (
    <div class="stack">
      {active.data.map((r) => (
        <RolloutCard key={r.id} id={r.id} />
      ))}
    </div>
  );
}

export function FirmwarePage() {
  const models = useModels();
  const images = useFirmwareImages();
  const [uploading, setUploading] = useState(false);
  const [blocking, setBlocking] = useState<Schemas['FirmwareImage'] | null>(null);

  let top;
  if (models.isPending || images.isPending) top = <Skeleton lines={6} label="Loading firmware" />;
  else if (models.isError || images.isError) {
    const failed = models.isError ? models : images;
    top = (
      <ErrorState
        message={failed.error?.message ?? 'Failed'}
        onRetry={() => void failed.refetch()}
      />
    );
  } else if (images.data.length === 0) {
    top = <EmptyState title="No firmware yet">Upload a signed image to get started.</EmptyState>;
  } else {
    top = (
      <>
        <RolloutForm models={models.data} images={images.data} />
        <h2>Rollouts</h2>
        <ActiveRollouts />
        <h2>Finished</h2>
        <FinishedRollouts />
        <h2>Firmware images</h2>
        <ImageTable images={images.data} onBlock={setBlocking} />
      </>
    );
  }

  return (
    <section class="page">
      <header class="config-head">
        <h1>Firmware and rollouts</h1>
        <Can perm="firmware">
          <Button variant="primary" icon={<IconUpload />} onClick={() => setUploading(true)}>
            Upload image
          </Button>
        </Can>
      </header>
      {top}
      <UploadDialog
        open={uploading}
        models={models.data ?? []}
        onClose={() => setUploading(false)}
      />
      <BlockDialog image={blocking} onClose={() => setBlocking(null)} />
    </section>
  );
}
