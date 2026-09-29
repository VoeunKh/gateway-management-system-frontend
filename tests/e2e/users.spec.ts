import { expect, signIn, test } from './fixtures';

// UI-11 evaluation: an admin creates a user, who can then sign in with their role.
test('admin adds a release engineer who can then sign in', async ({ page }) => {
  await signIn(page, 'admin', '/users');
  await page.getByRole('button', { name: 'Add user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add user' });
  await expect(dialog.getByLabel('Name')).toBeFocused();
  await dialog.getByLabel('Name').fill('Rita Rollout');
  await dialog.getByLabel('Email').fill('rita@gwfleet.test');
  await dialog.getByRole('combobox', { name: 'Role' }).selectOption('release');
  await dialog.getByLabel('Password').fill('Rollout-Ready-42');
  await expect(dialog.getByText('Strong')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add user' }).click();
  await expect(page.getByText('Added Rita Rollout as Release engineer')).toBeVisible();
  await expect(page.getByRole('row', { name: /Rita Rollout/ })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, { email: 'rita@gwfleet.test', password: 'Rollout-Ready-42' }, '/config');
  // The role label under the name is hidden on phones; the enabled control proves the role.
  await expect(page.getByText('Rita Rollout')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New version' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
});
