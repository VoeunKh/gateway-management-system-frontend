import type { Schemas } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import { Badge, Card, DetailList, ErrorState, Notice, Skeleton } from '@/ui';
import type { Tone } from '@/ui';
import { useRenderedConfig } from '../useDevice';

type Device = Schemas['DeviceDetail'];

export function syncState(device: Device): { tone: Tone; label: string } {
  if (device.target_cfg_version === null || device.target_cfg_version === undefined) {
    return { tone: 'neutral', label: 'Nothing pushed' };
  }
  if (device.cfg_version === null || device.cfg_version === undefined) {
    return { tone: 'neutral', label: 'Not reported' };
  }
  return device.drift ? { tone: 'warn', label: 'Drift' } : { tone: 'ok', label: 'In sync' };
}

const version = (v: number | null | undefined) => (v === null || v === undefined ? null : `v${v}`);

function missingVariables(error: ApiError): string[] {
  const details = error.details;
  if (typeof details !== 'object' || details === null || !('missing' in details)) return [];
  const missing: unknown = details.missing;
  return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [];
}

/** The server renders and masks secrets; the client only displays (and never logs) it. */
function RenderedConfig({ device }: { device: Device }) {
  const config = useRenderedConfig(device.sn, device.cfg_hash);
  if (config.isPending) return <Skeleton lines={6} label="Loading config" />;
  if (config.isError) {
    const error = config.error;
    if (error instanceof ApiError && error.code === 'config_incomplete') {
      return (
        <Notice tone="warn" title="The config can't be rendered for this gateway">
          These variables have no value: {missingVariables(error).join(', ') || 'unknown'}.
        </Notice>
      );
    }
    if (error instanceof ApiError && error.status === 404) {
      return <p class="muted">No config has been pushed to this model yet.</p>;
    }
    return <ErrorState message={error.message} onRetry={() => void config.refetch()} />;
  }
  return (
    <figure class="config">
      <figcaption class="muted">
        Rendered config, secrets masked · SHA-256{' '}
        <span class="mono">{config.data.hash.slice(0, 12)}</span>
      </figcaption>
      <pre tabIndex={0} aria-label="Rendered config">
        <code>{config.data.text}</code>
      </pre>
    </figure>
  );
}

export function ConfigCard({ device }: { device: Device }) {
  const state = syncState(device);
  return (
    <Card title="Config" aside={<Badge tone={state.tone}>{state.label}</Badge>}>
      <DetailList
        items={[
          { label: 'Desired', value: version(device.target_cfg_version) ?? 'Nothing pushed' },
          { label: 'Reported', value: version(device.cfg_version) ?? 'Not reported yet' },
          {
            label: 'Reported hash',
            value: device.cfg_hash ? (
              <span class="mono" title={device.cfg_hash}>
                {device.cfg_hash.slice(0, 12)}
              </span>
            ) : null,
          },
        ]}
      />
      <RenderedConfig device={device} />
    </Card>
  );
}
