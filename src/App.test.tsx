import { render, screen } from '@testing-library/preact';
import { http, HttpResponse } from 'msw';
import { server } from '../tests/msw/server';
import { App } from './App';

describe('App', () => {
  it('renders the placeholder heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'gwfleet' })).toBeInTheDocument();
  });

  it('runs requests through MSW', async () => {
    server.use(http.get('*/api/v1/health', () => HttpResponse.json({ status: 'ok' })));
    const res = await fetch(new URL('/api/v1/health', window.location.origin));
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
