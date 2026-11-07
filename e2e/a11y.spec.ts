import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gotoResults, showList } from './helpers';

// The map is WebGL and not keyboard reachable by nature, so it is excluded from the scan.
// The list beside it has to cover everything the map offers.
const MAP = '.maplibregl-map';

// Every impact level is asserted: the app has none left, so any new finding is a regression.
async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .exclude(MAP)
    .analyze();
  return violations;
}

async function expectClean(page: Page) {
  const found = await violations(page);
  expect(found.map(v => `${v.impact} ${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

const settle = (page: Page) => page.waitForLoadState('networkidle');

test.describe('axe scan, all impacts', () => {
  test('start page', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expectClean(page);
  });

  test('results: homes, apartments, areas', async ({ page }) => {
    await gotoResults(page);
    await showList(page);
    await expectClean(page);
    await page.getByRole('button', { name: 'Apartments', exact: true }).click();
    await expect(page.getByText(/Showing \d+ apartments/)).toBeVisible();
    await expectClean(page);
    await page.getByRole('button', { name: 'Areas', exact: true }).click();
    await expect(page.getByText(/areas ranked|areas match/)).toBeVisible();
    await expectClean(page);
  });

  test('results: listing panel', async ({ page }) => {
    await gotoResults(page);
    await showList(page);
    await page.locator('[data-listing-id]').first().click({ position: { x: 20, y: 20 } });
    await expect(page.getByRole('complementary', { name: /^Details for / })).toBeVisible();
    await expectClean(page);
  });

  test('open dialogs: sign-in and priorities', async ({ page }) => {
    await page.goto('/#/account');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectClean(page);
    await gotoResults(page);
    await page.getByRole('button', { name: 'Priorities' }).click();
    await expect(page.getByRole('dialog', { name: 'Priorities' })).toBeVisible();
    await expectClean(page);
  });

  for (const [name, hash] of [
    ['town page', '#/town/provo'],
    ['advertise', '#/advertise'],
    ['account signed out', '#/account'],
    ['saved', '#/saved'],
    ['messages', '#/messages'],
  ] as const) {
    test(name, async ({ page }) => {
      await page.goto(`/${hash}`);
      await settle(page);
      await page.locator('h1, h2').first().waitFor();
      await expectClean(page);
    });
  }
});

test.describe('keyboard only', () => {
  test('filters and a listing work without a mouse', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow is covered at desktop width');
    await gotoResults(page);
    const sort = page.getByLabel('Sort', { exact: true });
    await sort.focus();
    await page.keyboard.press('ArrowDown');
    await expect(sort).toBeFocused();

    const card = page.locator('[data-listing-id]').first();
    await card.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: /^Details for / });
    await expect(panel).toBeVisible();
    // Focus lands inside the opened panel, and returns to the card when it closes.
    await expect.poll(() => panel.evaluate(p => p.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(card).toBeFocused();
  });

  test('priorities popover opens and closes by keyboard and returns focus', async ({ page, isMobile }) => {
    test.skip(isMobile);
    await gotoResults(page);
    const btn = page.getByRole('button', { name: 'Priorities' });
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Priorities' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Priorities' })).toBeHidden();
    await expect(btn).toBeFocused();
  });

  test('sign-in dialog traps focus, closes on Escape, returns focus', async ({ page, isMobile }) => {
    test.skip(isMobile);
    await page.goto('/#/account');
    const trigger = page.getByRole('button', { name: /sign in/i }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await dlg.evaluate(d => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
