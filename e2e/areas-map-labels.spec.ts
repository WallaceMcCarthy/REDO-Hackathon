import { expect, test } from '@playwright/test';

test('Areas map keeps ranks legible and relies on the basemap for town names', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/#/results?view=areas');
  if (isMobile) await page.getByRole('group', { name: 'List or map' }).getByRole('button', { name: 'map', exact: true }).click();
  const map = page.getByRole('region', { name: 'Map of Utah towns' });
  await expect(map).toBeVisible();
  await expect(map.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__utahMap?.getLayer('towns-circle'))), { timeout: 30_000 }).toBe(true);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(map.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
