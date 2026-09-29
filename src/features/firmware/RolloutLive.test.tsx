import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { fastPolling } from '../../../tests/fastPolling';
import { startRollout, stepRollouts } from '../../../tests/msw/fixtures/rolloutSim';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

/** A GW400 rollout the simulation moves along, in waves of the given percentages. */
function seedRollout(waves = [100]) {
  return startRollout(
    { model_id: 'GW400', fw_version: '3.0.2', waves, failure_threshold: 10 },
    'Rui Release',
  );
}

async function openFirmware(role: 'viewer' | 'release' = 'release') {
  signInAs(role);
  const view = renderApp('/firmware');
  return {
    ...view,
    ...(await screen.findByRole('region', { name: 'Start a rollout' }).then(() => ({}))),
  };
}

const card = (id: string) => screen.findByRole('region', { name: new RegExp(`^${id}: `) });

function countRolloutPolls(id: string) {
  let n = 0;
  const listener = ({ request }: { request: Request }) => {
    if (request.method === 'GET' && new URL(request.url).pathname.endsWith(`/rollouts/${id}`)) n++;
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return () => n;
}

describe('seeded rollouts', () => {
  it('shows each active rollout with its state, and the reason a paused one stopped', async () => {
    await openFirmware();
    const paused = await card('R-013');
    expect(within(paused).getByText('Paused')).toBeInTheDocument();
    expect(within(paused).getByText('Paused automatically')).toBeInTheDocument();
    expect(
      within(paused).getByText(/Failure threshold reached: 2 gateways rolled back/),
    ).toBeInTheDocument();
    expect(within(await card('R-014')).getByText('Running')).toBeInTheDocument();
    expect(within(await card('R-012')).getByText('Soaking')).toBeInTheDocument();
  });

  it('lists finished rollouts as one row each', async () => {
    await openFirmware();
    const table = await screen.findByRole('table', { name: 'Finished rollouts' });
    expect(within(table).getByText('R-011')).toBeInTheDocument();
    expect(within(table).getByText('Completed')).toBeInTheDocument();
  });
});

describe('wave board', () => {
  it('draws one labelled square per gateway per wave, and a legend of every state', async () => {
    await openFirmware();
    const c = await card('R-014');
    const r = db.rollouts.find((x) => x.id === 'R-014');
    const total = r?.waves.reduce((n, w) => n + (w.devices?.length ?? 0), 0);
    await waitFor(() =>
      expect(within(c).getAllByRole('button', { name: /: / }).length).toBe(total),
    );
    const first = r?.waves[0]?.devices?.[0];
    expect(within(c).getByRole('button', { name: `${first?.sn}: Updated` })).toHaveClass(
      'wcell--updated',
    );
    expect(within(c).getAllByRole('group', { name: /^Wave \d/ })).toHaveLength(4);
    const legend = within(c).getByRole('list', { name: 'Gateway states' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(8);
    expect(within(c).getByLabelText('Rollout counts')).toHaveTextContent(/Updated\s*23/);
  });

  it('opens a gateway from its square', async () => {
    const { currentPath } = renderWith();
    const c = await card('R-014');
    const sn = db.rollouts.find((x) => x.id === 'R-014')?.waves[0]?.devices?.[0]?.sn ?? '';
    fireEvent.click(await within(c).findByRole('button', { name: new RegExp(`^${sn}:`) }));
    await waitFor(() => expect(currentPath()).toBe(`/devices/${sn}`));
  });
});

function renderWith() {
  signInAs('release');
  return renderApp('/firmware');
}

/**
 * A completed rollout leaves the live list for Finished, and its card goes with it, so "done"
 * is asserted on the Finished row: looking for the badge inside the card races that removal.
 */
const finishedRow = (id: string) =>
  waitFor(
    () => {
      const table = screen.getByRole('table', { name: 'Finished rollouts' });
      const row = within(table)
        .getAllByRole('row')
        .find((r) => r.textContent?.includes(id));
      expect(row).toBeDefined();
      return row as HTMLElement;
    },
    { timeout: 3000 },
  );

describe('a live rollout', () => {
  // Time is frozen (one step a minute) and moved by hand, so nothing races the polling.
  beforeEach(() => {
    db.rolloutStepMs = 60_000;
  });

  it('runs wave by wave to completion, then stops polling', async () => {
    fastPolling(50);
    const r = seedRollout([50, 100]);
    const polls = countRolloutPolls(r.id);
    await openFirmware();
    const c = await card(r.id);
    stepRollouts(4);
    await waitFor(() =>
      expect(within(c).getByLabelText('Rollout counts')).toHaveTextContent(/In progress\s*[1-9]/),
    );
    stepRollouts(40);
    const row = await finishedRow(r.id);
    expect(row).toHaveTextContent('Completed');
    expect(row).toHaveTextContent(/\d+ updated/);
    // Done means off the live list: the card is gone and nothing polls it any more.
    await waitFor(() => expect(c).not.toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 200));
    const settled = polls();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(polls()).toBe(settled);
  });

  it('pauses itself when failures pass the limit, then carries on after Resume', async () => {
    db.rolloutFailurePct = 100;
    fastPolling(50);
    const r = seedRollout([10, 100]);
    // Only gateways that were online with room to update count as failed.
    const first = r.waves[0]?.devices?.filter((d) => d.state === 'waiting').length ?? 0;
    await openFirmware();
    const c = await card(r.id);
    stepRollouts(12);
    expect(
      await within(c).findByText('Paused automatically', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(within(c).getByRole('status')).toHaveTextContent(
      `Auto-paused after wave 1: ${first} of ${first} updated gateways failed (100%, limit 10%).`,
    );
    db.rolloutFailurePct = 0;
    fireEvent.click(within(c).getByRole('button', { name: 'Resume' }));
    expect(await screen.findByText(`${r.id} resumed`)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(c).queryByText('Paused automatically')).not.toBeInTheDocument(),
    );
    stepRollouts(40);
    expect(await finishedRow(r.id)).toHaveTextContent('Completed');
  });

  it('pauses and resumes on request', async () => {
    fastPolling(5000);
    const r = seedRollout();
    await openFirmware();
    const c = await card(r.id);
    fireEvent.click(await within(c).findByRole('button', { name: 'Pause' }));
    expect(await within(c).findByText(/Someone paused this rollout/)).toBeInTheDocument();
    expect(within(c).queryByText('Paused automatically')).not.toBeInTheDocument();
    fireEvent.click(within(c).getByRole('button', { name: 'Resume' }));
    await waitFor(() =>
      expect(within(c).queryByText(/Someone paused this rollout/)).not.toBeInTheDocument(),
    );
    expect(within(c).getByText('Running')).toBeInTheDocument();
  });

  it('aborts only after the rollout id is typed, then moves it to Finished', async () => {
    fastPolling(5000);
    const r = seedRollout();
    await openFirmware();
    const c = await card(r.id);
    fireEvent.click(await within(c).findByRole('button', { name: 'Abort' }));
    const dialog = await screen.findByRole('dialog', { name: `Abort ${r.id}?` });
    const confirm = within(dialog).getByRole('button', { name: 'Abort rollout' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    const input = within(dialog).getByLabelText(`Type ${r.id} to confirm`);
    fireEvent.input(input, { target: { value: 'R-01' } });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    fireEvent.input(input, { target: { value: r.id } });
    fireEvent.click(confirm);
    expect(await screen.findByText(`${r.id} aborted`)).toBeInTheDocument();
    const finished = await screen.findByRole('table', { name: 'Finished rollouts' });
    expect(await within(finished).findByText('Aborted')).toBeInTheDocument();
    expect(db.rollouts.find((x) => x.id === r.id)?.state).toBe('aborted');
  });

  it('disables every control for a viewer', async () => {
    signInAs('viewer');
    renderApp('/firmware');
    const c = await card('R-013');
    for (const name of ['Resume', 'Abort']) {
      const button = within(c).getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('title', "Your role (Viewer) can't do this");
    }
  });
});

describe('empty and error states', () => {
  it('says so when no rollout is running', async () => {
    db.rollouts = [];
    await openFirmware();
    expect(await screen.findByText('No rollout is running.')).toBeInTheDocument();
    expect(await screen.findByText('No finished rollouts yet.')).toBeInTheDocument();
  });
});
