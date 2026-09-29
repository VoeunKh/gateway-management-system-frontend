import { expect, signIn, test } from './fixtures';

// Flow 3: push a config version and watch drift clear.
test('release engineer pushes a config version and the drifted count falls', async ({
  page,
  mockApi,
}) => {
  const model = 'GW200';
  const target = 3;
  // Offline or inactive gateways never take the push, so they stay drifted.
  const stuck = mockApi.devices.filter(
    (d) =>
      d.model_id === model &&
      d.cfg_version !== null &&
      d.cfg_version !== target &&
      (!d.online || d.lifecycle !== 'active'),
  ).length;
  const summary = page.getByLabel('Fleet summary');

  await signIn(page, 'release', `/config?model=${model}`);
  await expect(summary).toContainText('drifted');
  await expect(summary).not.toContainText(/\b0 drifted/);

  await page.getByRole('button', { name: `Push v${target} to ${model}` }).click();
  const dialog = page.getByRole('dialog', { name: `Push v${target} to ${model}?` });
  await expect(dialog).toContainText(`v${target} will be sent to`);
  await dialog.getByLabel(`Type ${model} to confirm`).fill(model);
  await dialog.getByRole('button', { name: `Push v${target}` }).click();

  await expect(
    page.getByText(new RegExp(`^Pushing v${target} to \\d+ ${model} gateways$`)),
  ).toBeVisible();
  await expect(summary).toContainText(`${stuck} drifted`, { timeout: 20_000 });
});

// Flow 4: start a rollout, watch a wave, pause it, abort it.
test('release engineer starts a rollout, watches a wave, pauses and aborts it', async ({
  page,
  mockApi,
}) => {
  mockApi.rolloutStepMs = 400;
  await signIn(page, 'release', '/firmware');
  const planner = page.getByRole('region', { name: 'Start a rollout' });
  await planner.getByLabel('Model').selectOption('GW400');
  await expect(planner.getByText(/of 60 gateways need this version/)).toBeVisible();
  await expect(planner.getByRole('button', { name: 'Start rollout' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await planner.getByRole('button', { name: 'Start rollout' }).click();

  const card = page.getByRole('region', { name: /^R-015: GW400 to 3\.0\.2/ });
  await expect(card.getByText('Running')).toBeVisible();
  await expect(card.getByRole('group', { name: /^Wave 1, / })).toBeVisible();
  // Wave 1 finishes on its own; the card polls every 5 s.
  await expect(card.getByLabel('Rollout counts')).toContainText(/Updated\s*[1-9]/, {
    timeout: 30_000,
  });

  await card.getByRole('button', { name: 'Pause' }).click();
  await expect(card.getByText(/Someone paused this rollout/)).toBeVisible();

  await card.getByRole('button', { name: 'Abort' }).click();
  const dialog = page.getByRole('dialog', { name: 'Abort R-015?' });
  await dialog.getByLabel('Type R-015 to confirm').fill('R-015');
  await dialog.getByRole('button', { name: 'Abort rollout' }).click();
  const finished = page.getByRole('table', { name: 'Finished rollouts' });
  await expect(finished.getByRole('row', { name: /R-015/ })).toContainText('Aborted');
});

// Flow 5: acknowledge an alert.
test('admin acknowledges an alert and it shows who did', async ({ page, mockApi }) => {
  const alert = mockApi.alerts.find((a) => a.resolved_at === null && !a.acked_at);
  if (!alert) throw new Error('fixture has no unacknowledged alert');
  await signIn(page, 'admin', '/alerts');
  const table = page.getByRole('table', { name: 'Open alerts' });
  const badge = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /^Alerts/ });
  const open = mockApi.alerts.filter((a) => a.resolved_at === null).length;
  await expect(badge).toHaveAccessibleName(`Alerts, ${open} open`);

  const row = table
    .getByRole('row', { name: new RegExp(alert.sn) })
    .filter({ hasText: alert.message });
  await row
    .getByRole('button', { name: `Acknowledge alert on ${alert.sn}` })
    .first()
    .click();
  await expect(page.getByText(`Acknowledged the alert on ${alert.sn}`)).toBeVisible();
  await expect(table.getByText('By Ada Admin').first()).toBeVisible();
  // Acknowledged is still open: the rail count does not change.
  await expect(badge).toHaveAccessibleName(`Alerts, ${open} open`);
});

// Remote action with job tracking.
test('admin runs a ping test and reads the result in the job panel', async ({ page, mockApi }) => {
  const device = mockApi.devices.find((d) => d.online && d.lifecycle === 'active');
  if (!device) throw new Error('fixture has no online device');
  await signIn(page, 'admin', `/devices/${device.sn}`);
  await page.getByRole('button', { name: 'Run ping test' }).click();
  const panel = page.getByRole('region', { name: 'Ping test' });
  await expect(panel.getByText('Pending')).toBeVisible();
  await expect(panel.getByText('0% packet loss, avg 42 ms')).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByText('Succeeded')).toBeVisible();
  await expect(page.getByRole('region', { name: 'History' }).getByText('Ping test')).toBeVisible();
});

// Keyboard only: reach Firmware from the rail, open the upload dialog, close it, keep focus.
test('the firmware screen works by keyboard alone', async ({ page }) => {
  await signIn(page, 'release');
  const link = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Firmware' });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await link.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Firmware and rollouts' })).toBeVisible();

  const upload = page.getByRole('button', { name: 'Upload image' });
  await upload.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Upload firmware image' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Model')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(upload).toBeFocused();
});
