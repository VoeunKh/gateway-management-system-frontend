import type { DeviceView } from '@/api/endpoints';
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format';
import { Card, DetailList } from '@/ui';
import { LIFECYCLE_LABEL, PACKAGE_DRIFT_LABEL } from './labels';

const megabytes = (mb: number | null | undefined) =>
  mb === null || mb === undefined ? null : formatBytes(mb * 1_000_000);

export function InfoCard({ device }: { device: DeviceView }) {
  return (
    <Card title="Device info">
      <DetailList
        items={[
          { label: 'Serial number', value: <span class="mono">{device.sn}</span> },
          { label: 'Model', value: device.model_name },
          { label: 'Hardware revision', value: device.hw_rev },
          { label: 'SoC', value: device.soc },
          { label: 'RAM', value: megabytes(device.ram_mb) },
          { label: 'Flash', value: megabytes(device.flash_mb) },
          { label: 'OS', value: device.os },
          { label: 'Firmware', value: device.fw_version },
          {
            label: 'Uptime',
            value:
              device.uptime_s === null || device.uptime_s === undefined
                ? null
                : formatDuration(device.uptime_s),
          },
          { label: 'Site', value: device.site_name || <span class="muted">Unassigned</span> },
          { label: 'Lifecycle', value: LIFECYCLE_LABEL[device.lifecycle] },
          { label: 'Packages', value: PACKAGE_DRIFT_LABEL[device.package_drift] },
          { label: 'Added', value: formatDateTime(device.created_at) },
        ]}
      />
    </Card>
  );
}
