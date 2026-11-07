import { expect, test, type Page } from '@playwright/test';

async function checkNoHorizontalOverflow(page: Page, screenName: string) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, `${screenName} has horizontal overflow (scrollWidth > clientWidth)`).toBe(false);
}

test.describe('Task #35: Phone & Tablet UX Audit (390px and 768px)', () => {
  const viewports = [
    { name: 'phone-390px', width: 390, height: 844 },
    { name: 'tablet-768px', width: 768, height: 1024 },
  ];

  for (const vp of viewports) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('1. Quiz screen has no overflow and adequate tap targets', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        await checkNoHorizontalOverflow(page, 'Quiz');

        // Check Show my matches button tap target
        const btn = page.getByRole('button', { name: 'Show my matches' });
        await expect(btn).toBeVisible();
        const box = await btn.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);

        await page.screenshot({ path: `screenshots/${vp.name}-quiz.png`, fullPage: false });
      });

      test('2. Town detail screen has no overflow and back button is >= 44px', async ({ page }) => {
        await page.goto('/#/town/salt-lake-city');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Salt Lake City');

        await checkNoHorizontalOverflow(page, 'TownDetail');

        const backBtn = page.getByRole('button', { name: /Back to results/ });
        await expect(backBtn).toBeVisible();
        const box = await backBtn.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);

        await page.screenshot({ path: `screenshots/${vp.name}-towndetail.png`, fullPage: false });
      });

      test('3. Ads sandbox checkout screen has no overflow and clear notices', async ({ page }) => {
        await page.goto('/#/ads-sandbox-checkout?campaignId=test_123&amount=3500&title=Sample+Campaign');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByText(/Sandbox: REDO payments are not connected yet/)).toBeVisible();

        await checkNoHorizontalOverflow(page, 'AdsSandboxCheckout');

        const backBtn = page.getByRole('button', { name: /Return to dashboard/ });
        await expect(backBtn).toBeVisible();
        const box = await backBtn.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);

        await page.screenshot({ path: `screenshots/${vp.name}-ads-checkout.png`, fullPage: false });
      });
    });
  }
});
