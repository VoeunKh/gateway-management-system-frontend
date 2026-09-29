import type { Schemas } from '@/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format';
import { Button, Card, ErrorState, JobStateBadge, Skeleton, Table } from '@/ui';
import { useDeviceHistory } from '../useDeviceTelemetry';
import { describe, typeLabel } from './historyText';

type Entry = Schemas['HistoryEntry'];

function StateBadge({ entry }: { entry: Entry }) {
  return entry.state ? <JobStateBadge state={entry.state} /> : null;
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
