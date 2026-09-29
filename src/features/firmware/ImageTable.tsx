import { Can } from '@/auth/guards';
import type { Schemas } from '@/api/endpoints';
import { formatBytes, formatCount } from '@/lib/format';
import { Badge, Button, Table, useToast } from '@/ui';
import { useBlockFirmware } from './useFirmware';

type Image = Schemas['FirmwareImage'];

function Sha({ image }: { image: Image }) {
  const toast = useToast();
  const copy = () => {
    void navigator.clipboard
      ?.writeText(image.sha256)
      .then(() =>
        toast({ message: `Copied SHA-256 of ${image.model_id} ${image.version}`, tone: 'ok' }),
      );
  };
  return (
    <span class="cell-inline">
      <span class="mono" title={image.sha256}>
        {image.sha256.slice(0, 12)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Copy SHA-256 of ${image.model_id} ${image.version}`}
        onClick={copy}
      >
        Copy
      </Button>
    </span>
  );
}

export interface ImageTableProps {
  images: Image[];
  onBlock: (image: Image) => void;
}

/** Every firmware image, with what it is, who runs it and whether it can be used. */
export function ImageTable({ images, onBlock }: ImageTableProps) {
  const unblock = useBlockFirmware();
  return (
    <Table
      caption="Firmware images"
      hideCaption
      stack
      rows={images}
      rowKey={(image) => image.id}
      columns={[
        { key: 'model', header: 'Model', cell: (i) => i.model_id },
        {
          key: 'version',
          header: 'Version',
          cell: (i) => (
            <span class="two-line">
              <span class="mono">{i.version}</span>
              <span class="mono muted" title="Image file">
                {i.file_name}
              </span>
              {i.blocked && (
                <span class="danger-text">
                  {i.blocked_reason ? `Blocked: ${i.blocked_reason}` : 'Blocked'}
                </span>
              )}
            </span>
          ),
        },
        {
          key: 'channel',
          header: 'Channel',
          cell: (i) => (
            <span class="cell-inline">
              <Badge tone={i.channel === 'beta' ? 'warn' : 'neutral'}>
                {i.channel === 'beta' ? 'Beta' : 'Stable'}
              </Badge>
              {i.blocked && <Badge tone="danger">Blocked</Badge>}
            </span>
          ),
        },
        { key: 'size', header: 'Size', numeric: true, cell: (i) => formatBytes(i.size) },
        { key: 'sha', header: 'SHA-256', cell: (i) => <Sha image={i} /> },
        {
          key: 'gateways',
          header: 'Gateways',
          numeric: true,
          cell: (i) => formatCount(i.gateways),
        },
        {
          key: 'actions',
          header: 'Actions',
          cell: (i) => (
            <Can perm="firmware">
              <Button
                size="sm"
                aria-label={`${i.blocked ? 'Unblock' : 'Block'} ${i.model_id} ${i.version}`}
                onClick={() => (i.blocked ? unblock.mutate({ image: i }) : onBlock(i))}
              >
                {i.blocked ? 'Unblock' : 'Block'}
              </Button>
            </Can>
          ),
        },
      ]}
    />
  );
}
