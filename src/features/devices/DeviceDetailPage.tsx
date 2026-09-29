import { Link } from 'wouter-preact';
import { ApiError } from '@/api/errors';
import type { Schemas } from '@/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format';
import { EmptyState, ErrorState, HealthBadge, Notice, Skeleton } from '@/ui';
import { ConfigCard } from './detail/ConfigCard';
import { InterfacesCard, PackagesCard } from './detail/HardwareCards';
import { HealthCard } from './detail/HealthCard';
import { InfoCard } from './detail/InfoCard';
import { devicesListHref } from './listState';
import { useDevice } from './useDevice';

function Header({ device }: { device: Schemas['DeviceDetail'] }) {
  return (
    <header class="detail-head">
      <div>
        <h1 class="mono">{device.sn}</h1>
        <p class="detail-head__meta">
          <HealthBadge health={device.health} />
          <span>{device.model_name}</span>
          <span>{device.site_name || 'Unassigned'}</span>
          <span>
            Last seen{' '}
            {device.last_seen ? (
              <time dateTime={device.last_seen} title={formatDateTime(device.last_seen)}>
                {formatRelative(device.last_seen)}
              </time>
            ) : (
              'never'
            )}
          </span>
        </p>
      </div>
      {/* Reboot, Pull logs and Run ping arrive with UI-08. */}
      <div class="detail-head__actions" />
    </header>
  );
}

function Banners({ device }: { device: Schemas['DeviceDetail'] }) {
  if (device.lifecycle === 'bricked') {
    return (
      <Notice tone="danger" title="Needs on-site recovery">
        This gateway is marked bricked. It can't take remote actions or updates until someone
        recovers it on site.
      </Notice>
    );
  }
  if (device.lifecycle === 'decommissioned') {
    return (
      <Notice tone="info" title="Decommissioned">
        This gateway is retired and no longer expected to report.
      </Notice>
    );
  }
  return null;
}

export function DeviceDetailPage({ sn }: { sn: string }) {
  const device = useDevice(sn);
  const back = (
    <Link href={devicesListHref()} class="back-link">
      ← Back to devices
    </Link>
  );

  if (device.isPending) {
    return (
      <section class="page">
        {back}
        <Skeleton lines={8} label="Loading gateway" />
      </section>
    );
  }
  if (device.isError) {
    const notFound = device.error instanceof ApiError && device.error.status === 404;
    return (
      <section class="page">
        {back}
        {notFound ? (
          <EmptyState title="Gateway not found">
            No gateway has the serial number {sn}. It may have been mistyped.
          </EmptyState>
        ) : (
          <ErrorState message={device.error.message} onRetry={() => void device.refetch()} />
        )}
      </section>
    );
  }

  const d = device.data;
  return (
    <section class="page">
      {back}
      <Header device={d} />
      <Banners device={d} />
      <div class="detail-grid">
        <InfoCard device={d} />
        <HealthCard device={d} />
        {/* Tables and the config need the full width. */}
        <div class="detail-grid__wide">
          <InterfacesCard device={d} />
        </div>
        {d.packages.length > 0 && (
          <div class="detail-grid__wide">
            <PackagesCard device={d} />
          </div>
        )}
        <div class="detail-grid__wide">
          <ConfigCard device={d} />
        </div>
      </div>
    </section>
  );
}
