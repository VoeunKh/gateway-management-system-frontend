import type { Schemas } from '@/api/endpoints';
import { formatDateTime } from '@/lib/format';
import { Card, DetailList } from '@/ui';
import { LIFECYCLE_LABEL, PACKAGE_DRIFT_LABEL } from './labels';

export function InfoCard({ device }: { device: Schemas['DeviceDetail'] }) {
  return (
    <Card title="Device info">
      <DetailList
        items={[
          { label: 'Serial number', value: <span class="mono">{device.sn}</span> },
          { label: 'Model', value: device.model_name },
          { label: 'Hardware revision', value: device.hw_rev },
          { label: 'Firmware', value: device.fw_version },
          { label: 'Site', value: device.site_name || <span class="muted">Unassigned</span> },
          { label: 'Lifecycle', value: LIFECYCLE_LABEL[device.lifecycle] },
          { label: 'Packages', value: PACKAGE_DRIFT_LABEL[device.package_drift] },
          { label: 'Added', value: formatDateTime(device.created_at) },
        ]}
      />
    </Card>
  );
}
