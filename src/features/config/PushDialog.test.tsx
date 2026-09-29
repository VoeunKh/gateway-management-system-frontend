import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { HttpResponse, http } from 'msw';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { fastPolling } from '../../../tests/fastPolling';
import { api } from '../../../tests/msw/handlers/api';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

const MODEL = 'GW200';
const fleet = () => db.devices.filter((d) => d.model_id === MODEL);
const active = () => fleet().filter((d) => d.lifecycle === 'active');

async function openConfig(role: 'viewer' | 'release' = 'release') {
  signInAs(role);
  renderApp(`/config?model=${MODEL}`);
  await screen.findByRole('list', { name: 'Config versions' });
  await screen.findByLabelText('Fleet summary');
}

const pushButton = () => screen.getByRole('button', { name: `Push v3 to ${MODEL}` });

async function openDialog() {
  fireEvent.click(pushButton());
  return screen.findByRole('dialog', { name: `Push v3 to ${MODEL}?` });
}

describe('config push', () => {
  it('is disabled for a viewer, with the role tooltip', async () => {
    await openConfig('viewer');
    expect(pushButton()).toHaveAttribute('aria-disabled', 'true');
    expect(pushButton()).toHaveAttribute('title', "Your role (Viewer) can't do this");
  });

  it('is disabled when the version is the target and every gateway has it', async () => {
    for (const d of fleet()) {
      d.cfg_version = 3;
      d.drift = false;
    }
    await openConfig();
    await waitFor(() => expect(pushButton()).toHaveAttribute('aria-disabled', 'true'));
    expect(pushButton()).toHaveAttribute('title', 'v3 is the target and every gateway has it');
  });

  it('shows how many gateways will get it and how many are offline', async () => {
    await openConfig();
    const dialog = await openDialog();
    const offline = active().filter((d) => !d.online).length;
    expect(await within(dialog).findByText(String(active().length))).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`v3 will be sent to ${active().length} ${MODEL} gateways.`);
    expect(dialog).toHaveTextContent(`${offline} are offline and will take it when they reconnect`);
  });

  it('needs the exact model id, and cancelling pushes nothing', async () => {
    await openConfig();
    const dialog = await openDialog();
    const confirm = within(dialog).getByRole('button', { name: 'Push v3' });
    await within(dialog).findByText(/will be sent to/);
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    const input = within(dialog).getByLabelText(`Type ${MODEL} to confirm`);
    fireEvent.input(input, { target: { value: 'GW20' } });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    fireEvent.input(input, { target: { value: MODEL } });
    expect(confirm).not.toHaveAttribute('aria-disabled');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(db.pushes).toHaveLength(0);
  });

  it('pushes, toasts the job count and watches the drifted count fall', async () => {
    db.pushStepMs = 10;
    fastPolling(60, ['push']);
    const stuck = fleet().filter(
      (d) =>
        d.cfg_version !== null && d.cfg_version !== 3 && (!d.online || d.lifecycle !== 'active'),
    ).length;
    await openConfig();
    const before = screen.getByLabelText('Fleet summary').textContent;
    const dialog = await openDialog();
    await within(dialog).findByText(/will be sent to/);
    fireEvent.input(within(dialog).getByLabelText(`Type ${MODEL} to confirm`), {
      target: { value: MODEL },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Push v3' }));
    expect(
      await screen.findByText(`Pushing v3 to ${active().length} ${MODEL} gateways`),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(before).not.toContain('0 drifted');
    await waitFor(
      () => expect(screen.getByLabelText('Fleet summary')).toHaveTextContent(`${stuck} drifted`),
      {
        timeout: 3000,
      },
    );
  });

  it('says so when the push is refused', async () => {
    server.use(
      http.post(api('/models/:id/configs/:v/push'), () =>
        HttpResponse.json({ error: { code: 'boom', message: 'Queue is full' } }, { status: 500 }),
      ),
    );
    await openConfig();
    const dialog = await openDialog();
    await within(dialog).findByText(/will be sent to/);
    fireEvent.input(within(dialog).getByLabelText(`Type ${MODEL} to confirm`), {
      target: { value: MODEL },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Push v3' }));
    expect(await screen.findByText('Not pushed: Queue is full')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows an error in the dialog when the preview fails, and blocks the push', async () => {
    server.use(
      http.post(api('/models/:id/configs/:v/push/preview'), () =>
        HttpResponse.json({ error: { code: 'boom', message: 'Preview is down' } }, { status: 500 }),
      ),
    );
    await openConfig();
    const dialog = await openDialog();
    expect(
      await within(dialog).findByText('Preview is down', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    fireEvent.input(within(dialog).getByLabelText(`Type ${MODEL} to confirm`), {
      target: { value: MODEL },
    });
    expect(within(dialog).getByRole('button', { name: 'Push v3' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
