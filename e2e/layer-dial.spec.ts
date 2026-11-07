import { expect, test } from '@playwright/test';

test('heatmap layer dial flicks quickly at desktop and phone sizes', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/#/results?view=areas');
  const mapToggle = page.getByRole('group', { name: 'List or map' }).getByRole('button', { name: 'map', exact: true });
  if (isMobile) {
    await expect(mapToggle).toBeVisible();
    await mapToggle.click();
  }

  const dial = page.getByRole('listbox', { name: 'Map heatmap layer' });
  await expect(dial).toBeVisible();
  const options = dial.getByRole('option');
  await expect.poll(() => options.count(), { timeout: 30_000 }).toBeGreaterThan(5);

  const started = Date.now();
  for (const index of [1, 2, 3, 4]) {
    await options.nth(index).dispatchEvent('click');
    await expect(options.nth(index)).toHaveAttribute('aria-selected', 'true');
  }
  expect(Date.now() - started).toBeLessThan(3000);

  await dial.press('ArrowUp');
  await expect(options.nth(3)).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});
