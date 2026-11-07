import { expect, test, type Page } from '@playwright/test';
import { cardNames, cards, gotoResults, mapCanvas, mapReady, openControls, pinCount, pinOffsets, renderedPinCount, setRange, TOWNS, settledZoom, zoomOf } from './helpers';

const TILE_HOST = /openfreemap\.org/;

function watch(page: Page) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  return { errors, failed };
}

test.describe('Utah Fit', () => {
  test('1. landing loads clean and a persona reaches results', async ({ page }) => {
    const w = watch(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find the Utah town');
    await page.getByRole('button', { name: /Skier/ }).click();
    await expect(page.getByRole('button', { name: /Skier/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Show my towns' }).click();
    await expect(page.getByRole('button', { name: /^Towns/ })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(w.errors, 'console errors').toEqual([]);
    expect(w.failed, 'failed requests').toEqual([]);
  });

  test('2. results list 42 towns and 42 pins; slider reorders cards', async ({ page }) => {
    await gotoResults(page);
    await expect(cards(page)).toHaveCount(TOWNS);
    await expect.poll(() => pinCount(page)).toBe(TOWNS);
    await openControls(page);
    // Zero out outdoors first, then max it; the top of the list should differ.
    await setRange(page, /Outdoors/, 0);
    await page.waitForTimeout(600);
    const before = await cardNames(page, 5);
    await setRange(page, /Outdoors/, 5);
    await page.waitForTimeout(600);
    const after = await cardNames(page, 5);
    console.log('top5 outdoors=0:', before.join(', '), '| outdoors=5:', after.join(', '));
    expect(after).not.toEqual(before);
  });

  test('3. basemap style loads and the map renders', async ({ page }) => {
    const w = watch(page);
    const tiles: { url: string; status: number }[] = [];
    page.on('response', r => { if (/openfreemap\.org\/(planet|natural_earth)/.test(r.url()) || /\.(pbf|png|webp)(\?|$)/.test(r.url())) tiles.push({ url: r.url(), status: r.status() }); });
    await page.goto('/');
    await page.getByRole('button', { name: /Skier/ }).first().click();
    await page.getByRole('button', { name: 'Show my towns' }).click();
    await expect(mapCanvas(page)).toBeVisible();
    await mapReady(page);
    const state = await page.evaluate(async () => {
      const map = (window as any).__utahMap;
      if (!map.loaded()) await new Promise(res => map.once('idle', res));
      return { loaded: map.loaded(), style: map.isStyleLoaded(), layers: map.getStyle().layers.length };
    });
    expect(state.loaded, 'map load fired').toBe(true);
    expect(state.style, 'style loaded').toBe(true);
    expect(state.layers, 'basemap + pin layers').toBeGreaterThan(10);
    await page.waitForLoadState('networkidle');
    for (const t of tiles) {
      expect(t.status, t.url).toBe(200);
      expect(t.url).toMatch(TILE_HOST);
    }
    expect(w.errors.filter(e => !/Failed to load resource/.test(e)), 'map errors').toEqual([]);
    // Not a blank canvas: the GL canvas is non-empty and has drawn pins.
    expect(await renderedPinCount(page)).toBeGreaterThan(0);
    // Homes first: listings arrive as clusters or single pins in the clustered source.
    await expect.poll(() => page.evaluate(() => (window as any).__utahMap.queryRenderedFeatures({ layers: ['listings-clusters', 'listings-circle'] }).length), { message: 'listing pins drawn' }).toBeGreaterThan(0);
  });

  test('4. zoom with + control and mouse wheel', async ({ page, isMobile }) => {
    await gotoResults(page);
    await mapReady(page);
    await page.evaluate(() => new Promise(res => { const m = (window as any).__utahMap; if (m.loaded()) res(null); else m.once('idle', () => res(null)); }));
    const z0 = await settledZoom(page);
    const map = mapCanvas(page);
    // Remember the pin furthest from the map centre; zooming about the centre must scale its offset by 2^dz.
    const offs0 = await pinOffsets(page);
    const far = offs0.reduce((a, b) => (Math.hypot(b.dx, b.dy) > Math.hypot(a.dx, a.dy) ? b : a));
    const t0 = Date.now();
    let prev = z0;
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await expect.poll(() => zoomOf(page), { timeout: 20_000 }).toBeGreaterThan(prev + 0.2);
      prev = await settledZoom(page);
    }
    const z1 = await settledZoom(page);
    const ms = Date.now() - t0;
    console.log(`ZOOM_TIMING ${isMobile ? 'mobile' : 'desktop'} 3x + button: ${ms} ms (z ${z0} -> ${z1})`);
    expect(z1).toBeGreaterThanOrEqual(z0 + 2.5);
    expect(await pinCount(page), 'pins remain attached').toBe(TOWNS);
    const after = (await pinOffsets(page)).find(p => p.title === far.title)!;
    const ratio = Math.hypot(after.dx, after.dy) / Math.hypot(far.dx, far.dy);
    console.log(`pin "${far.title}" offset ratio ${ratio.toFixed(2)} vs expected ${(2 ** (z1 - z0)).toFixed(2)}`);
    // The + button zooms about the map centre, so the pin offset scales by 2^dz.
    expect(ratio / 2 ** (z1 - z0), 'pin stays attached to its lat/lng').toBeGreaterThan(0.9);
    expect(ratio / 2 ** (z1 - z0)).toBeLessThan(1.1);

    if (!isMobile) {
      const box = (await map.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const tw = Date.now();
      await page.mouse.wheel(0, -300);
      await expect.poll(() => zoomOf(page), { timeout: 20_000 }).toBeGreaterThan(z1);
      const z2 = await settledZoom(page);
      console.log(`ZOOM_TIMING desktop wheel: ${Date.now() - tw} ms (z ${z1} -> ${z2})`);
    }
  });

  test('5. home value and commute caps filter, clearing restores 42', async ({ page }) => {
    await gotoResults(page, 'Family');
    await openControls(page);
    for (const name of [/Max home value/, /Max commute/]) {
      await expect(cards(page)).toHaveCount(TOWNS);
      await setRange(page, name, 'min');
      await expect(cards(page).first()).toBeVisible();
      const n = await cards(page).count();
      expect(n, `${name} should shrink the list`).toBeLessThan(TOWNS);
      expect(n).toBeGreaterThanOrEqual(1);
      await expect(page.getByText(`${n} of ${TOWNS} towns match`)).toBeVisible();
      await expect.poll(() => pinCount(page), { message: 'pins follow filter' }).toBe(n);
      await setRange(page, name, 'max');
      await expect(cards(page)).toHaveCount(TOWNS);
      await expect.poll(() => pinCount(page)).toBe(TOWNS);
    }
  });

  test('6. town detail shows metrics vs median with source links; back works', async ({ page }) => {
    await gotoResults(page);
    const first = (await cardNames(page, 1))[0]!;
    await cards(page).first().getByRole('button').click();
    await expect(page).toHaveURL(/#\/town\/.+/);
    await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible();
    await expect(page.getByText(/Utah median/).first()).toBeVisible();
    await expect(page.getByText(/(Better|Worse) than the Utah median|Right at the Utah median/).first()).toBeVisible();
    const hrefs = await page.locator('main li a[href]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h, 'source link').toMatch(/^http/);
    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page).toHaveURL(/#\/results$/);
    await page.getByRole('button', { name: /^Towns/ }).click();
    await expect(page.getByText(/towns ranked|towns match/)).toBeVisible();
  });

  test('7. direct load of a town detail URL works', async ({ page }) => {
    await gotoResults(page);
    await cards(page).first().getByRole('button').click();
    const url = page.url();
    const fresh = await page.context().newPage();
    await fresh.goto(url);
    await expect(fresh.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(fresh.getByText(/Utah median/).first()).toBeVisible();
    await expect(fresh.getByText('We couldn’t find that town')).toHaveCount(0);
    // Unknown id shows the friendly not-found state.
    await fresh.goto(url.replace(/#\/town\/.*/, '#/town/not-a-real-town'));
    await expect(fresh.getByText('We couldn’t find that town')).toBeVisible();
  });

  test('8. no horizontal page scroll on results or detail', async ({ page }) => {
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await gotoResults(page);
    await page.waitForTimeout(500);
    expect(await overflow(), 'results overflow px').toBeLessThanOrEqual(0);
    await cards(page).first().getByRole('button').click();
    await expect(page.getByText(/Utah median/).first()).toBeVisible();
    expect(await overflow(), 'detail overflow px').toBeLessThanOrEqual(0);
  });
});
