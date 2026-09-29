import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { fastPolling } from '../../../tests/fastPolling';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

const online = () => {
  const d = db.devices.find((x) => x.online && x.lifecycle === 'active');
  if (!d) throw new Error('no online device');
  return d;
};

async function openAsAdmin() {
  const d = online();
  signInAs('admin');
  renderApp(`/devices/${d.sn}`);
  await screen.findByRole('heading', { level: 1, name: d.sn });
  return d;
}

const run = (name: string) =>
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Remote actions' })).getByRole('button', { name }),
  );
const panel = (title: string) => screen.findByRole('region', { name: title });

/** Job polls (GET /jobs/:id) seen while a test runs. */
function countJobPolls() {
  let n = 0;
  const listener = ({ request }: { request: Request }) => {
    if (request.method === 'GET' && /\/jobs\/[^/]+$/.test(new URL(request.url).pathname)) n++;
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return () => n;
}

describe('ping', () => {
  it('shows pending at once, then the result line, and stops polling', async () => {
    fastPolling(60);
    const polls = countJobPolls();
    await openAsAdmin();
    run('Run ping test');
    const card = await panel('Ping test');
    expect(within(card).getByText('Pending')).toBeInTheDocument();
    expect(await within(card).findByText('0% packet loss, avg 42 ms')).toBeInTheDocument();
    expect(within(card).getByText('Succeeded')).toBeInTheDocument();
    const after = polls();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(polls()).toBe(after);
  });

  it('appears in the History card once finished', async () => {
    fastPolling(60);
    await openAsAdmin();
    run('Run ping test');
    await screen.findByText('0% packet loss, avg 42 ms');
    const history = screen.getByRole('region', { name: 'History' });
    expect(await within(history).findByText('Ping test')).toBeInTheDocument();
    expect(await within(history).findByText('Succeeded')).toBeInTheDocument();
  });

  it('says the request is already pending when a second one is started', async () => {
    fastPolling(5000);
    await openAsAdmin();
    run('Run ping test');
    await panel('Ping test');
    const again = screen.getByRole('button', { name: 'Run ping test' });
    await waitFor(() => expect(again).not.toHaveAttribute('aria-busy'));
    run('Run ping test');
    expect(
      await screen.findByText('A ping is already pending for this gateway.'),
    ).toBeInTheDocument();
    expect(db.jobs).toHaveLength(1);
  });
});

describe('logs', () => {
  it('shows upload progress, then a Download button that opens the link', async () => {
    fastPolling(60);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    onTestFinished(() => open.mockRestore());
    await openAsAdmin();
    run('Pull logs');
    const card = await panel('Pull logs');
    expect(
      await within(card).findByRole('progressbar', { name: 'Pull logs progress' }),
    ).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Download logs' })).not.toBeInTheDocument();
    fireEvent.click(await within(card).findByRole('button', { name: 'Download logs' }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(expect.stringContaining('/dl/'), '_blank', 'noopener'),
    );
  });
});

describe('cancel', () => {
  it('cancels a pending job and offers to dismiss it', async () => {
    fastPolling(5000);
    await openAsAdmin();
    run('Pull logs');
    const card = await panel('Pull logs');
    fireEvent.click(within(card).getByRole('button', { name: 'Cancel' }));
    expect(await within(card).findByText('Cancelled')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Pull logs' })).not.toBeInTheDocument(),
    );
  });
});

describe('failure', () => {
  it('shows the API error code and message, and Retry starts a new job', async () => {
    fastPolling(60);
    db.failActions.add('ping');
    await openAsAdmin();
    run('Run ping test');
    const card = await panel('Ping test');
    const alert = await within(card).findByRole('alert');
    expect(alert).toHaveTextContent('agent_unreachable');
    expect(alert).toHaveTextContent('The gateway agent did not answer in time.');
    expect(within(card).getByText('Failed')).toBeInTheDocument();
    db.failActions.clear();
    fireEvent.click(within(card).getByRole('button', { name: 'Retry' }));
    expect(await within(card).findByText('0% packet loss, avg 42 ms')).toBeInTheDocument();
    expect(db.jobs).toHaveLength(2);
  });
});
