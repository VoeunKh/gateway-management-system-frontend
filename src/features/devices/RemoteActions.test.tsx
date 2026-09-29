import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { fastPolling } from '../../../tests/fastPolling';
import { renderApp } from '../../../tests/renderApp';

type Role = 'viewer' | 'release' | 'admin';

const online = () => {
  const d = db.devices.find((x) => x.online && x.lifecycle === 'active');
  if (!d) throw new Error('no online device');
  return d;
};

async function openDevice(sn: string, role: Role = 'admin') {
  signInAs(role);
  renderApp(`/devices/${sn}`);
  await screen.findByRole('heading', { level: 1, name: sn });
}

const actions = () => screen.getByRole('group', { name: 'Remote actions' });
const button = (name: string) => within(actions()).getByRole('button', { name });

describe('remote action buttons', () => {
  it.each<Role>(['viewer', 'release'])(
    'are disabled for a %s, with the role tooltip',
    async (role) => {
      await openDevice(online().sn, role);
      for (const name of ['Reboot', 'Pull logs', 'Run ping test']) {
        expect(button(name)).toHaveAttribute('aria-disabled', 'true');
        expect(button(name)).toHaveAttribute('title', expect.stringContaining("can't do this"));
      }
    },
  );

  it('are enabled for an admin on an online gateway', async () => {
    await openDevice(online().sn);
    for (const name of ['Reboot', 'Pull logs', 'Run ping test']) {
      expect(button(name)).not.toHaveAttribute('aria-disabled');
    }
  });

  it('are disabled on an offline gateway, saying why', async () => {
    const d = db.devices.find((x) => !x.online && x.lifecycle === 'active');
    if (!d) throw new Error('no offline device');
    await openDevice(d.sn);
    expect(button('Pull logs')).toHaveAttribute('aria-disabled', 'true');
    expect(button('Pull logs')).toHaveAttribute('title', 'The gateway is offline');
  });

  it('are disabled on a bricked gateway', async () => {
    const d = online();
    d.lifecycle = 'bricked';
    await openDevice(d.sn);
    expect(button('Reboot')).toHaveAttribute('title', 'This gateway needs on-site recovery');
  });
});

describe('reboot', () => {
  it('needs the exact serial number before it can be confirmed', async () => {
    const d = online();
    await openDevice(d.sn);
    fireEvent.click(button('Reboot'));
    const dialog = await screen.findByRole('dialog', { name: `Reboot ${d.sn}?` });
    const confirm = within(dialog).getByRole('button', { name: 'Reboot' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    const input = within(dialog).getByLabelText(`Type ${d.sn} to confirm`);
    fireEvent.input(input, { target: { value: d.sn.slice(0, -1) } });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    fireEvent.input(input, { target: { value: d.sn } });
    expect(confirm).not.toHaveAttribute('aria-disabled');
  });

  it('takes the gateway offline and brings it back, with the panel telling the story', async () => {
    fastPolling(60);
    const d = online();
    await openDevice(d.sn);
    fireEvent.click(button('Reboot'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.input(within(dialog).getByLabelText(`Type ${d.sn} to confirm`), {
      target: { value: d.sn },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reboot' }));
    expect(await screen.findByText(/^Reboot started \(job [0-9a-f]{8}\)$/)).toBeInTheDocument();
    expect(await screen.findByText('Gateway is rebooting.')).toBeInTheDocument();
    expect(await screen.findByText('The gateway rebooted and is back online.')).toBeInTheDocument();
    expect(db.devices.find((x) => x.sn === d.sn)?.online).toBe(true);
    await waitFor(() => expect(screen.getAllByText('Healthy').length).toBeGreaterThan(0));
  });

  it('is not started when the dialog is cancelled', async () => {
    const d = online();
    await openDevice(d.sn);
    fireEvent.click(button('Reboot'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(db.jobs).toHaveLength(0);
  });
});
