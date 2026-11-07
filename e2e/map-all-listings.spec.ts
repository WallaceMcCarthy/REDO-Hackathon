import { expect, test, type Page } from '@playwright/test';
import { gotoResults, settledZoom, showMap } from './helpers';

const CONVEX_URL = process.env.E2E_CONVEX_URL ?? 'https://dashing-wolf-264.convex.cloud';

const matches = async (page: Page) => {
  const line = await page.getByText(/· \d+ matches/).textContent();
  return Number(/(\d+) matches/.exec(line ?? '')![1]);
};

/** Every home behind the clusters and lone pins drawn with the whole state in view. */
const drawn = (page: Page) => page.evaluate(() => {
  const map = window.__utahMap!;
  map.jumpTo({ center: [-111.6, 39.5], zoom: 5 });
  const seen = new Map<unknown, number>();
  for (const { properties: p } of map.queryRenderedFeatures({ layers: ['listings-clusters', 'listings-circle'] }))
    seen.set(p.cluster_id ?? p.id, p.point_count ?? 1);
  return [...seen.values()].reduce((sum, n) => sum + n, 0);
});

/** Waits for the list to settle on a new count, then for the map to agree with it. */
async function expectMapMatchesList(page: Page, previous?: number) {
  if (previous !== undefined) await expect.poll(() => matches(page)).not.toBe(previous);
  const total = await matches(page);
  await expect.poll(() => drawn(page), { timeout: 20_000 }).toBeGreaterThan(total * 0.99);
  expect(await drawn(page)).toBeLessThanOrEqual(total + 60);
  return total;
}

test('the map shows every match, and a price cap or town narrows it with the list', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await gotoResults(page);
  await showMap(page);

  const homes = await expectMapMatchesList(page);
  expect(homes).toBeGreaterThan(1000);
  await page.getByLabel('Max price', { exact: true }).selectOption('400000');
  const cappedHomes = await expectMapMatchesList(page, homes);
  expect(cappedHomes).toBeLessThan(homes);

  await page.getByRole('button', { name: 'Apartments', exact: true }).click();
  await expect(page.getByText(/Showing \d+ apartments/)).toBeAttached();
  const apartments = await expectMapMatchesList(page);
  expect(apartments).toBeGreaterThan(1000);
  await page.getByLabel('Max rent', { exact: true }).selectOption('1500');
  expect(await expectMapMatchesList(page, apartments)).toBeLessThan(apartments);

  await page.getByLabel('Max rent', { exact: true }).selectOption('');
  await page.goto('/#/results?view=apartments&town=park-city');
  await expect(page.getByText(/\(clear\)/)).toBeAttached();
  expect(await expectMapMatchesList(page)).toBeLessThan(apartments);
  expect(errors).toEqual([]);
});

test('a pin outside the loaded list page opens its panel and gets the selected ring', async ({ page }) => {
  const res = await page.request.post(`${CONVEX_URL}/api/query`, { data: { path: 'listings:get', format: 'json', args: { id: 'none' } } });
  test.skip((await res.json()).status !== 'success', 'listings:get is not deployed to this Convex yet');

  await gotoResults(page);
  await showMap(page);
  const list = page.locator('[data-listing-id]');
  await expect(list.first()).toBeAttached();
  const loaded = await list.evaluateAll(els => els.map(el => el.getAttribute('data-listing-id')));
  const points: [string, number, number][] = await page.evaluate(() => fetch('/data/map-points-home.json').then(r => r.json()));
  const outside = points.find(([id, lat]) => !loaded.includes(id) && lat > 40.6 && lat < 40.8)!;

  await expect.poll(() => drawn(page), { timeout: 20_000 }).toBeGreaterThan(1000);
  await page.evaluate(([, lat, lng]) => window.__utahMap!.jumpTo({ center: [lng as number, lat as number], zoom: 17 }), outside);
  await settledZoom(page);
  await expect.poll(() => page.evaluate(id => window.__utahMap!.queryRenderedFeatures({ layers: ['listings-circle'] }).some(f => f.properties.id === id), outside[0])).toBe(true);
  const box = await page.getByRole('region', { name: 'Map of Utah towns' }).boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const panel = page.getByTestId('listing-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(outside[0].split(':').pop()!.split(',')[0].replaceAll('-', ' '));
  await expect.poll(() => page.evaluate(id => window.__utahMap!.queryRenderedFeatures({ layers: ['listings-selected'] }).some(f => f.properties.id === id), outside[0])).toBe(true);
});

test('pins for loaded listings open at once, and a list card still selects its pin', async ({ page }, testInfo) => {
  await gotoResults(page);
  await showMap(page);
  const panel = page.getByTestId('listing-panel');
  const card = page.locator('[data-listing-id]').first();
  await expect(card).toBeAttached();
  const id = (await card.getAttribute('data-listing-id'))!;
  await expect.poll(() => drawn(page), { timeout: 20_000 }).toBeGreaterThan(1000);

  const [lat, lng] = await page.evaluate(async id => {
    const points: [string, number, number][] = await fetch('/data/map-points-home.json').then(r => r.json());
    return points.find(p => p[0] === id)!.slice(1);
  }, id);
  await page.evaluate(([lat, lng]) => window.__utahMap!.jumpTo({ center: [lng as number, lat as number], zoom: 17 }), [lat, lng]);
  await settledZoom(page);
  const box = await page.getByRole('region', { name: 'Map of Utah towns' }).boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(panel).toBeVisible();
  await expect.poll(() => page.evaluate(id => window.__utahMap!.queryRenderedFeatures({ layers: ['listings-selected'] }).some(f => f.properties.id === id), id)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pin-panel.png') });

  if (testInfo.project.name !== 'desktop') return;
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  const other = page.locator('[data-listing-id]').nth(3);
  const otherId = (await other.getAttribute('data-listing-id'))!;
  await other.getByRole('img').first().click();
  await expect(panel).toBeVisible();
  await settledZoom(page);
  await expect.poll(() => page.evaluate(id => window.__utahMap!.queryRenderedFeatures({ layers: ['listings-selected'] }).some(f => f.properties.id === id), otherId)).toBe(true);
});
