import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Link } from 'wouter-preact';
import { ApiError } from '@/api/errors';
import type { DeviceView } from '@/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format';
import { EmptyState, ErrorState, HealthBadge, Notice, Skeleton } from '@/ui';
import { ActionButtons } from './detail/ActionButtons';
import { ConfigCard } from './detail/ConfigCard';
import { HistoryCard } from './detail/HistoryCard';
import { JobPanel } from './detail/JobPanel';
import { RolloutBanner } from './detail/RolloutBanner';
import { TrendsCard } from './detail/TrendsCard';
import { InterfacesCard, PackagesCard } from './detail/HardwareCards';
import { HealthCard } from './detail/HealthCard';
import { InfoCard } from './detail/InfoCard';
import { devicesListHref } from './listState';
import { useDevice } from './useDevice';

function Header({ device, actions }: { device: DeviceView; actions: ComponentChildren }) {
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
      <div class="detail-head__actions">{actions}</div>
    </header>
  );
}

function Banners({ device }: { device: DeviceView }) {
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
  const [jobId, setJobId] = useState<string | null>(null);
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
      <Header
        device={d}
        actions={<ActionButtons device={d} onStarted={(job) => setJobId(job.id)} />}
      />
      {jobId && (
        <div class="job-slot">
          <JobPanel
            jobId={jobId}
            onStarted={(job) => setJobId(job.id)}
            onClose={() => setJobId(null)}
          />
        </div>
      )}
      <Banners device={d} />
      <RolloutBanner sn={d.sn} />
      <div class="detail-grid">
        <InfoCard device={d} />
        <HealthCard device={d} />
        {/* Charts, tables and the config need the full width. */}
        <div class="detail-grid__wide">
          <TrendsCard sn={d.sn} />
        </div>
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
        <div class="detail-grid__wide">
          <HistoryCard sn={d.sn} />
        </div>
      </div>
    </section>
  );
}
