import type { Schemas } from '@/api/endpoints';
import { Badge, Card, Table } from '@/ui';
import { PACKAGE_STATUS, interfaceLabel } from './labels';

type Device = Schemas['DeviceDetail'];

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
              key: 'id',
              header: 'Identifier',
              cell: (hw) => <span class="mono">{hw.identifier}</span>,
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
            cell: (pkg) => (
              <Badge tone={PACKAGE_STATUS[pkg.status].tone}>
                {PACKAGE_STATUS[pkg.status].label}
              </Badge>
            ),
          },
        ]}
      />
    </Card>
  );
}
