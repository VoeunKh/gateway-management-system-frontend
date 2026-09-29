import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { renderApp } from '../../../tests/renderApp';

async function openEditor() {
  signInAs('release');
  const view = renderApp('/config?model=GW200');
  fireEvent.click(await screen.findByRole('button', { name: 'New version' }));
  const form = screen.getByRole('form', { name: 'New config version' });
  return {
    ...view,
    form,
    text: within(form).getByLabelText('Config (uci export)') as HTMLTextAreaElement,
  };
}

const typeText = (el: HTMLElement, value: string) => fireEvent.input(el, { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save version' }));

describe('VersionEditor', () => {
  it('starts from the latest version and counts characters', async () => {
    const { text } = await openEditor();
    const latest = db.configs.get('GW200')?.at(-1)?.text ?? '';
    expect(text.value).toBe(latest);
    expect(screen.getByText(`${latest.length} characters`)).toBeInTheDocument();
  });

  it('asks for a note before saving', async () => {
    const { text } = await openEditor();
    typeText(text, `${text.value}\n\toption zonename 'UTC'`);
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note describing the change.');
  });

  it('refuses to save unchanged text', async () => {
    const { form } = await openEditor();
    typeText(within(form).getByLabelText('Note'), 'No-op');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing changed from v3.');
  });

  it("shows the server's line number and message, and marks that line", async () => {
    const { form, text } = await openEditor();
    typeText(within(form).getByLabelText('Note'), 'Broken');
    typeText(text, 'package network\nthis is not uci\nconfig system');
    save();
    expect(await screen.findByRole('alert')).toHaveTextContent('Line 2: line 2 is not valid UCI');
    expect(text).toHaveAttribute('aria-invalid', 'true');
    expect(form.querySelector('.editor__gutter--error')).toHaveTextContent('2');
  });

  it('saves, announces it and selects the new version', async () => {
    const { form, text, currentPath } = await openEditor();
    typeText(within(form).getByLabelText('Note'), 'Zone name');
    typeText(text, `${text.value}\n\toption zonename 'UTC'`);
    save();
    expect(await screen.findByText('Saved GW200 config v4')).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/config?model=GW200&v=4'));
    const diff = await screen.findByLabelText('Changes in v4');
    const added = [...diff.querySelectorAll('.diff__line--added')].map((l) => l.textContent);
    expect(added).toContain("+ \toption zonename 'UTC'\n");
  });

  it('inserts a tab on Tab, but lets Esc then Tab leave the editor', async () => {
    const { text } = await openEditor();
    typeText(text, 'ab');
    text.setSelectionRange(1, 1);
    fireEvent.keyDown(text, { key: 'Tab' });
    expect(text.value).toBe('a\tb');
    fireEvent.keyDown(text, { key: 'Escape' });
    const leave = fireEvent.keyDown(text, { key: 'Tab' });
    expect(leave).toBe(true); // not prevented: the browser moves focus on
    expect(text.value).toBe('a\tb');
  });

  it('cancels back to the version view', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('list', { name: 'Config versions' })).toBeInTheDocument();
  });
});
