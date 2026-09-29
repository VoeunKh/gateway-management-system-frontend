import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { HttpResponse, http } from 'msw';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { api } from '../../../tests/msw/handlers/api';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

async function openOverview() {
  signInAs('viewer');
  const view = renderApp('/');
  await screen.findByRole('heading', { name: 'Overview', level: 1 });
  await screen.findByRole('group', { name: 'GW200 gateways' });
  return view;
}

const total = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

describe('OverviewPage', () => {
  it('shows header counts that match the fleet', async () => {
    await openOverview();
    const count = (health: string) => db.devices.filter((d) => d.health === health).length;
    expect(total('Gateways')).toBe(String(db.devices.length));
    expect(total('Online')).toBe(String(db.devices.length - count('offline')));
    expect(total('Need attention')).toBe(String(count('warning') + count('critical')));
    expect(total('Config drift')).toBe(String(db.devices.filter((d) => d.drift).length));
  });

  it('draws one labelled square per gateway, grouped by model', async () => {
    await openOverview();
    const squares = screen.getAllByRole('button', { name: /, firmware / });
    expect(squares).toHaveLength(db.devices.length);
    const device = db.devices.find((d) => d.health === 'critical');
    const square = screen.getByRole('button', {
      name: `${device?.sn}, critical, firmware ${device?.fw_version}`,
    });
    expect(square).toHaveClass('board__cell--critical');
    expect(square).toHaveAttribute('title', square.getAttribute('aria-label'));
    const gw200 = screen.getByRole('group', { name: 'GW200 gateways' });
    expect(within(gw200).getAllByRole('button')).toHaveLength(
      db.devices.filter((d) => d.model_id === 'GW200').length,
    );
  });

  it('names each health state in the legend with its count', async () => {
    await openOverview();
    const legend = screen.getByRole('list', { name: 'Health legend' });
    const offline = db.devices.filter((d) => d.health === 'offline').length;
    expect(within(legend).getByText('Offline').closest('li')).toHaveTextContent(
      `Offline ${offline}`,
    );
  });

  it('opens a gateway from its square', async () => {
    const { currentPath } = await openOverview();
    const first = db.devices[0];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${first?.sn},`) }));
    await waitFor(() => expect(currentPath()).toBe(`/devices/${first?.sn}`));
  });

  it('shows a skeleton while loading', async () => {
    signInAs('viewer');
    renderApp('/');
    expect(await screen.findByText('Loading overview')).toBeInTheDocument();
  });

  it('shows the empty state when there are no gateways', async () => {
    db.devices = [];
    signInAs('viewer');
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'No gateways yet' })).toBeInTheDocument();
    expect(screen.getByText('Install the agent on a gateway to get started.')).toBeInTheDocument();
  });

  it('shows an error with Retry, and recovers', async () => {
    const down = () =>
      HttpResponse.json({ error: { code: 'boom', message: 'Overview is down' } }, { status: 500 });
    server.use(
      http.get(api('/overview'), down, { once: true }),
      http.get(api('/overview'), down, { once: true }),
    );
    signInAs('viewer');
    renderApp('/');
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Overview is down',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('group', { name: 'GW200 gateways' })).toBeInTheDocument();
  });

  it('keeps the rest of the page when only the board fails', async () => {
    server.use(
      http.get(api('/devices'), () =>
        HttpResponse.json(
          { error: { code: 'boom', message: 'Devices are down' } },
          { status: 500 },
        ),
      ),
    );
    signInAs('viewer');
    renderApp('/');
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Devices are down',
    );
    expect(total('Gateways')).toBe(String(db.devices.length));
    expect(total('Config drift')).toBe('–');
    expect(screen.getByRole('heading', { name: 'Firmware by model' })).toBeInTheDocument();
  });
});
