import { USERS, expect, signIn, test } from './fixtures';
import type { Role } from './fixtures';

// Flow 1: each role sees the right navigation and controls.
const EXPECTED: Record<Role, { users: boolean; newVersion: boolean }> = {
  admin: { users: true, newVersion: true },
  release: { users: false, newVersion: true },
  viewer: { users: false, newVersion: false },
};

for (const role of Object.keys(EXPECTED) as Role[]) {
  test(`${role} sees the right navigation and controls`, async ({ page }) => {
    const expected = EXPECTED[role];
    await signIn(page, role);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(page.getByText(USERS[role].name)).toBeVisible();
    for (const item of ['Overview', 'Devices', 'Configuration', 'Firmware', 'Alerts']) {
      await expect(nav.getByRole('link', { name: item })).toBeVisible();
    }
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(expected.users ? 1 : 0);

    // Controls are disabled with the reason, never hidden.
    await nav.getByRole('link', { name: 'Configuration' }).click();
    const newVersion = page.getByRole('button', { name: 'New version' });
    await expect(newVersion).toBeVisible();
    if (expected.newVersion) {
      await expect(newVersion).not.toHaveAttribute('aria-disabled', 'true');
    } else {
      await expect(newVersion).toHaveAttribute('aria-disabled', 'true');
      await expect(newVersion).toHaveAttribute('title', "Your role (Viewer) can't do this");
    }

    // Users is admin-only; others are sent home with the reason.
    await page.goto('/users');
    if (expected.users) {
      await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
    } else {
      await expect(page.getByText(/can't open Users/)).toBeVisible();
      await expect(page).toHaveURL('/');
    }
  });
}

test('sign out returns to the login page and a reload stays signed out', async ({ page }) => {
  await signIn(page, 'viewer');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to gwfleet' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to gwfleet' })).toBeVisible();
});
