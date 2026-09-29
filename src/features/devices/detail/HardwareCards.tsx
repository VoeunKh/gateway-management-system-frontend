import type { DeviceView } from '@/api/endpoints';
import { Badge, Card, PackageStatusBadge, Table } from '@/ui';
import { interfaceLabel } from './labels';

type Device = DeviceView;

export function InterfacesCard({ device }: { device: Device }) {
  return (
    <Card title="Hardware interfaces">
      {device.interfaces.length === 0 ? (
        <p class="muted">No interfaces reported.</p>
      ) : (
        <Table
          caption="Hardware interfaces"
          hideCaption
          rows={device.interfaces}
          rowKey={(hw) => `${hw.type}:${hw.identifier}`}
          columns={[
            { key: 'type', header: 'Type', cell: (hw) => interfaceLabel(hw.type) },
            {
              key: 'name',
              header: 'Name',
              cell: (hw) =>
                hw.name ? <span class="mono">{hw.name}</span> : <span class="muted">—</span>,
            },
            {
              key: 'id',
              header: 'Identifier',
              cell: (hw) => <span class="mono">{hw.identifier}</span>,
            },
            {
              key: 'link',
              header: 'Link',
              cell: (hw) =>
                hw.link_up === undefined ? (
                  <span class="muted">—</span>
                ) : (
                  <Badge tone={hw.link_up ? 'ok' : 'neutral'}>{hw.link_up ? 'Up' : 'Down'}</Badge>
                ),
            },
          ]}
        />
      )}
    </Card>
  );
}

/** Packages are reported from firmware v2 on; with none, the card is left out. */
export function PackagesCard({ device }: { device: Device }) {
  if (device.packages.length === 0) return null;
  return (
    <Card title="Packages">
      <Table
        caption="Installed packages"
        hideCaption
        rows={device.packages}
        rowKey={(pkg) => pkg.name}
        columns={[
          { key: 'name', header: 'Package', cell: (pkg) => <span class="mono">{pkg.name}</span> },
          { key: 'installed', header: 'Installed', cell: (pkg) => pkg.version },
          {
            key: 'expected',
            header: 'Firmware ships',
            cell: (pkg) => pkg.expected || <span class="muted">—</span>,
          },
          {
            key: 'status',
            header: 'Status',
            cell: (pkg) => <PackageStatusBadge status={pkg.status} />,
          },
        ]}
      />
    </Card>
  );
}
