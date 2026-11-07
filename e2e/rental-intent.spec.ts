import { expect, test } from '@playwright/test';
import { showList } from './helpers';

test('rent selection survives a blank budget and returning to the quiz', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Rent', exact: true }).click();
  await expect(page.getByLabel('Max rent per month', { exact: true })).toHaveValue('5050');
  await page.getByRole('button', { name: 'Show my matches', exact: true }).click();
  await expect(page).toHaveURL(/#\/results\?view=apartments$/);
  await showList(page);
  await expect(page.getByText(/Showing \d+ apartments in \d+ areas?/)).toBeVisible();
  await expect(page.getByLabel('Max rent', { exact: true })).toHaveValue('5050');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('rent-without-budget.png') });

  await page.evaluate(() => { window.location.hash = '/'; });
  await expect(page.getByRole('radio', { name: 'Rent', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Buy', exact: true }).click();
  await page.getByRole('button', { name: 'Show my matches', exact: true }).click();
  await expect(page).toHaveURL(/#\/results$/);
  await showList(page);
  await expect(page.getByText(/Showing \d+ homes in \d+ areas?/)).toBeVisible();
});
