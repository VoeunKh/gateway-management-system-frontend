import { screen, waitFor } from '@testing-library/preact';
import { signInAs } from '../../tests/msw/auth';
import { renderApp, renderWithProviders } from '../../tests/renderApp';
import { Button } from '@/ui';
import { Can } from './guards';
import { deniedMessage } from './permissions';

describe('RequireRole', () => {
  it('sends a viewer away from /users with a toast saying why', async () => {
    signInAs('viewer');
    const { currentPath } = renderApp('/users');
    expect(await screen.findByText("Your role (Viewer) can't open Users.")).toBeInTheDocument();
    expect(currentPath()).toBe('/');
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('lets an admin open /users', async () => {
    signInAs('admin');
    const { currentPath } = renderApp('/users');
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(currentPath()).toBe('/users');
  });
});

describe('Can', () => {
  const control = (
    <Can perm="rollout">
      <Button variant="primary">Start rollout</Button>
    </Can>
  );

  it('leaves the control enabled for a release engineer', async () => {
    signInAs('release');
    renderWithProviders(control);
    const button = await screen.findByRole('button', { name: 'Start rollout' });
    // Screens render only after the session loads; wait for that here too.
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled'));
    expect(button.title).toBe('');
    expect(button).not.toHaveAccessibleDescription();
  });

  it("disables the control for a viewer with the role message, but doesn't hide it", async () => {
    signInAs('viewer');
    renderWithProviders(control);
    const button = await screen.findByRole('button', {
      name: 'Start rollout',
      description: "Your role (Viewer) can't do this",
    });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(deniedMessage(null)).toBe("Your role (Signed out) can't do this");
  });
});
