import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { HttpResponse, http } from 'msw';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { api } from '../../../tests/msw/handlers/api';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

async function openUsers() {
  signInAs('admin');
  renderApp('/users');
  return screen.findByRole('table', { name: 'Users' });
}

const rowFor = (name: string) =>
  screen.getAllByRole('row').find((r) => r.textContent?.includes(name)) as HTMLElement;

function openAddDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
  return screen.getByRole('dialog', { name: 'Add user' });
}

const type = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.input(within(dialog).getByLabelText(label), { target: { value } });

describe('UsersPage', () => {
  it.each(['viewer', 'release'] as const)('sends a %s away from /users', async (role) => {
    signInAs(role);
    const { currentPath } = renderApp('/users');
    expect(await screen.findByText(/can't open Users/)).toBeInTheDocument();
    expect(currentPath()).toBe('/');
  });

  it('shows the admin every user with name, email and role', async () => {
    await openUsers();
    expect(screen.getAllByRole('row')).toHaveLength(db.users.length + 1);
    const row = rowFor('Rui Release');
    expect(row).toHaveTextContent('release@gwfleet.test');
    expect(within(row).getByRole('combobox', { name: 'Role for Rui Release' })).toHaveValue(
      'release',
    );
  });

  it('protects the admin from changing their own role or deleting themselves', async () => {
    await openUsers();
    const me = rowFor('Ada Admin');
    expect(within(me).getByText('You')).toBeInTheDocument();
    expect(within(me).getByRole('combobox')).toBeDisabled();
    expect(
      within(me).getByRole('button', { name: 'Delete Ada Admin' }),
    ).toHaveAccessibleDescription("You can't delete your own account");
  });

  it('validates required fields and email format before sending', async () => {
    await openUsers();
    const dialog = openAddDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add user' }));
    expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription('Enter a name.');
    expect(within(dialog).getByLabelText('Password')).toHaveAccessibleDescription(
      "Give it to them securely; it isn't shown again. Enter a password.",
    );
    type(dialog, 'Email', 'not-an-email');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add user' }));
    expect(within(dialog).getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a valid email address, like name@example.com.',
    );
  });

  it('offers exactly the three roles', async () => {
    await openUsers();
    const dialog = openAddDialog();
    const options = within(within(dialog).getByRole('combobox', { name: 'Role' })).getAllByRole(
      'option',
    );
    expect(options.map((o) => o.textContent)).toEqual(['Viewer', 'Release engineer', 'Admin']);
  });

  it('adds a user, with a password strength hint, and never shows the password', async () => {
    await openUsers();
    const dialog = openAddDialog();
    type(dialog, 'Name', 'Nia New');
    type(dialog, 'Email', 'nia@gwfleet.test');
    type(dialog, 'Password', 'short');
    expect(within(dialog).getByText(/Too short/)).toBeInTheDocument();
    type(dialog, 'Password', 'Correct-Horse-9-Battery');
    expect(within(dialog).getByText('Strong')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'password');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add user' }));
    expect(await screen.findByText('Added Nia New as Viewer')).toBeInTheDocument();
    await waitFor(() => expect(rowFor('Nia New')).toHaveTextContent('nia@gwfleet.test'));
    expect(document.body.textContent).not.toContain('Correct-Horse-9-Battery');
  });

  it('explains a duplicate email on the email field', async () => {
    await openUsers();
    const dialog = openAddDialog();
    type(dialog, 'Name', 'Copy');
    type(dialog, 'Email', 'viewer@gwfleet.test');
    type(dialog, 'Password', 'whatever-long-enough');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add user' }));
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Email')).toHaveAccessibleDescription(
        'A user with this email already exists.',
      ),
    );
  });

  it('changes a role from the table', async () => {
    await openUsers();
    const select = within(rowFor('Vera Viewer')).getByRole('combobox') as HTMLSelectElement;
    select.value = 'release';
    fireEvent(select, new Event('change', { bubbles: true }));
    expect(await screen.findByText('Vera Viewer is now Release engineer')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(rowFor('Vera Viewer')).getByRole('combobox')).toHaveValue('release'),
    );
  });

  it('deletes a user after confirming', async () => {
    await openUsers();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Vera Viewer' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Vera Viewer?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleted Vera Viewer')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('viewer@gwfleet.test')).not.toBeInTheDocument());
  });

  it('shows an error with Retry when the list fails', async () => {
    server.use(
      http.get(api('/users'), () =>
        HttpResponse.json(
          { error: { code: 'boom', message: 'Users are unavailable' } },
          { status: 500 },
        ),
      ),
    );
    signInAs('admin');
    renderApp('/users');
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Users are unavailable',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
