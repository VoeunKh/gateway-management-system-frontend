import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';
import type { Role } from '@/auth/permissions';

async function openOverview(role: Role = 'viewer') {
  signInAs(role);
  renderApp('/');
  await screen.findByRole('heading', { name: 'Firmware by model' });
}

/** Paths requested while a test runs. */
function recordPaths() {
  const seen: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    seen.push(new URL(request.url).pathname);
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return seen;
}

describe('FirmwareSplit', () => {
  it('splits each model into widths that add up to 100%', async () => {
    await openOverview();
    for (const { model } of db.models) {
      const bar = screen.getByRole('img', { name: new RegExp(`^${model.id}: `) });
      const widths = [...bar.children].map((part) => parseFloat((part as HTMLElement).style.width));
      expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
    }
  });

  it('lists every version with its count', async () => {
    await openOverview();
    const bar = screen.getByRole('img', { name: /^GW210: / });
    const legend = within(bar.closest('li') as HTMLElement).getAllByRole('listitem');
    const fleet = db.devices.filter((d) => d.model_id === 'GW210');
    const expected = [...new Set(fleet.map((d) => d.fw_version))].map(
      (fw) => `${fw} ${fleet.filter((d) => d.fw_version === fw).length}`,
    );
    expect(legend.map((item) => item.textContent).sort()).toEqual(expected.sort());
  });
});

describe('RolloutMini', () => {
  it('shows each active rollout with its state and progress', async () => {
    await openOverview();
    const card = (await screen.findByRole('heading', { name: 'Active rollouts' })).closest(
      'section',
    ) as HTMLElement;
    await within(card).findByRole('link', { name: 'R-014' });
    for (const label of ['Running', 'Paused', 'Soaking']) {
      expect(within(card).getByText(label)).toBeInTheDocument();
    }
    const r014 = db.rollouts.find((r) => r.id === 'R-014');
    const size = Object.values(r014?.counters ?? {}).reduce((a, b) => a + b, 0);
    expect(within(card).getByRole('progressbar', { name: 'R-014 progress' })).toHaveAttribute(
      'aria-valuenow',
      String(r014?.counters.updated),
    );
    expect(
      within(card).getByText(`${r014?.counters.updated} of ${size} updated`),
    ).toBeInTheDocument();
    expect(within(card).getByText(/Failure threshold reached/)).toBeInTheDocument();
  });

  it('is absent, and not requested, when no rollout is active', async () => {
    db.rollouts = db.rollouts.filter((r) => r.state === 'completed');
    const paths = recordPaths();
    await openOverview();
    expect(screen.queryByRole('heading', { name: 'Active rollouts' })).not.toBeInTheDocument();
    expect(paths).not.toContain('/api/v1/rollouts');
  });
});

describe('AlertsPreview', () => {
  const card = async () =>
    (await screen.findByRole('heading', { name: 'Open alerts' })).closest('section') as HTMLElement;

  it('shows at most the 5 newest open alerts', async () => {
    await openOverview();
    const alerts = await card();
    await waitFor(() => expect(within(alerts).getAllByRole('listitem')).toHaveLength(5));
    const newest = db.alerts.find((a) => a.resolved_at === null);
    expect(within(alerts).getAllByRole('listitem')[0]).toHaveTextContent(newest?.message ?? '');
  });

  it('lets an admin acknowledge an alert', async () => {
    await openOverview('admin');
    const alerts = await card();
    const target = db.alerts.find((a) => a.resolved_at === null && !a.acked_at);
    const button = await within(alerts).findByRole('button', {
      name: `Acknowledge alert on ${target?.sn}`,
    });
    expect(button).not.toHaveAttribute('aria-disabled');
    fireEvent.click(button);
    expect(await screen.findByText(`Acknowledged the alert on ${target?.sn}`)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(alerts).getAllByText('Acknowledged by Ada Admin').length).toBeGreaterThan(1),
    );
  });

  it('disables Acknowledge for a viewer and says why', async () => {
    await openOverview('viewer');
    const alerts = await card();
    const [button] = await within(alerts).findAllByRole('button', { name: /^Acknowledge alert/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('title', "Your role (Viewer) can't do this");
  });

  it('says so when nothing is open', async () => {
    db.alerts = [];
    await openOverview();
    const alerts = await card();
    expect(await within(alerts).findByText('No open alerts.')).toBeInTheDocument();
  });
});
