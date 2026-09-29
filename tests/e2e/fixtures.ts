import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { getResponse } from 'msw';
import { db, resetDb } from '../msw/db';
import { handlers } from '../msw/handlers';

export type Role = 'admin' | 'release' | 'viewer';

/** Test-only mock credentials (tests/msw/fixtures/catalog.ts). */
export const USERS: Record<Role, { email: string; password: string; name: string }> = {
  admin: { email: 'admin@gwfleet.test', password: 'admin-pass', name: 'Ada Admin' },
  release: { email: 'release@gwfleet.test', password: 'release-pass', name: 'Rui Release' },
  viewer: { email: 'viewer@gwfleet.test', password: 'viewer-pass', name: 'Vera Viewer' },
};

/**
 * Every test gets a fresh copy of the mock API (the same MSW handlers the unit tests use),
 * answered from Node for every /api/v1 request the page makes.
 */
export const test = base.extend<{ mockApi: typeof db }>({
  mockApi: [
    async ({ page }, use) => {
      resetDb();
      await page.route('**/api/v1/**', async (route) => {
        const req = route.request();
        const response = await getResponse(
          handlers,
          new Request(req.url(), {
            method: req.method(),
            headers: req.headers(),
            body: req.postData() ?? undefined,
          }),
        );
        if (!response) return route.fulfill({ status: 404 });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: Buffer.from(await response.arrayBuffer()),
        });
      });
      await use(db);
    },
    { auto: true },
  ],
});

export { expect };

/** Signs in through the login form with the keyboard only, starting at `path`. */
export async function signIn(
  page: Page,
  who: Role | { email: string; password: string },
  path = '/',
) {
  const creds = typeof who === 'string' ? USERS[who] : who;
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Sign in to gwfleet' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeFocused();
  await page.keyboard.type(creds.email);
  await page.keyboard.press('Tab');
  await page.keyboard.type(creds.password);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}
