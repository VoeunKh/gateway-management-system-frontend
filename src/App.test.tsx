import { screen } from '@testing-library/preact';
import { renderApp } from '../tests/renderApp';

describe('App', () => {
  it('starts at the login page when nobody is signed in', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Sign in to gwfleet' })).toBeInTheDocument();
  });
});
