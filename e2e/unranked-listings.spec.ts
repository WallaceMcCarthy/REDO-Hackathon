import { expect, test } from '@playwright/test';
import { gotoResults, showList } from './helpers';

test('rural Utah listings show asking amounts without fabricated town scores or links', async ({ page }, testInfo) => {
  await gotoResults(page);
  await showList(page);
  await page.getByLabel('Sort', { exact: true }).selectOption('price_asc');
  const rural = page.locator('[data-listing-id^="market:for_sale:unranked-fixture-"]').first();
  await expect(rural).toBeVisible();
  await expect(rural.getByText(/No area score/)).toBeVisible();
  await expect(rural.getByText('Asking price', { exact: true })).toBeVisible();
  await expect(rural.getByText(/Delta.*3 bd/)).toBeVisible();
  await expect(rural.getByRole('meter')).toHaveCount(0);
  await expect(rural.getByRole('button', { name: /^About / })).toHaveCount(0);
  await rural.click();
  const panel = page.getByTestId('listing-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/No area score/)).toBeVisible();
  await expect(panel.getByRole('meter')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /^About / })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Apartments', exact: true }).click();
  const rental = page.locator('[data-listing-id^="market:for_rent:unranked-fixture-"]').first();
  await expect(rental).toBeVisible();
  await expect(rental.getByText('Asking rent', { exact: true })).toBeVisible();
  await expect(rental.getByText(/No area score/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('rural-utah.png') });
});
