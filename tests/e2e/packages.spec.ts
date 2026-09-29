import { expect, signIn, test } from './fixtures';

test('any role reads what each model runs, and the model stays in the address', async ({
  page,
}) => {
  await signIn(page, 'viewer');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Packages' })
    .click();
  await expect(page.getByRole('heading', { name: 'Packages', level: 1 })).toBeVisible();
  const table = page.getByRole('table', { name: 'Installed package versions' });
  await expect(table).toBeVisible();
  await expect(page.getByLabel('Package summary')).toContainText('installs');

  await page.getByRole('radio', { name: 'GW300' }).check();
  await expect(page).toHaveURL(/\/packages\?model=GW300/);
  await expect(table.getByText('gw-agent').first()).toBeVisible();
});
