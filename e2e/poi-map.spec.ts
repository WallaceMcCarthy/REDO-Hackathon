import { expect, test } from '@playwright/test';
import './helpers';

test('nearby place types toggle as lightweight map layers on desktop and phone', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto('/#/results?view=areas');
  if (isMobile) await page.getByRole('group', { name: 'List or map' }).getByRole('button', { name: 'map', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Map of Utah towns' })).toBeVisible();
  const food = page.getByRole('button', { name: 'Food' });
  await expect(food).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => Boolean(window.__utahMap?.getSource('nearby-pois'))), { timeout: 30_000 }).toBe(true);

  await page.evaluate(() => window.__utahMap?.jumpTo({ center: [-111.89, 40.76], zoom: 12 }));
  await expect.poll(() => page.evaluate(() => window.__utahMap?.querySourceFeatures('nearby-pois').length ?? 0)).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => window.__utahMap?.getLayoutProperty('nearby-pois-restaurant', 'visibility'))).toBe('visible');

  await food.click();
  await expect(food).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__utahMap?.getLayoutProperty('nearby-pois-restaurant', 'visibility'))).toBe('none');

  const toggleBox = await page.getByLabel('Nearby places').boundingBox();
  expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
