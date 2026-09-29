import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { fastPolling } from '../../../tests/fastPolling';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';
import { targetsOf } from '../../../tests/msw/fixtures/rolloutSim';

async function openFirmware(role: 'viewer' | 'release' = 'release') {
  signInAs(role);
  renderApp('/firmware');
  return screen.findByRole('region', { name: 'Start a rollout' });
}

/** Picks an option the way a browser does (fireEvent.change would send `input`). */
function choose(select: HTMLElement, value: string) {
  (select as HTMLSelectElement).value = value;
  fireEvent(select, new Event('change', { bubbles: true }));
}

const waves = (form: HTMLElement) => within(form).getByLabelText('Waves, % of gateways');
const threshold = (form: HTMLElement) =>
  within(form).getByLabelText('Pause if failures exceed (%)');
const start = (form: HTMLElement) => within(form).getByRole('button', { name: 'Start rollout' });

function previewRequests() {
  const bodies: unknown[] = [];
  const listener = async ({ request }: { request: Request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/rollouts/preview')) {
      bodies.push(await request.clone().json());
    }
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return bodies;
}

describe('rollout form: validation', () => {
  it.each([
    ['1,10,50', 'Waves must end at 100.'],
    ['50,10,100', 'Waves must go up, like 1,10,50,100.'],
    ['ten,100', 'Enter whole percentages from 1 to 100, like 1,10,50,100.'],
  ])('shows a message for waves %j and blocks Start', async (text, message) => {
    const form = await openFirmware();
    fireEvent.input(waves(form), { target: { value: text } });
    expect(await within(form).findByText(message)).toBeInTheDocument();
    expect(start(form)).toHaveAttribute('aria-disabled', 'true');
  });

  it.each(['0', '101'])('shows a message for a failure threshold of %s', async (value) => {
    const form = await openFirmware();
    fireEvent.input(threshold(form), { target: { value } });
    expect(
      await within(form).findByText('Failure threshold must be between 1 and 100.'),
    ).toBeInTheDocument();
    expect(start(form)).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('rollout form: firmware choices', () => {
  it('lists a blocked version as disabled, with the reason', async () => {
    const form = await openFirmware();
    choose(within(form).getByLabelText('Model'), 'GW400');
    const blocked = await within(form).findByRole('option', {
      name: '3.0.0 (blocked: Boot loop on hardware revision B1)',
    });
    expect(blocked).toBeDisabled();
    expect(within(form).getByLabelText('Target firmware')).toHaveValue('3.0.2');
  });
});

describe('rollout form: preview', () => {
  it('shows the plan from the server for the default form', async () => {
    const form = await openFirmware();
    choose(within(form).getByLabelText('Model'), 'GW400');
    const need = targetsOf('GW400', '3.0.2').length;
    // The count is in <strong>, so find the sentence by its tail and read the whole line.
    const plan = (await within(form).findByText(/of 60 gateways need this version/)).closest('p');
    // Until the new answer arrives the old plan stays, dimmed; wait for the right one.
    await waitFor(() =>
      expect(plan).toHaveTextContent(new RegExp(`^${need} of 60 gateways need this version`)),
    );
    expect(plan).not.toHaveAttribute('aria-busy');
    expect(plan).toHaveTextContent('waves');
    expect(plan).toHaveTextContent(/offline will be deferred/);
  });

  it('asks once, with the final values, after typing settles', async () => {
    const bodies = previewRequests();
    const form = await openFirmware();
    await within(form).findByText(/gateways need this version/);
    bodies.length = 0;
    for (const text of ['5', '5,', '5,50', '5,50,100'])
      fireEvent.input(waves(form), { target: { value: text } });
    await waitFor(() => expect(bodies).toHaveLength(1), { timeout: 2000 });
    expect(bodies[0]).toMatchObject({ waves: [5, 50, 100], failure_threshold: 10 });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(bodies).toHaveLength(1);
  });

  it('says why when the server refuses the plan', async () => {
    const form = await openFirmware();
    const image = db.firmware.find((f) => f.id === 'fw-gw200-1.3.0');
    if (image) image.blocked = true;
    fireEvent.input(waves(form), { target: { value: '2,100' } });
    expect(await within(form).findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent(
      'that firmware version is blocked',
    );
    expect(start(form)).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('rollout form: starting', () => {
  it('disables Start for a viewer, with the role tooltip', async () => {
    const form = await openFirmware('viewer');
    expect(start(form)).toHaveAttribute('aria-disabled', 'true');
    expect(start(form)).toHaveAttribute('title', "Your role (Viewer) can't do this");
  });

  it('shows the 409 message when the model already has an active rollout', async () => {
    const form = await openFirmware();
    await waitFor(() => expect(start(form)).not.toHaveAttribute('aria-disabled'));
    fireEvent.click(start(form));
    expect(
      await screen.findByText('Not started: A GW200 rollout is already active.'),
    ).toBeInTheDocument();
  });

  it('starts a rollout and shows its card', async () => {
    fastPolling(5000);
    const form = await openFirmware();
    choose(within(form).getByLabelText('Model'), 'GW400');
    await waitFor(() => expect(start(form)).not.toHaveAttribute('aria-disabled'));
    fireEvent.click(start(form));
    expect(await screen.findByText('Started R-015: GW400 to 3.0.2')).toBeInTheDocument();
    const card = await screen.findByRole('region', { name: 'R-015: GW400 to 3.0.2' });
    expect(within(card).getByText('Running')).toBeInTheDocument();
    expect(db.rollouts[0]?.id).toBe('R-015');
  });
});
