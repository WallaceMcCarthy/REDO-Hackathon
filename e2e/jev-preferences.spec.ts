import { expect, test } from '@playwright/test';

// Uses a Vite dev server; fixtures never enter the production build and spend no API calls.
test('one click applies suggestions and preserves priorities that were not mentioned', async ({ page }, testInfo) => {
  await page.goto('/e2e/fixtures/jev.html');
  const current = page.getByTestId('current-settings');
  const before = await current.textContent();
  const button = page.getByRole('button', { name: 'Find my homes', exact: true });
  await expect(button).toBeDisabled();
  await page.getByLabel('What are you looking for?').fill('Rent under $2k monthly near trails; nightlife matters less.');
  await button.click();
  await expect(current).not.toHaveText(before!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('jev-applied.png'), fullPage: true });
  const applied = JSON.parse((await current.textContent())!);
  expect(applied.categories).toMatchObject({ outdoors: 5, culture: 1, cost: 2, safety: 2 });
  expect(applied.budget).toEqual({ mode: 'rent', maxRent: 2000 });
});

test('provider and quota failures stay visible without applying changes', async ({ page }) => {
  await page.goto('/e2e/fixtures/jev.html?fail');
  const before = await page.getByTestId('current-settings').textContent();
  await page.getByLabel('What are you looking for?').fill('Near trails please');
  await page.getByRole('button', { name: 'Find my homes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Suggestion limit reached');
  await expect(page.getByTestId('current-settings')).toHaveText(before!);
});
