import { expect, test } from '@playwright/test';

test('heatmap layer dial flicks quickly at desktop and phone sizes', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/#/results?view=areas');
  const mapToggle = page.getByRole('group', { name: 'List or map' }).getByRole('button', { name: 'map', exact: true });
  if (isMobile) {
    await expect(mapToggle).toBeVisible();
    await mapToggle.click();
    await page.getByRole('button', { name: 'Map layer' }).click();
  }

  const dial = page.getByRole('listbox', { name: 'Map heatmap layer' });
  await expect(dial).toBeVisible();
  const options = dial.getByRole('option');
  await expect.poll(() => options.count(), { timeout: 30_000 }).toBeGreaterThan(5);

  // A real dial selects by scrolling; no click is required.
  await options.nth(4).evaluate(element => element.scrollIntoView({ block: 'center' }));
  await dial.dispatchEvent('scroll');
  await expect(options.nth(4)).toHaveAttribute('aria-selected', 'true');

  await dial.press('ArrowUp');
  await expect(options.nth(3)).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});
