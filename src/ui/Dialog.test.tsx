import { fireEvent, render, screen } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { Button } from './Button';
import { Dialog } from './Dialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Reboot…</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reboot gateway"
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger">Reboot</Button>
          </>
        }
      >
        <p>The gateway drops its LTE link for about two minutes.</p>
      </Dialog>
    </>
  );
}

function openDialog() {
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Reboot…' });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole('dialog', { name: 'Reboot gateway' }) };
}

describe('Dialog', () => {
  it('opens with focus on its first control', () => {
    const { dialog } = openDialog();
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('traps Tab and Shift+Tab inside the dialog', () => {
    const { dialog } = openDialog();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const reboot = screen.getByRole('button', { name: 'Reboot' });

    reboot.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(reboot).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const { dialog, trigger } = openDialog();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Reboot gateway' })).not.toBeInTheDocument();
    expect(dialog).not.toHaveAttribute('open');
    expect(trigger).toHaveFocus();
  });

  it('closes on the native cancel event', () => {
    const { dialog, trigger } = openDialog();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).not.toHaveAttribute('open');
    expect(trigger).toHaveFocus();
  });
});
