import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { VALID_SIGNATURE } from '../../../tests/msw/fixtures/firmware';
import { renderApp } from '../../../tests/renderApp';

type Role = 'viewer' | 'release';

async function openFirmware(role: Role = 'release') {
  signInAs(role);
  renderApp('/firmware');
  await screen.findByRole('table', { name: 'Firmware images' });
}

const row = (text: string) =>
  within(screen.getByRole('table', { name: 'Firmware images' }))
    .getAllByRole('row')
    .find((r) => r.textContent?.includes(text)) as HTMLElement;

/** Chooses a file the way a browser does (fireEvent.change would send `input` on Preact). */
function attach(input: HTMLElement, name: string, content: string) {
  Object.defineProperty(input, 'files', { value: [new File([content], name)], configurable: true });
  fireEvent(input, new Event('change', { bubbles: true }));
}

describe('firmware images', () => {
  it('lists every image with channel, size, file, short SHA-256 and gateway count', async () => {
    await openFirmware();
    const image = db.firmware.find((f) => f.model_id === 'GW210' && f.version === '1.3.1');
    const r = row('1.3.1');
    expect(within(r).getByText('Beta')).toBeInTheDocument();
    expect(within(r).getByText(image?.sha256.slice(0, 12) ?? '')).toBeInTheDocument();
    expect(within(r).getByText(image?.file_name ?? '')).toBeInTheDocument();
    expect(within(r).getByText(String(image?.gateways))).toBeInTheDocument();
  });

  it('shows a blocked image with its reason', async () => {
    await openFirmware();
    expect(
      within(row('3.0.0')).getByText('Blocked: Boot loop on hardware revision B1'),
    ).toBeInTheDocument();
    expect(
      within(row('3.0.0')).getByRole('button', { name: 'Unblock GW400 3.0.0' }),
    ).toBeInTheDocument();
  });

  it('copies the full SHA-256', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: write },
      configurable: true,
    });
    await openFirmware();
    fireEvent.click(screen.getByRole('button', { name: 'Copy SHA-256 of GW200 1.3.0' }));
    const image = db.firmware.find((f) => f.model_id === 'GW200' && f.version === '1.3.0');
    await waitFor(() => expect(write).toHaveBeenCalledWith(image?.sha256));
    expect(await screen.findByText('Copied SHA-256 of GW200 1.3.0')).toBeInTheDocument();
  });

  it('disables upload, block and unblock for a viewer, with the role tooltip', async () => {
    await openFirmware('viewer');
    for (const button of [
      screen.getByRole('button', { name: 'Upload image' }),
      screen.getByRole('button', { name: 'Block GW200 1.3.0' }),
      screen.getByRole('button', { name: 'Unblock GW400 3.0.0' }),
    ]) {
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('title', "Your role (Viewer) can't do this");
    }
  });

  it('blocks an image with a reason, then unblocks it', async () => {
    await openFirmware();
    fireEvent.click(screen.getByRole('button', { name: 'Block GW200 1.2.0' }));
    const dialog = await screen.findByRole('dialog', { name: 'Block GW200 1.2.0?' });
    fireEvent.input(within(dialog).getByLabelText(/Reason/), { target: { value: 'Modem crash' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Block' }));
    expect(await screen.findByText('GW200 1.2.0 blocked')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(row('1.2.0')).getByText('Blocked: Modem crash')).toBeInTheDocument(),
    );
    fireEvent.click(within(row('1.2.0')).getByRole('button', { name: 'Unblock GW200 1.2.0' }));
    expect(await screen.findByText('GW200 1.2.0 unblocked')).toBeInTheDocument();
    expect(db.firmware.find((f) => f.id === 'fw-gw200-1.2.0')?.blocked).toBe(false);
  });
});

describe('upload', () => {
  async function fill(version: string, signature: string) {
    await openFirmware();
    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upload firmware image' });
    fireEvent.input(within(dialog).getByLabelText('Version'), { target: { value: version } });
    attach(within(dialog).getByLabelText('Image file'), 'gw200-1.4.0.bin', 'image-bytes');
    attach(within(dialog).getByLabelText('Signature file (.sig)'), 'gw200-1.4.0.sig', signature);
    return dialog;
  }

  it('asks for every field before sending anything', async () => {
    await openFirmware();
    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload' }));
    expect(within(dialog).getAllByText('Required')).toHaveLength(3);
    expect(db.firmware.some((f) => f.version === '1.4.0')).toBe(false);
  });

  it('stores a correctly signed image and lists it', async () => {
    const dialog = await fill('1.4.0', VALID_SIGNATURE);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Uploaded GW200 1.4.0')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await within(await screen.findByRole('table', { name: 'Firmware images' })).findByText(
        '1.4.0',
      ),
    ).toBeInTheDocument();
    expect(db.firmware.find((f) => f.version === '1.4.0')?.size).toBe('image-bytes'.length);
  });

  it('says plainly what to do about a signature that does not match', async () => {
    const dialog = await fill('1.4.0', 'tampered');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "This image's signature does not match. Check it was signed with the release key.",
    );
    expect(db.firmware.some((f) => f.version === '1.4.0')).toBe(false);
  });

  it('shows the API message for a version that already exists', async () => {
    const dialog = await fill('1.3.0', VALID_SIGNATURE);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'GW200 1.3.0 already exists.',
    );
  });
});
