import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { signInAs } from '../../tests/msw/auth';
import { db } from '../../tests/msw/db';
import { renderApp, renderWithProviders } from '../../tests/renderApp';
import { getAccessToken } from '@/api/token';
import { Shell } from './Shell';

describe('Shell', () => {
  it('marks the active section, including nested pages', async () => {
    signInAs('viewer');
    renderApp('/devices/GW200-0001');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const devices = await screen.findByRole('link', { name: 'Devices' });
    expect(nav).toContainElement(devices);
    expect(devices).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('shows the open-alert count on the Alerts link', async () => {
    signInAs('viewer');
    renderWithProviders(<Shell openAlerts={3}>content</Shell>);
    const alerts = await screen.findByRole('link', { name: 'Alerts, 3 open' });
    expect(alerts).toHaveTextContent('3');
  });

  it('shows Users to admins only, and the role of whoever is signed in', async () => {
    signInAs('viewer');
    renderApp('/');
    await screen.findByText('Vera Viewer');
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('signs out: clears the session and returns to login', async () => {
    signInAs('admin');
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Users' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to gwfleet' })).toBeInTheDocument();
    await waitFor(() => expect(db.refreshUserId).toBeNull());
    expect(getAccessToken()).toBeNull();
  });
});
