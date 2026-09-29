import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { HttpResponse, delay, http } from 'msw';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { api } from '../../../tests/msw/handlers/api';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

type Role = 'viewer' | 'release' | 'admin';

const openAlerts = () => db.alerts.filter((a) => a.resolved_at === null);
const unacked = () => openAlerts().find((a) => !a.acked_at);

async function openAlertsPage(role: Role = 'admin') {
  signInAs(role);
  renderApp('/alerts');
  return screen.findByRole('table', { name: 'Open alerts' });
}

const rows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);

describe('AlertsPage: open alerts', () => {
  it('lists every open alert with a severity label, the gateway and its age', async () => {
    const table = await openAlertsPage();
    expect(rows(table)).toHaveLength(Math.min(25, openAlerts().length));
    const first = openAlerts()[0];
    const row = rows(table)[0] as HTMLElement;
    expect(within(row).getByText(/^(Critical|Warning|Info)$/)).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: first?.sn })).toHaveAttribute(
      'href',
      `/devices/${first?.sn}`,
    );
    expect(within(row).getByText(first?.message ?? '')).toBeInTheDocument();
  });

  it('shows Acknowledge enabled for an admin, and who acknowledged the rest', async () => {
    const table = await openAlertsPage('admin');
    const target = unacked();
    expect(
      within(table).getByRole('button', { name: `Acknowledge alert on ${target?.sn}` }),
    ).not.toHaveAttribute('aria-disabled');
    expect(within(table).getAllByText('By Ada Admin').length).toBeGreaterThan(0);
  });

  it.each<Role>(['viewer', 'release'])(
    'disables Acknowledge for a %s, with the role tooltip',
    async (role) => {
      const table = await openAlertsPage(role);
      const button = within(table).getByRole('button', {
        name: `Acknowledge alert on ${unacked()?.sn}`,
      });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('title', expect.stringContaining("can't do this"));
    },
  );

  it('says so when there are no open alerts', async () => {
    db.alerts = [];
    signInAs('admin');
    renderApp('/alerts');
    expect(await screen.findByRole('heading', { name: 'No open alerts' })).toBeInTheDocument();
  });

  it('shows an error with Retry, and recovers', async () => {
    // The first two requests for the OPEN list fail (the query retries a GET once); the
    // resolved list, which uses the same endpoint, is left alone.
    let failures = 0;
    server.use(
      http.get(api('/alerts'), ({ request }) => {
        const asksForOpen = new URL(request.url).searchParams.get('state') === 'open';
        if (!asksForOpen || failures >= 2) return undefined;
        failures++;
        return HttpResponse.json(
          { error: { code: 'boom', message: 'Alerts are down' } },
          { status: 500 },
        );
      }),
    );
    signInAs('admin');
    renderApp('/alerts');
    expect(await screen.findByText('Alerts are down', {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0] as HTMLElement);
    expect(await screen.findByRole('table', { name: 'Open alerts' })).toBeInTheDocument();
  });
});

describe('AlertsPage: long lists', () => {
  it('shows 25 open alerts at a time and the rest on request', async () => {
    const table = await openAlertsPage();
    const total = openAlerts().length;
    expect(total).toBeGreaterThan(25);
    expect(rows(table)).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: `Show more (${total - 25} more)` }));
    await waitFor(() => expect(rows(table)).toHaveLength(Math.min(50, total)));
  });
});

describe('AlertsPage: acknowledging', () => {
  it('updates the row at once and keeps it when the server agrees', async () => {
    server.use(
      http.post(api('/alerts/:id/ack'), async ({ params }) => {
        await delay(300);
        const alert = db.alerts.find((a) => a.id === params.id);
        if (alert) {
          alert.acked_by = 'Ada Admin';
          alert.acked_at = new Date().toISOString();
        }
        return HttpResponse.json(alert);
      }),
    );
    const table = await openAlertsPage();
    const target = unacked();
    const before = within(table).getAllByText('By Ada Admin').length;
    fireEvent.click(
      within(table).getByRole('button', { name: `Acknowledge alert on ${target?.sn}` }),
    );
    // Optimistic: the server has not answered yet.
    await waitFor(() =>
      expect(within(table).getAllByText('By Ada Admin')).toHaveLength(before + 1),
    );
    expect(db.alerts.find((a) => a.id === target?.id)?.acked_at).toBeNull();
    expect(await screen.findByText(`Acknowledged the alert on ${target?.sn}`)).toBeInTheDocument();
    expect(within(table).getAllByText('By Ada Admin')).toHaveLength(before + 1);
  });

  it('puts the row back and says why when the server refuses', async () => {
    server.use(
      http.post(api('/alerts/:id/ack'), async () => {
        await delay(200);
        return HttpResponse.json(
          { error: { code: 'boom', message: 'Try again later' } },
          { status: 500 },
        );
      }),
    );
    const table = await openAlertsPage();
    const target = unacked();
    const name = `Acknowledge alert on ${target?.sn}`;
    fireEvent.click(within(table).getByRole('button', { name }));
    await waitFor(() =>
      expect(within(table).queryByRole('button', { name })).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText(`Not acknowledged (${target?.sn}): Try again later`),
    ).toBeInTheDocument();
    expect(await within(table).findByRole('button', { name })).toBeInTheDocument();
  });
});

describe('AlertsPage: resolved alerts and rules', () => {
  it('lists recently resolved alerts', async () => {
    await openAlertsPage();
    const table = await screen.findByRole('table', { name: 'Recently resolved alerts' });
    const resolved = db.alerts.filter((a) => a.resolved_at !== null);
    expect(rows(table)).toHaveLength(Math.min(15, resolved.length));
  });

  it('shows the fixed rules and says notifications are not wired up', async () => {
    await openAlertsPage();
    const table = await screen.findByRole('table', { name: 'Alert rules' });
    expect(rows(table)).toHaveLength(5);
    expect(within(table).getByText('Temperature at or above 80 °C')).toBeInTheDocument();
    expect(screen.getByText(/Telegram is on the to-do list/)).toBeInTheDocument();
  });
});

describe('rail badge', () => {
  it('counts the same open alerts the Alerts page lists', async () => {
    const table = await openAlertsPage();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const link = await within(nav).findByRole('link', {
      name: `Alerts, ${openAlerts().length} open`,
    });
    while (screen.queryByRole('button', { name: /^Show more/ })) {
      fireEvent.click(screen.getByRole('button', { name: /^Show more/ }));
    }
    await waitFor(() => expect(rows(table)).toHaveLength(openAlerts().length));
    expect(link).toHaveTextContent(String(openAlerts().length));
  });

  it('shares one request with the overview panel', async () => {
    const seen: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/alerts')) seen.push(url.search);
    };
    server.events.on('request:start', listener);
    onTestFinished(() => server.events.removeListener('request:start', listener));
    signInAs('admin');
    renderApp('/');
    await screen.findByRole('heading', { name: 'Open alerts' });
    await screen.findByRole('link', { name: `Alerts, ${openAlerts().length} open` });
    expect(seen).toEqual(['?state=open&limit=200']);
  });
});
