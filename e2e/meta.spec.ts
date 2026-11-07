import { expect, test } from '@playwright/test';

// vercel.json rewrites do not run here; vite's SPA fallback stands in by serving index.html for any path.
test('share tags point at a real 1200x630 image', async ({ page, request }) => {
  await page.goto('/');
  const content = (sel: string) => page.locator(sel).getAttribute('content');
  expect(await content('meta[property="og:title"]')).toContain('Utah Fit');
  expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(await content('meta[name="theme-color"]')).toBe('#f7f1e8');
  const image = new URL((await content('meta[property="og:image"]'))!);
  const res = await request.get(image.pathname);
  expect(res.headers()['content-type']).toBe('image/png');
  const png = await res.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

for (const path of ['/markets/state/UT', '/research', '/pricing', '/data']) {
  test(`old path ${path} lands on a friendly page with a way in`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'That page has moved' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await page.getByRole('link', { name: 'Find a home in Utah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Find a home in Utah/ })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
}

test('the start page is not marked not-found', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'That page has moved' })).toHaveCount(0);
});
