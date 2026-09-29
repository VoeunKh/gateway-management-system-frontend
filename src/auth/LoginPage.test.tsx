import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { http } from 'msw';
import { api } from '../../tests/msw/handlers/api';
import { server } from '../../tests/msw/server';
import { renderApp } from '../../tests/renderApp';
import { getAccessToken } from '@/api/token';
import { safeNext } from './LoginPage';

async function fillAndSubmit(email: string, password: string) {
  fireEvent.input(await screen.findByLabelText('Email'), { target: { value: email } });
  fireEvent.input(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  it('is a password-manager friendly form with the email focused', async () => {
    renderApp('/login');
    const email = await screen.findByLabelText('Email');
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('form', { name: 'Sign in to gwfleet' })).toBeInTheDocument();
  });

  it('stores the session and goes to the page that sent you here', async () => {
    const { currentPath } = renderApp('/login?next=%2Fdevices');
    await fillAndSubmit('release@gwfleet.test', 'release-pass');
    expect(await screen.findByRole('heading', { name: 'Devices' })).toBeInTheDocument();
    expect(currentPath()).toBe('/devices');
    expect(getAccessToken()).toMatch(/^mock-token-/);
    expect(screen.getByText('Rui Release')).toBeInTheDocument();
  });

  it('shows the API message for a wrong password', async () => {
    renderApp('/login');
    await fillAndSubmit('admin@gwfleet.test', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid email or password');
    expect(getAccessToken()).toBeNull();
  });

  it('explains a locked account', async () => {
    renderApp('/login');
    await fillAndSubmit('locked@gwfleet.test', 'locked-pass');
    expect(await screen.findByRole('alert')).toHaveTextContent(/account is locked/);
  });

  it('asks for missing fields without calling the API', async () => {
    renderApp('/login');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
  });

  it('blocks the submit button while signing in', async () => {
    let release = (): void => undefined;
    server.use(
      http.post(api('/auth/login'), async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return new Response(null, { status: 500 });
      }),
    );
    renderApp('/login');
    await fillAndSubmit('admin@gwfleet.test', 'admin-pass');
    const button = await screen.findByRole('button', { name: 'Signing in…' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    release();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument(),
    );
  });

  it('only follows same-site next paths', () => {
    expect(safeNext('?next=%2Fdevices%3Fq%3DGW2')).toBe('/devices?q=GW2');
    expect(safeNext('?next=https%3A%2F%2Fevil.test')).toBe('/');
    expect(safeNext('?next=%2F%2Fevil.test')).toBe('/');
    expect(safeNext('')).toBe('/');
  });
});
