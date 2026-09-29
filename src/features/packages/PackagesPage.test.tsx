import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { HttpResponse, delay, http } from 'msw';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { api } from '../../../tests/msw/handlers/api';
import { server } from '../../../tests/msw/server';
import { renderApp } from '../../../tests/renderApp';

const table = () => screen.findByRole('table', { name: 'Installed package versions' });

/** Installs of one status for a model, counted straight from the fixtures. */
const installs = (modelId: string, status?: string) =>
  db.devices
    .filter((d) => d.model_id === modelId)
    .flatMap((d) => d.packages)
    .filter((p) => !status || p.status === status).length;

describe('PackagesPage', () => {
  it('is reached from the rail, after Firmware', async () => {
    signInAs('viewer');
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels.indexOf('Packages')).toBe(labels.indexOf('Firmware') + 1);
    fireEvent.click(within(nav).getByRole('link', { name: 'Packages' }));
    expect(await screen.findByRole('heading', { name: 'Packages', level: 1 })).toBeInTheDocument();
  });

  it('summarises the first model and lists each installed version with its status', async () => {
    signInAs('viewer');
    renderApp('/packages');
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1);
    expect(rows.length).toBeGreaterThan(0);
    const summary = screen.getByLabelText('Package summary');
    expect(summary).toHaveTextContent(`${installs('GW200')} installs`);
    expect(summary).toHaveTextContent(`${installs('GW200', 'ok')} match their firmware`);
    expect(summary).toHaveTextContent(`${installs('GW200', 'drift')} differ`);
    expect(within(await table()).getAllByText('Differs').length).toBeGreaterThan(0);
  });

  it('switches model and keeps it in the URL', async () => {
    signInAs('viewer');
    const { currentPath } = renderApp('/packages?model=GW200');
    await table();
    fireEvent.click(await screen.findByRole('radio', { name: 'GW300' }));
    await waitFor(() => expect(currentPath()).toBe('/packages?model=GW300'));
    await waitFor(() =>
      expect(screen.getByLabelText('Package summary')).toHaveTextContent(
        `${installs('GW300')} installs`,
      ),
    );
  });

  it('says so when no gateway of the model reports packages', async () => {
    for (const d of db.devices) if (d.model_id === 'GW200') d.packages = [];
    signInAs('viewer');
    renderApp('/packages?model=GW200');
    expect(
      await screen.findByRole('heading', { name: 'No packages reported' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No GW200 gateway has reported/)).toBeInTheDocument();
  });

  it('shows a skeleton while loading', async () => {
    server.use(
      http.get(
        api('/models/:id/packages'),
        async () => {
          await delay(300);
          return HttpResponse.json({ model_id: 'GW200', packages: [] });
        },
        { once: true },
      ),
    );
    signInAs('viewer');
    renderApp('/packages?model=GW200');
    expect(await screen.findByText('Loading packages')).toBeInTheDocument();
  });

  it('shows an error with Retry, and recovers', async () => {
    const down = () =>
      HttpResponse.json({ error: { code: 'boom', message: 'Packages are down' } }, { status: 500 });
    server.use(
      http.get(api('/models/:id/packages'), down, { once: true }),
      http.get(api('/models/:id/packages'), down, { once: true }),
    );
    signInAs('viewer');
    renderApp('/packages?model=GW200');
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'Packages are down',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await table()).toBeInTheDocument();
  });
});
