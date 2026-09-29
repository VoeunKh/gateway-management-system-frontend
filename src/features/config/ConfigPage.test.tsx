import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { signInAs } from '../../../tests/msw/auth';
import { db } from '../../../tests/msw/db';
import { renderApp } from '../../../tests/renderApp';
import { DiffView } from './DiffView';
import { summarizeFleet } from './useConfig';

async function openConfig(role: 'viewer' | 'release' | 'admin' = 'release', path = '/config') {
  signInAs(role);
  const view = renderApp(path);
  await screen.findByRole('list', { name: 'Config versions' });
  return view;
}

const versionButton = (v: number) =>
  within(screen.getByRole('list', { name: 'Config versions' }))
    .getAllByRole('button')
    .find((b) => b.textContent?.startsWith(`v${v}`)) as HTMLElement;

describe('ConfigPage', () => {
  it('lists versions newest first with the Target badge on the targeted version', async () => {
    await openConfig();
    const items = within(screen.getByRole('list', { name: 'Config versions' })).getAllByRole(
      'button',
    );
    expect(items.map((b) => b.textContent?.slice(0, 2))).toEqual(['v3', 'v2', 'v1']);
    await waitFor(() => expect(within(versionButton(3)).getByText('Target')).toBeInTheDocument());
    expect(within(versionButton(2)).queryByText('Target')).not.toBeInTheDocument();
    // v3 was written by the fixture's release engineer, who is signed in here.
    expect(versionButton(3)).toHaveTextContent('Bigger log buffer');
    expect(versionButton(3)).toHaveTextContent(/· you$/);
  });

  it('shows what the selected version changed against the previous one', async () => {
    const { currentPath } = await openConfig();
    fireEvent.click(versionButton(2));
    await waitFor(() => expect(currentPath()).toBe('/config?model=GW200&v=2'));
    const diff = await screen.findByLabelText('Changes in v2');
    const added = diff.querySelectorAll('.diff__line--added');
    const removed = diff.querySelectorAll('.diff__line--removed');
    expect([...added].map((l) => l.textContent)).toContain("+ \toption mtu '1400'\n");
    expect([...removed].map((l) => l.textContent)).toContain("- \toption mtu '1500'\n");
    const unchanged = diff.querySelectorAll('.diff__line--unchanged');
    expect(unchanged[0]?.textContent).toBe('  package network\n');
  });

  it('shows the first version in full, since there is nothing to compare', async () => {
    await openConfig('release', '/config?model=GW200&v=1');
    expect(screen.getByText(/The first version/)).toBeInTheDocument();
    expect(screen.getByLabelText('Config v1')).toHaveTextContent('package network');
  });

  it('switches model from the segmented control and summarises its fleet', async () => {
    const { currentPath } = await openConfig();
    fireEvent.click(screen.getByRole('radio', { name: 'GW300' }));
    await waitFor(() => expect(currentPath()).toBe('/config?model=GW300'));
    const devices = db.devices.filter((d) => d.model_id === 'GW300');
    const expected = summarizeFleet(devices);
    const summary = await screen.findByLabelText('Fleet summary');
    await waitFor(() => expect(summary).toHaveTextContent(`${expected.drifted} drifted`));
    expect(summary).toHaveTextContent(`${expected.inSync} in sync`);
    expect(summary).toHaveTextContent('Target v3');
  });

  it('offers to write the first version for a model with none', async () => {
    signInAs('release');
    renderApp('/config?model=GW400');
    expect(
      await screen.findByRole('heading', { name: 'No config versions yet' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/nothing pushed yet/)).toBeInTheDocument();
  });

  it('is read-only for a viewer: New version is disabled with the role tooltip', async () => {
    await openConfig('viewer');
    const button = screen.getByRole('button', { name: 'New version' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription("Your role (Viewer) can't do this");
    fireEvent.click(button);
    expect(screen.queryByRole('form', { name: 'New config version' })).not.toBeInTheDocument();
  });
});

describe('DiffView', () => {
  it('says "No changes" when nothing changed', () => {
    render(<DiffView ops={[{ op: '=', text: 'package network' }]} label="Changes" />);
    expect(screen.getByText('No changes from the previous version.')).toBeInTheDocument();
  });
});

describe('summarizeFleet', () => {
  it('counts in-sync, drifted and not-reported gateways', () => {
    const base = {
      sn: 'x',
      model_id: 'M',
      model_name: 'M',
      site_name: '',
      lifecycle: 'active',
      online: true,
      health: 'healthy',
      package_drift: 'ok',
    } as const;
    expect(
      summarizeFleet([
        { ...base, cfg_version: 3, target_cfg_version: 3, drift: false },
        { ...base, cfg_version: 2, target_cfg_version: 3, drift: true },
        { ...base, cfg_version: null, target_cfg_version: 3, drift: true },
      ]),
    ).toEqual({ target: 3, total: 3, inSync: 1, drifted: 1, notReported: 1 });
    expect(summarizeFleet([]).target).toBeNull();
  });
});
