import { expect, signIn, test } from './fixtures';

// Flow 2: find a gateway by MAC, open it with the keyboard, read its interfaces.
test('search a device by MAC, open it and read its interfaces', async ({ page, mockApi }) => {
  const device = mockApi.devices[123];
  if (!device) throw new Error('fixture device missing');
  const identifier = (type: string) =>
    device.interfaces.find((hw) => hw.type === type)?.identifier ?? '';

  await signIn(page, 'viewer', '/devices');
  const table = page.getByRole('table', { name: 'Gateways' });
  await expect(table.getByRole('row')).toHaveCount(101); // header + first page of 100

  await page.getByRole('searchbox', { name: 'Search' }).fill(identifier('mac'));
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(page).toHaveURL(/\?q=/);

  const link = table.getByRole('link', { name: device.sn });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: device.sn })).toBeVisible();

  const interfaces = page.getByRole('region', { name: 'Hardware interfaces' });
  for (const type of ['mac', 'imei', 'iccid']) {
    await expect(interfaces.getByText(identifier(type), { exact: true })).toBeVisible();
  }

  // Back keeps the search that found it.
  await page.getByRole('link', { name: '← Back to devices' }).click();
  await expect(page).toHaveURL(/\/devices\?q=/);
  await expect(table.getByRole('row')).toHaveCount(2);
});
