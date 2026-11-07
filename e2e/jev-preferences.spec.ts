import { expect, test } from '@playwright/test';

// Uses a Vite dev server; fixtures never enter the production build and spend no API calls.
test('submitting a description sets priorities and preserves settings that were not mentioned', async ({ page }, testInfo) => {
  await page.goto('/e2e/fixtures/jev.html');
  const current = page.getByTestId('current-settings');
  const before = await current.textContent();
  const button = page.getByRole('button', { name: 'Set my priorities', exact: true });
  await expect(button).toBeDisabled();
  await page.getByLabel('What are you looking for?').fill('Rent under $2k monthly near trails; nightlife matters less.');
  await button.click();
  await expect(page.getByRole('region', { name: 'Priority changes' })).toBeVisible();
  await expect(current).not.toHaveText(before!);
  await expect(page.getByText('Outdoors: 5 / 5')).toBeVisible();
  await expect(page.getByText('Rent, up to $2,000 per month')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('jev-review.png'), fullPage: true });
  await expect(page.getByRole('button', { name: 'Apply suggested settings' })).toHaveCount(0);
  const applied = JSON.parse((await current.textContent())!);
  expect(applied.categories).toMatchObject({ outdoors: 5, culture: 1, cost: 2, safety: 2 });
  expect(applied.budget).toEqual({ mode: 'rent', maxRent: 2000 });
  await expect(page.getByText('Settings applied. Review your priorities below.', { exact: true })).toBeVisible();
});

test('provider and quota failures stay visible without applying changes', async ({ page }) => {
  await page.goto('/e2e/fixtures/jev.html?fail');
  const before = await page.getByTestId('current-settings').textContent();
  await page.getByLabel('What are you looking for?').fill('Near trails please');
  await page.getByRole('button', { name: 'Set my priorities', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Suggestion limit reached');
  await expect(page.getByTestId('current-settings')).toHaveText(before!);
  await expect(page.getByRole('button', { name: 'Apply suggested settings' })).toHaveCount(0);
});
