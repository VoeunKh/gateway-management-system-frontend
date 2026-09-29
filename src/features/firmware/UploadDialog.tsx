import { useState } from 'preact/hooks';
import type { Schemas } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import { formatBytes } from '@/lib/format';
import { Button, Dialog, Field, Notice, SelectField } from '@/ui';
import { useUploadFirmware } from './useFirmware';

export interface UploadDialogProps {
  open: boolean;
  models: Schemas['Model'][];
  onClose: () => void;
}

/** The API's own words are technical; this is what to do about the one people will hit. */
export function uploadErrorText(error: Error): string {
  if (error instanceof ApiError && error.code === 'signature_invalid') {
    return "This image's signature does not match. Check it was signed with the release key.";
  }
  return error.message;
}

const fileHint = (file: File | null) =>
  file ? `${file.name} · ${formatBytes(file.size)}` : 'No file chosen';

/** Model, version, channel, the image and its .sig; shows progress while the image goes up. */
export function UploadDialog({ open, models, onClose }: UploadDialogProps) {
  // Until one is picked, the first model: the list may not have loaded when this mounts.
  const [picked, setPicked] = useState('');
  const model = picked || (models[0]?.id ?? '');
  const [version, setVersion] = useState('');
  const [channel, setChannel] = useState('stable');
  const [image, setImage] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [missing, setMissing] = useState(false);

  const close = () => {
    setPicked('');
    setVersion('');
    setImage(null);
    setSignature(null);
    setProgress(0);
    setMissing(false);
    onClose();
  };
  const upload = useUploadFirmware(close);
  const need = (value: unknown) => (missing && !value ? 'Required' : undefined);

  const submit = () => {
    if (!model || !version.trim() || !image || !signature) return setMissing(true);
    const form = new FormData();
    form.set('model_id', model);
    form.set('version', version.trim());
    form.set('channel', channel);
    form.set('image', image);
    form.set('signature', signature);
    setProgress(0);
    upload.mutate({ form, onProgress: setProgress });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Upload firmware image"
      actions={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={upload.isPending} onClick={submit}>
            Upload
          </Button>
        </>
      }
    >
      <div class="form-grid">
        <SelectField
          label="Model"
          value={model}
          onChange={setPicked}
          options={models.map((m) => ({ value: m.id, label: m.id }))}
        />
        <SelectField
          label="Channel"
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'stable', label: 'Stable' },
            { value: 'beta', label: 'Beta' },
          ]}
        />
        <Field
          label="Version"
          value={version}
          placeholder="1.4.0"
          error={need(version.trim())}
          onInput={(event) => setVersion(event.currentTarget.value)}
        />
        <Field
          label="Image file"
          type="file"
          hint={fileHint(image)}
          error={need(image)}
          onChange={(event) => setImage(event.currentTarget.files?.[0] ?? null)}
        />
        <Field
          label="Signature file (.sig)"
          type="file"
          hint={fileHint(signature)}
          error={need(signature)}
          onChange={(event) => setSignature(event.currentTarget.files?.[0] ?? null)}
        />
      </div>
      {upload.isPending && (
        <div
          class="progress"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span class="progress__fill" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {upload.isError && (
        <Notice tone="danger" title="Upload failed">
          {uploadErrorText(upload.error)}
        </Notice>
      )}
    </Dialog>
  );
}
