import { test, expect } from '@playwright/test';
test('a listing photo stays in the app, and Advertise is reachable from the header', async ({ page, context }) => {
  test.setTimeout(90000);
  await page.goto('/#/results'); await expect(page.getByText(/Showing \d+ homes/)).toBeVisible({ timeout: 25000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll').toBe(true);
  const pages = context.pages().length;
  await page.locator('article img').first().click({ timeout: 10000 });
  await expect(page.getByLabel(/Details for/).first()).toBeVisible({ timeout: 10000 });
  expect(context.pages().length, 'no new tab').toBe(pages);
  await page.keyboard.press('Escape');
  await page.goto('/#/results');
  const adv = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Advertise' });
  await adv.scrollIntoViewIfNeeded(); await adv.click();
  await expect(page).toHaveURL(/#\/advertise/);
});
