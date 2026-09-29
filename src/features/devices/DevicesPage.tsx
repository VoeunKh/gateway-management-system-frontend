import { useMemo } from 'preact/hooks';
import { useLocation, useSearch } from 'wouter-preact';
import { formatCount } from '@/lib/format';
import { Button, EmptyState, ErrorState, Skeleton } from '@/ui';
import { DeviceFilterBar } from './DeviceFilterBar';
import { DeviceTable } from './DeviceTable';
import { FilterChips } from './FilterChips';
import { describeFilters, hasFilters, parseFilters, serializeFilters } from './filters';
import type { DeviceFilters } from './filters';
import { useDevices } from './useDevices';

export function DevicesPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const filters = useMemo(() => parseFilters(search), [search]);
  const setFilters = (next: DeviceFilters) =>
    navigate(`/devices${serializeFilters(next)}`, { replace: true });
  const list = useDevices(filters);
  const clear = () => setFilters({});

  let body;
  if (list.isPending) {
    body = <Skeleton lines={10} label="Loading gateways" />;
  } else if (list.isError && !list.data) {
    body = <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />;
  } else if (list.devices.length === 0) {
    body = hasFilters(filters) ? (
      <EmptyState
        title="No gateways match"
        action={
          <Button variant="primary" onClick={clear}>
            Clear filters
          </Button>
        }
      >
        Nothing matched {describeFilters(filters).join(', ')}.
      </EmptyState>
    ) : (
      <EmptyState title="No gateways yet">
        Gateways appear here once they first report in.
      </EmptyState>
    );
  } else {
    body = (
      <>
        <div aria-busy={list.isPlaceholderData ? 'true' : undefined}>
          <DeviceTable devices={list.devices} />
        </div>
        {list.hasNextPage && (
          <div class="list-more">
            <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
              Load more
            </Button>
          </div>
        )}
      </>
    );
  }

  const count = list.devices.length;
  return (
    <section class="page">
      <h1>Devices</h1>
      <DeviceFilterBar filters={filters} onChange={setFilters} />
      {body}
      <footer class="list-footer">
        <p role="status">
          {list.isPending
            ? 'Loading gateways…'
            : `Showing ${formatCount(count)} ${count === 1 ? 'gateway' : 'gateways'}${
                list.hasNextPage ? ', more available' : ''
              }`}
          {list.isPlaceholderData && <span class="muted"> · updating…</span>}
        </p>
        <FilterChips filters={filters} onChange={setFilters} />
      </footer>
    </section>
  );
}
