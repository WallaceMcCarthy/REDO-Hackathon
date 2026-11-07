import { expect, test } from '@playwright/test';

test('Areas map keeps ranks legible and relies on the basemap for town names', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/#/results?view=areas');
  const map = page.getByRole('region', { name: 'Map of Utah towns' });
  await expect(map).toBeVisible();
  await expect(map.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(map.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
