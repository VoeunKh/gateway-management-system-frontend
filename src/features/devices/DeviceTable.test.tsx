import { screen, within } from '@testing-library/preact';
import { db } from '../../../tests/msw/db';
import { toListItem } from '../../../tests/msw/fixtures/devices';
import { renderWithProviders } from '../../../tests/renderApp';
import { DeviceTable } from './DeviceTable';

const base = toListItem(db.devices[0] as NonNullable<(typeof db.devices)[0]>);
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function renderRows(devices: (typeof base)[]) {
  renderWithProviders(<DeviceTable devices={devices} />);
  return within(screen.getByRole('table', { name: 'Gateways' }))
    .getAllByRole('row')
    .slice(1);
}

describe('DeviceTable', () => {
  it('shows the Drift badge only for drifted devices, with the target version', () => {
    const [drifted, inSync] = renderRows([
      { ...base, sn: 'A-1', drift: true, cfg_version: 2, target_cfg_version: 3 },
      { ...base, sn: 'A-2', drift: false, cfg_version: 3, target_cfg_version: 3 },
    ]);
    expect(within(drifted as HTMLElement).getByText('Drift')).toBeInTheDocument();
    expect(within(drifted as HTMLElement).getByTitle('Target is v3')).toBeInTheDocument();
    expect(within(drifted as HTMLElement).getByText('v2')).toBeInTheDocument();
    expect(within(inSync as HTMLElement).queryByText('Drift')).not.toBeInTheDocument();
  });

  it('formats last seen with Intl and keeps the exact time in a tooltip', () => {
    const seen = new Date(Date.now() - 5 * 60_000).toISOString();
    const [row] = renderRows([{ ...base, last_seen: seen }]);
    const time = within(row as HTMLElement).getByText(rtf.format(-5, 'minute'));
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', seen);
  });

  it('shows status as a labelled badge and handles missing values', () => {
    const [row] = renderRows([
      {
        ...base,
        health: 'offline',
        site_name: '',
        site_id: null,
        last_seen: null,
        cfg_version: null,
        fw_version: undefined,
      },
    ]);
    const cells = within(row as HTMLElement).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Offline');
    expect(within(row as HTMLElement).getByText('Unassigned')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Never')).toBeInTheDocument();
  });
});
