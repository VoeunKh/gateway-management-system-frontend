import { act, fireEvent, screen } from '@testing-library/preact';
import { HttpResponse, http } from 'msw';
import { api } from '../../tests/msw/handlers/api';
import { server } from '../../tests/msw/server';
import { signInAs } from '../../tests/msw/auth';
import { renderApp } from '../../tests/renderApp';
import { SESSION_EXPIRED, authEvents, getAccessToken, setAccessToken } from '@/api/token';

describe('session', () => {
  it('bootstraps the signed-in user from /auth/me', async () => {
    signInAs('viewer');
    renderApp('/');
    expect(await screen.findByText('Vera Viewer')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('restores the session after a reload through the refresh cookie', async () => {
    signInAs('admin');
    setAccessToken(null);
    renderApp('/');
    expect(await screen.findByText('Ada Admin')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to login, remembering where they were going', async () => {
    const { currentPath } = renderApp('/devices?health=offline');
    expect(await screen.findByRole('heading', { name: 'Sign in to gwfleet' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login?next=%2Fdevices%3Fhealth%3Doffline');
  });

  it('clears the session and shows login when the session expires', async () => {
    signInAs('release');
    renderApp('/config');
    await screen.findByText('Rui Release');
    act(() => {
      authEvents.dispatchEvent(new Event(SESSION_EXPIRED));
    });
    expect(await screen.findByRole('heading', { name: 'Sign in to gwfleet' })).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(screen.queryByText('Rui Release')).not.toBeInTheDocument();
  });

  it('does not let a slow startup check undo a sign-in', async () => {
    let answerMe = (): void => undefined;
    // The startup check fails late (a dropped connection) after the user has signed in.
    server.use(
      http.get(
        api('/auth/me'),
        async () => {
          await new Promise<void>((resolve) => (answerMe = resolve));
          return HttpResponse.error();
        },
        { once: true },
      ),
    );
    const { currentPath } = renderApp('/login?next=%2Fconfig');
    fireEvent.input(await screen.findByLabelText('Email'), {
      target: { value: 'admin@gwfleet.test' },
    });
    fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'admin-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    await act(async () => {
      answerMe();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(currentPath()).toBe('/config');
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
  });
});
