import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

const card = (name: string) => screen.getByRole('region', { name });

async function openDevice(sn: string, role: 'viewer' | 'admin' = 'viewer') {
  signInAs(role);
  renderApp(`/devices/${sn}`);
  await screen.findByRole('heading', { level: 1, name: sn });
}

/** An online gateway with LTE signal, so every metric has data. */
const live = () => {
  const d = db.devices.find((x) => x.online && x.last_metrics?.signal_dbm != null);
  if (!d) throw new Error('no live device');
  return d;
};

/** Paths (with query) requested while a test runs. */
function recordUrls() {
  const seen: URL[] = [];
  const listener = ({ request }: { request: Request }) => void seen.push(new URL(request.url));
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return seen;
}

describe('device page: hardware and info', () => {
  it('shows SoC, memory, OS and uptime, and interface names with their link state', async () => {
    const d = live();
    await openDevice(d.sn);
    const info = card('Device info');
    expect(within(info).getByText(d.soc ?? '')).toBeInTheDocument();
    expect(within(info).getByText('OpenWrt 23.05.4')).toBeInTheDocument();
    expect(within(info).getByText('Uptime')).toBeInTheDocument();
    expect(within(info).getByText('RAM').nextElementSibling).toHaveTextContent(/MB|GB/);
    const hw = card('Hardware interfaces');
    expect(within(hw).getAllByText('eth0').length).toBeGreaterThan(0);
    expect(within(hw).getAllByText(/^(Up|Down)$/).length).toBeGreaterThan(0);
  });

  it('leaves out uptime for an offline gateway', async () => {
    const d = db.devices.find((x) => !x.online && x.lifecycle === 'active');
    if (!d) throw new Error('no offline device');
    await openDevice(d.sn);
    expect(within(card('Device info')).queryByText('Uptime')).not.toBeInTheDocument();
  });
});

describe('device page: trends', () => {
  it('charts temperature for 24 hours, with now, low and high', async () => {
    const d = live();
    const urls = recordUrls();
    await openDevice(d.sn);
    const trends = card('Trends');
    expect(
      await within(trends).findByRole('img', { name: 'Temperature, last 24 hours' }),
    ).toBeInTheDocument();
    expect(within(trends).getByLabelText('Temperature summary')).toHaveTextContent(
      /Now.*Low.*High/,
    );
    const request = urls.find((u) => u.pathname.endsWith(`/${d.sn}/metrics`));
    expect(request?.searchParams.get('step')).toBe('300');
  });

  it('switches metric and range, requesting the matching step', async () => {
    const d = live();
    const urls = recordUrls();
    await openDevice(d.sn);
    const trends = card('Trends');
    fireEvent.click(await within(trends).findByRole('radio', { name: 'LTE signal' }));
    expect(
      await within(trends).findByRole('img', { name: 'LTE signal, last 24 hours' }),
    ).toBeInTheDocument();
    fireEvent.click(within(trends).getByRole('radio', { name: '7 days' }));
    expect(
      await within(trends).findByRole('img', { name: 'LTE signal, last 7 days' }),
    ).toBeInTheDocument();
    expect(urls.some((u) => u.searchParams.get('step') === '1800')).toBe(true);
  });

  it('says so when a metric has no readings', async () => {
    const d = db.devices.find(
      (x) => x.online && x.last_metrics && x.last_metrics.signal_dbm === null,
    );
    if (!d) throw new Error('no device without signal');
    await openDevice(d.sn);
    fireEvent.click(await within(card('Trends')).findByRole('radio', { name: 'LTE signal' }));
    expect(
      await within(card('Trends')).findByRole('heading', { name: 'No data yet' }),
    ).toBeInTheDocument();
  });

  it('puts a temperature sparkline in the Health card', async () => {
    await openDevice(live().sn);
    expect(
      await within(card('Health')).findByRole('img', { name: 'Temperature, last 24 hours' }),
    ).toBeInTheDocument();
  });
});

describe('device page: history', () => {
  it('lists events newest first with relative times', async () => {
    const d = live();
    await openDevice(d.sn);
    const history = card('History');
    const rows = await within(history).findAllByRole('row');
    expect(rows.length).toBeGreaterThan(2);
    expect(rows[1]).toHaveTextContent(/Config applied|Went offline/);
    expect(within(history).getByText('Provisioned')).toBeInTheDocument();
  });

  it('loads more with the cursor', async () => {
    const d = live();
    db.history.set(
      d.sn,
      Array.from({ length: 60 }, (_, i) => ({
        id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
        kind: 'event' as const,
        type: 'online',
        state: null,
        progress: null,
        error_code: null,
        detail: null,
        created_at: new Date(Date.parse('2026-09-29T08:00:00Z') - i * 60_000).toISOString(),
      })),
    );
    await openDevice(d.sn);
    const history = card('History');
    await waitFor(() => expect(within(history).getAllByRole('row')).toHaveLength(51));
    fireEvent.click(within(history).getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(within(history).getAllByRole('row')).toHaveLength(61));
    expect(within(history).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});

describe('device page: rollout banner', () => {
  it('names the rollout and the gateway state, with download progress', async () => {
    const rollout = db.rollouts.find((r) => r.id === 'R-014');
    const sn = rollout?.waves
      .flatMap((w) => w.devices ?? [])
      .find((x) => x.state === 'downloading')?.sn;
    if (!sn) throw new Error('no downloading device');
    await openDevice(sn);
    expect(await screen.findByText('In rollout R-014')).toBeInTheDocument();
    expect(
      screen.getByText(/Downloading firmware 42% · target firmware 1\.3\.0/),
    ).toBeInTheDocument();
  });

  it('is absent for a gateway that is in no active rollout', async () => {
    const inRollout = new Set(
      db.rollouts.flatMap((r) => r.waves.flatMap((w) => w.devices ?? [])).map((x) => x.sn),
    );
    const d = db.devices.find((x) => x.online && !inRollout.has(x.sn));
    if (!d) throw new Error('no free device');
    await openDevice(d.sn);
    await screen.findByRole('region', { name: 'History' });
    expect(screen.queryByText(/^In rollout/)).not.toBeInTheDocument();
  });
});
