import type { Schemas } from '@/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Badge, Button, Card, ErrorState, Skeleton, Table } from '@/ui';
import type { Tone } from '@/ui';
import { useDeviceHistory } from '../useDeviceTelemetry';
import { describe, typeLabel } from './historyText';

type Entry = Schemas['HistoryEntry'];

const JOB_STATE: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  running: { tone: 'info', label: 'Running' },
  succeeded: { tone: 'ok', label: 'Succeeded' },
  failed: { tone: 'danger', label: 'Failed' },
  timed_out: { tone: 'danger', label: 'Timed out' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

function StateBadge({ entry }: { entry: Entry }) {
  if (!entry.state) return null;
  const state = JOB_STATE[entry.state] ?? { tone: 'neutral' as const, label: entry.state };
  return <Badge tone={state.tone}>{state.label}</Badge>;
}

/** Events and jobs for one gateway, newest first. */
export function HistoryCard({ sn }: { sn: string }) {
  const history = useDeviceHistory(sn);
  let body;
  if (history.isPending) body = <Skeleton lines={4} label="Loading history" />;
  else if (history.isError) {
    body = <ErrorState message={history.error.message} onRetry={() => void history.refetch()} />;
  } else {
    const entries = history.data.pages.flatMap((page) => page.entries);
    body =
      entries.length === 0 ? (
        <p class="muted">Nothing has happened to this gateway yet.</p>
      ) : (
        <>
          <Table
            caption="History"
            hideCaption
            rows={entries}
            rowKey={(entry) => entry.id}
            columns={[
              {
                key: 'time',
                header: 'When',
                cell: (e) => (
                  <time dateTime={e.created_at} title={formatDateTime(e.created_at)}>
                    {formatRelative(e.created_at)}
                  </time>
                ),
              },
              { key: 'type', header: 'What', cell: (e) => typeLabel(e) },
              { key: 'state', header: 'Result', cell: (e) => <StateBadge entry={e} /> },
              { key: 'detail', header: 'Detail', cell: (e) => describe(e) },
            ]}
          />
          {history.hasNextPage && (
            <Button
              loading={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              Load more
            </Button>
          )}
        </>
      );
  }
  return <Card title="History">{body}</Card>;
}
