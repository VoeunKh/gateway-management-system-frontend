import { fireEvent, screen } from '@testing-library/preact';
import { signInAs } from '../../tests/msw/auth';
import { renderApp } from '../../tests/renderApp';

describe('routes', () => {
  it.each([
    ['/', 'Overview'],
    ['/devices', 'Devices'],
    ['/devices/GW300-0007', 'GW300-0007'],
    ['/config', 'Configuration'],
    ['/firmware', 'Firmware'],
    ['/alerts', 'Alerts'],
  ])('%s renders its screen', async (path, heading) => {
    signInAs('viewer');
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('shows a not-found page with a way home', async () => {
    signInAs('viewer');
    const { currentPath } = renderApp('/nowhere');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Go to the overview' }));
    expect(currentPath()).toBe('/');
  });

  it('sends a signed-in user away from /login', async () => {
    signInAs('viewer');
    const { currentPath } = renderApp('/login?next=%2Falerts');
    expect(await screen.findByRole('heading', { name: 'Alerts' })).toBeInTheDocument();
    expect(currentPath()).toBe('/alerts');
  });
});
