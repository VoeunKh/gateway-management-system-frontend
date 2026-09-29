import type { Schemas } from '@/api/endpoints';
import { formatDateTime } from '@/lib/format';
import { ErrorState, Skeleton } from '@/ui';
import { DiffView } from './DiffView';
import { useVersionDiff } from './useConfig';

export interface VersionPanelProps {
  modelId: string;
  version: Schemas['ConfigVersion'];
  authorName: (userId: string | undefined) => string | null;
}

/** The selected version: its note, then what changed against the previous version. */
export function VersionPanel({ modelId, version, authorName }: VersionPanelProps) {
  const diff = useVersionDiff(modelId, version.version);
  const author = authorName(version.created_by);
  const first = version.version === 1;

  let content;
  if (first) {
    content = (
      <>
        <p class="muted">The first version, so there is nothing to compare it with.</p>
        <pre class="config-text" tabIndex={0} aria-label={`Config v${version.version}`}>
          {version.text}
        </pre>
      </>
    );
  } else if (diff.isPending) {
    content = <Skeleton lines={8} label="Loading changes" />;
  } else if (diff.isError) {
    content = <ErrorState message={diff.error.message} onRetry={() => void diff.refetch()} />;
  } else {
    content = <DiffView ops={diff.data} label={`Changes in v${version.version}`} />;
  }

  return (
    <section class="version-panel" aria-labelledby="version-panel-title">
      <h2 id="version-panel-title">
        v{version.version}
        {!first && <span class="muted"> compared with v{version.version - 1}</span>}
      </h2>
      <p>
        {version.note}
        <span class="muted">
          {' · '}
          {formatDateTime(version.created_at)}
          {author && ` · by ${author}`}
        </span>
      </p>
      {content}
    </section>
  );
}
