import { expect, test } from '@playwright/test';

test('Results map does not enter a React update loop', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(String(error)));

  await page.goto('/#/results');
  if (isMobile) {
    await page.getByRole('group', { name: 'List or map' }).getByRole('button', { name: 'map', exact: true }).click();
  }
  await expect(page.getByRole('region', { name: 'Map of Utah towns' })).toBeVisible();
  await page.waitForTimeout(1_500);

  expect(errors.filter(error => error.includes('Maximum update depth exceeded'))).toEqual([]);
});
