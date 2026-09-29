import { expect, signIn, test } from './fixtures';

// Flow 3 (the parts the API supports today; pushing needs a push endpoint).
test('release engineer saves a new config version, fixing a line error first', async ({ page }) => {
  await signIn(page, 'release', '/config?model=GW210');
  await expect(page.getByRole('list', { name: 'Config versions' })).toBeVisible();
  await page.getByRole('button', { name: 'New version' }).click();

  const editor = page.getByRole('form', { name: 'New config version' });
  const text = editor.getByLabel('Config (uci export)');
  await editor.getByLabel('Note').fill('Set the zone name');
  const original = await text.inputValue();

  await text.fill(`${original}\nnot uci at all`);
  await editor.getByRole('button', { name: 'Save version' }).click();
  const lines = original.split('\n').length + 1;
  await expect(editor.getByRole('alert')).toHaveText(
    `Line ${lines}: line ${lines} is not valid UCI`,
  );

  await text.fill(`${original}\n\toption zonename 'UTC'`);
  await editor.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByText('Saved GW210 config v4')).toBeVisible();
  await expect(page).toHaveURL(/model=GW210&v=4/);
  await expect(page.getByLabel('Changes in v4')).toContainText("option zonename 'UTC'");
});
