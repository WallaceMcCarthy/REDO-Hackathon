import { expect, test, type Page } from '@playwright/test';

async function checkNoHorizontalOverflow(page: Page, screenName: string) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, `${screenName} has horizontal overflow (scrollWidth > clientWidth)`).toBe(false);
}

test.describe('Task #48: Messages UI & Mobile Responsiveness', () => {
  const viewports = [
    { name: 'desktop-1440px', width: 1440, height: 900 },
    { name: 'phone-390px', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('Messages screen renders without overflow and adheres to tap target standards', async ({ page }) => {
        await page.goto('/#/messages');
        await page.waitForLoadState('domcontentloaded');

        // Verify page header
        const heading = page.getByRole('heading', { name: 'Messages', level: 1 });
        await expect(heading).toBeVisible();

        // Verify no horizontal overflow
        await checkNoHorizontalOverflow(page, `Messages (${vp.name})`);

        // Check Back button tap target height >= 44px
        const backBtn = page.getByRole('button', { name: /Back to results/ });
        await expect(backBtn).toBeVisible();
        const backBox = await backBtn.boundingBox();
        expect(backBox?.height).toBeGreaterThanOrEqual(44);

        // Check the callout button tap target >= 44px
        const promptBtn = page.getByRole('button', { name: 'Sign in or create account' });
        await expect(promptBtn).toBeVisible();
        const promptBox = await promptBtn.boundingBox();
        expect(promptBox?.height).toBeGreaterThanOrEqual(44);

        // Take screenshots for visual verification
        await page.screenshot({ path: `screenshots/${vp.name}-messages.png`, fullPage: false });
      });
    });
  }
});
