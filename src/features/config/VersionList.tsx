import type { Schemas } from '@/api/endpoints';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/ui';

export interface VersionListProps {
  versions: Schemas['ConfigVersion'][];
  selected: number | undefined;
  target: number | null | undefined;
  authorName: (userId: string | undefined) => string | null;
  onSelect: (version: number) => void;
}

export function VersionList({
  versions,
  selected,
  target,
  authorName,
  onSelect,
}: VersionListProps) {
  return (
    <ol class="version-list" aria-label="Config versions">
      {versions.map((v) => {
        const author = authorName(v.created_by);
        return (
          <li key={v.version}>
            <button
              type="button"
              class="version-list__item"
              aria-current={v.version === selected ? 'true' : undefined}
              onClick={() => onSelect(v.version)}
            >
              <span class="version-list__head">
                <strong>v{v.version}</strong>
                {v.version === target && <Badge tone="info">Target</Badge>}
              </span>
              <span>{v.note}</span>
              <span class="muted">
                {formatDateTime(v.created_at)}
                {author && ` · ${author}`}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
