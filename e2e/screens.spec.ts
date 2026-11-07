import { expect, test, type Page } from '@playwright/test';
import { settledZoom, showMap } from './helpers';

// Set E2E_SHOTS to a folder to keep a screenshot of every screen.
const SHOTS = process.env.E2E_SHOTS;
const SIZES = [
  { name: '1400', width: 1400, height: 900 },
  { name: '390', width: 390, height: 844 },
];

const SCREENS: { name: string; path: string; ready: (page: Page) => ReturnType<Page['locator']> }[] = [
  { name: 'quiz', path: '/#/', ready: p => p.getByRole('button', { name: 'Show my matches' }) },
  { name: 'homes', path: '/#/results', ready: p => p.getByText(/Showing \d+ homes/) },
  { name: 'apartments', path: '/#/results?view=apartments', ready: p => p.getByText(/Showing \d+ apartments/) },
  { name: 'areas', path: '/#/results?view=areas', ready: p => p.getByText(/areas ranked|areas match/) },
  { name: 'town-homes', path: '/#/results?town=provo', ready: p => p.getByRole('button', { name: 'Provo (clear)' }) },
  { name: 'town', path: '/#/town/provo', ready: p => p.getByRole('heading', { level: 1, name: 'Provo' }) },
  { name: 'town-not-found', path: '/#/town/nowhere', ready: p => p.getByText('We couldn’t find that town') },
  { name: 'roommates', path: '/#/roommates', ready: p => p.getByRole('heading', { name: 'Roommate finder' }) },
  { name: 'saved', path: '/#/saved', ready: p => p.getByRole('heading', { name: 'My saved places' }) },
  { name: 'account', path: '/#/account', ready: p => p.getByText('Sign in to see your profile') },
  { name: 'messages', path: '/#/messages', ready: p => p.getByText('Sign in to view messages') },
  { name: 'advertise', path: '/#/advertise', ready: p => p.getByRole('button', { name: 'Back to results' }) },
  { name: 'ads-checkout', path: '/#/ads-sandbox-checkout?campaignId=test_123&amount=3500&title=Sample+Campaign', ready: p => p.getByText(/Sandbox: REDO payments are not connected yet/) },
  { name: 'ui-kit', path: '/#/ui', ready: p => p.locator('main') },
];

// Each size runs in both projects, and the shot worth keeping is the one on the matching device.
const shoot = (page: Page, file: string, project: string, size: string) =>
  SHOTS && project === (size === '1400' ? 'desktop' : 'mobile') ? page.screenshot({ path: `${SHOTS}/${file}.png` }) : undefined;

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const size of SIZES) {
  test.describe(`screens at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const screen of SCREENS) {
      test(`${screen.name} has no sideways scroll`, async ({ page }, info) => {
        await page.goto(screen.path);
        await expect(screen.ready(page).first()).toBeVisible({ timeout: 20_000 });
        expect(await noSideScroll(page), `${screen.name} overflow px`).toBeLessThanOrEqual(0);
        if (process.env.VITE_BUILD_ID) await expect(page.getByText(process.env.VITE_BUILD_ID)).toBeVisible();
        await shoot(page, `${screen.name}-${size.name}`, info.project.name, size.name);
      });
    }

    test('Results fills the screen under the header with one scroller', async ({ page }, info) => {
      await page.goto('/#/results');
      await expect(page.getByText(/Showing \d+ homes/)).toBeVisible({ timeout: 20_000 });
      const pageScroll = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
      expect(pageScroll, 'page must not scroll as well as the list').toBeLessThanOrEqual(0);

      const header = (await page.locator('header').first().boundingBox())!;
      await showMap(page);
      await settledZoom(page);
      const map = (await page.locator('canvas.maplibregl-canvas').boundingBox())!;
      expect(map.y, 'map starts below the header').toBeGreaterThanOrEqual(header.y + header.height);
      expect(map.y + map.height, 'map ends inside the viewport').toBeLessThanOrEqual(size.height + 1);
      await shoot(page, `results-map-${size.name}`, info.project.name, size.name);
    });
  });
}
