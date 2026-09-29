import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { HttpResponse, http } from 'msw';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { api } from '../../../tests/msw/handlers/api';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

/** Records the query string of every GET /devices while a test runs. */
function recordDeviceRequests() {
  const seen: URLSearchParams[] = [];
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/devices') seen.push(url.searchParams);
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return seen;
}

/** Picks an option the way a browser does (Testing Library's fireEvent.change sends `input`). */
function choose(select: HTMLElement, value: string) {
  (select as HTMLSelectElement).value = value;
  fireEvent(select, new Event('change', { bubbles: true }));
}

const rows = () =>
  within(screen.getByRole('table', { name: 'Gateways' }))
    .getAllByRole('row')
    .slice(1);

async function openDevices(path = '/devices') {
  signInAs('viewer');
  const view = renderApp(path);
  await screen.findByRole('table', { name: 'Gateways' });
  return view;
}

describe('DevicesPage', () => {
  it('lists the first 100 gateways and says more are available', async () => {
    await openDevices();
    expect(rows()).toHaveLength(100);
    expect(screen.getByText('Showing 100 gateways, more available')).toBeInTheDocument();
  });

  it('debounces search into a single request with the final q', async () => {
    const requests = recordDeviceRequests();
    const { currentPath } = await openDevices();
    const box = screen.getByRole('searchbox', { name: 'Search' });
    for (const value of ['G', 'GW', 'GW3', 'GW30', 'GW300-001']) {
      fireEvent.input(box, { target: { value } });
    }
    await waitFor(() => expect(currentPath()).toBe('/devices?q=GW300-001'));
    await waitFor(() =>
      expect(rows().every((r) => r.textContent?.includes('GW300-001'))).toBe(true),
    );
    const withQ = requests.filter((params) => params.has('q'));
    expect(withQ.map((params) => params.get('q'))).toEqual(['GW300-001']);
  });

  it('finds a gateway by its MAC address', async () => {
    const target = db.devices[123];
    const mac = target?.interfaces.find((hw) => hw.type === 'mac')?.identifier ?? '';
    await openDevices(`/devices?q=${encodeURIComponent(mac)}`);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0] as HTMLElement).getByRole('link')).toHaveTextContent(target?.sn ?? '');
  });

  it('maps each filter to its query parameter and restores them from the URL', async () => {
    const requests = recordDeviceRequests();
    await openDevices('/devices?model=GW300&health=offline&drift=true');
    const last = requests.at(-1);
    expect(last?.get('model')).toBe('GW300');
    expect(last?.get('health')).toBe('offline');
    expect(last?.get('drift')).toBe('true');
    expect(last?.get('limit')).toBe('100');
    expect(screen.getByRole('combobox', { name: 'Health' })).toHaveValue('offline');
    expect(screen.getByRole('switch', { name: 'Drifted only' })).toBeChecked();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('GW300'),
    );
  });

  it('writes filter changes to the URL', async () => {
    const { currentPath } = await openDevices();
    choose(screen.getByRole('combobox', { name: 'Health' }), 'critical');
    await waitFor(() => expect(currentPath()).toBe('/devices?health=critical'));
    fireEvent.click(screen.getByRole('switch', { name: 'Drifted only' }));
    await waitFor(() => expect(currentPath()).toBe('/devices?health=critical&drift=true'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Health: Critical' }));
    await waitFor(() => expect(currentPath()).toBe('/devices?drift=true'));
  });

  it('appends the next page on Load more, passing next_cursor', async () => {
    const requests = recordDeviceRequests();
    await openDevices();
    const hundredth = within(rows()[99] as HTMLElement).getByRole('link').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(rows()).toHaveLength(200));
    expect(requests.at(-1)?.get('cursor')).toBe(hundredth);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(rows()).toHaveLength(300));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 300 gateways')).toBeInTheDocument();
  });

  it('names the filters that matched nothing and clears them', async () => {
    signInAs('viewer');
    const { currentPath } = renderApp('/devices?q=NOPE&health=critical');
    expect(await screen.findByRole('heading', { name: 'No gateways match' })).toBeInTheDocument();
    expect(screen.getByText('Nothing matched search "NOPE", Critical.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement);
    await waitFor(() => expect(rows()).toHaveLength(100));
    expect(currentPath()).toBe('/devices');
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
  });

  it('opens a device from its link or anywhere on its row', async () => {
    const { currentPath } = await openDevices();
    const link = within(rows()[0] as HTMLElement).getByRole('link');
    const sn = link.textContent ?? '';
    expect(link).toHaveAttribute('href', `/devices/${sn}`);
    const second = rows()[1] as HTMLElement;
    const secondSn = within(second).getByRole('link').textContent;
    fireEvent.click(within(second).getAllByRole('cell')[3] as HTMLElement);
    expect(currentPath()).toBe(`/devices/${secondSn}`);
  });

  it('shows an error with Retry, and recovers', async () => {
    server.use(
      http.get(
        api('/devices'),
        () =>
          HttpResponse.json(
            { error: { code: 'boom', message: 'Database is down' } },
            { status: 500 },
          ),
        { once: true },
      ),
      http.get(
        api('/devices'),
        () =>
          HttpResponse.json(
            { error: { code: 'boom', message: 'Database is down' } },
            { status: 500 },
          ),
        { once: true },
      ),
    );
    signInAs('viewer');
    renderApp('/devices');
    // A failed GET is retried once (after about a second) before the error shows.
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Database is down',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table', { name: 'Gateways' })).toBeInTheDocument();
  });
});
