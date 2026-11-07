import { expect, test, type Page } from '@playwright/test';
import { cardNames, cards, gotoAreas, gotoResults, showList, showMap, openControls, pinCount, setRange, TOWNS, settledZoom, zoomOf } from './helpers';

const TILE_HOST = /tiles\.openfreemap\.org/;

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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find a home in Utah');
    await page.getByRole('button', { name: /Skier/ }).click();
    await expect(page.getByRole('button', { name: /Skier/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Show my matches' }).click();
    await expect(page.getByText(/Showing \d+ homes/)).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    expect(w.errors, 'console errors').toEqual([]);
    expect(w.failed, 'failed requests').toEqual([]);
  });

  test('2. areas list 42 towns and 42 pins; slider reorders cards', async ({ page }) => {
    await gotoAreas(page);
    await expect(cards(page)).toHaveCount(TOWNS);
    await showMap(page);
    await expect.poll(() => pinCount(page)).toBe(TOWNS);
    await showList(page);
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

  test('3. map tiles render real imagery', async ({ page }) => {
    const tiles: { url: string; status: number; len: number }[] = [];
    page.on('response', async r => {
      if (/\.pbf/.test(r.url()) || /cartocdn/.test(r.url())) {
        const body = await r.body().catch(() => Buffer.alloc(0));
        tiles.push({ url: r.url(), status: r.status(), len: body.length });
      }
    });
    await gotoResults(page);
    await showMap(page);
    await settledZoom(page);
    await expect.poll(() => tiles.length).toBeGreaterThan(3);
    for (const t of tiles) {
      expect(t.status, t.url).toBe(200);
      expect(t.url).not.toMatch(/basemaps\.cartocdn\.com/);
      expect(t.url).toMatch(TILE_HOST);
    }
    expect(new Set(tiles.map(t => t.len)).size, 'tile byte sizes should vary').toBeGreaterThan(1);
    // Pixel check: the drawn canvas must not be a single flat colour, which is what a dead WebGL context looks like.
    const shot = (await page.locator('canvas.maplibregl-canvas').screenshot()).toString('base64');
    const colors = await page.evaluate(async b64 => {
      const im = new Image();
      im.src = `data:image/png;base64,${b64}`;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 16) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return seen.size;
    }, shot);
    expect(colors, 'distinct colours on the map canvas').toBeGreaterThan(50);
  });

  test('4. zoom with + control and mouse wheel', async ({ page, isMobile }) => {
    const tileUrls = new Set<string>();
    page.on('response', r => { if (/\.pbf/.test(r.url())) tileUrls.add(r.url()); });
    await gotoAreas(page);
    await showMap(page);
    await expect.poll(() => pinCount(page)).toBe(TOWNS);
    const z0 = await settledZoom(page);
    const tiles0 = tileUrls.size;
    for (let i = 0; i < 3; i++) {
      const before = await zoomOf(page);
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await expect.poll(() => zoomOf(page), { timeout: 20_000 }).toBeGreaterThan(before + 0.2);
      await settledZoom(page);
    }
    const z1 = await settledZoom(page);
    expect(z1).toBeGreaterThanOrEqual(z0 + 2.5);
    expect(tileUrls.size, 'new tiles loaded').toBeGreaterThan(tiles0);

    // A rendered pin must sit on the screen point its lat/lng projects to.
    const onItsPoint = await page.evaluate(() => {
      const map = window.__utahMap!;
      const layers = ['towns-circle', 'towns-dots'];
      const drawn = map.queryRenderedFeatures({ layers });
      return drawn.length > 0 && drawn.every(f => {
        const p = map.project((f.geometry as unknown as { coordinates: [number, number] }).coordinates);
        return map.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers }).some(h => h.properties.id === f.properties.id);
      });
    });
    expect(onItsPoint, 'pins stay attached to their lat/lng').toBe(true);

    if (!isMobile) {
      const box = (await page.locator('canvas.maplibregl-canvas').boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -300);
      await expect.poll(() => zoomOf(page), { timeout: 20_000 }).toBeGreaterThan(z1);
    }
  });

  test('5. commute cap filters areas, clearing restores 42', async ({ page }) => {
    await gotoAreas(page, 'Family');
    await openControls(page);
    await expect(cards(page)).toHaveCount(TOWNS);
    await setRange(page, /Max commute/, 'min');
    await expect(cards(page).first()).toBeVisible();
    const n = await cards(page).count();
    expect(n, 'commute cap should shrink the list').toBeLessThan(TOWNS);
    expect(n).toBeGreaterThanOrEqual(1);
    await expect(page.getByText(`${n} of ${TOWNS} areas match`)).toBeVisible();
    await page.keyboard.press('Escape');
    await showMap(page);
    await expect.poll(() => pinCount(page), 'pins follow filter').toBe(n);
    await showList(page);
    await openControls(page);
    await setRange(page, /Max commute/, 'max');
    // On phones the Priorities sheet covers the List/Map toggle until it is dismissed.
    await page.keyboard.press('Escape');
    await showList(page);
    await expect(cards(page)).toHaveCount(TOWNS);
    await showMap(page);
    await expect.poll(() => pinCount(page)).toBe(TOWNS);
  });

  test('5b. homes budget filters homes; empty state offers a way out', async ({ page }) => {
    await gotoResults(page);
    await page.getByRole('slider', { name: 'Max price' }).fill('500000');
    await expect(page.getByText(/Showing \d+ homes|No homes under/)).toBeVisible();
    await page.getByRole('combobox', { name: 'Sort' }).selectOption('price_asc');
    const amounts = await page.locator('article p.font-display').allTextContents();
    const nums = amounts.map(a => (a.endsWith('M') ? parseFloat(a.slice(1)) * 1e6 : parseFloat(a.slice(1)) * 1e3));
    for (const v of nums) expect(v).toBeLessThanOrEqual(400_000);
    expect([...nums].sort((a, b) => a - b)).toEqual(nums);
  });

  test('5c. See homes in a town switches to Homes filtered to it', async ({ page }) => {
    await gotoAreas(page);
    const name = (await cardNames(page, 1))[0]!;
    await cards(page).first().getByRole('button', { name: /^See homes in/ }).click();
    await expect(page.getByRole('button', { pressed: true, name: 'Homes', exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`Showing \\d+ homes in 1 area`))).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: `${name} (clear)` })).toBeVisible();
  });

  test('5d. See homes in on the town page opens Homes filtered to that town', async ({ page }) => {
    await page.goto('/#/town/provo');
    await page.getByRole('link', { name: 'See homes in Provo' }).click();
    await expect(page).toHaveURL(/#\/results\?town=provo$/);
    await expect(page.getByRole('button', { name: 'Provo (clear)' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Showing \d+ homes in 1 area/)).toBeVisible();
    await page.getByRole('button', { name: 'Provo (clear)' }).click();
    await expect(page).toHaveURL(/#\/results$/);
    await expect(page.getByText(/Showing \d+ homes in [2-9]\d* areas/)).toBeVisible({ timeout: 20_000 });
  });

  test('5e. header nav opens Homes and Areas and tracks the view', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('link', { name: 'Homes' }).click();
    await expect(page.getByText(/Showing \d+ homes/)).toBeVisible({ timeout: 20_000 });
    await expect(nav.getByRole('link', { name: 'Homes' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Areas' }).click();
    await expect(page.getByText(/areas ranked|areas match/)).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Areas' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Homes', exact: true }).click();
    await expect(nav.getByRole('link', { name: 'Homes' })).toHaveAttribute('aria-current', 'page');
  });

  test('6. town detail shows metrics vs median back works', async ({ page }) => {
    await gotoAreas(page);
    const first = (await cardNames(page, 1))[0]!;
    await cards(page).first().getByRole('button', { name: /^About/ }).click();
    await expect(page).toHaveURL(/#\/town\/.+/);
    await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible();
    await expect(page.getByText(/Utah median/).first()).toBeVisible();
    await expect(page.getByText(/(Better|Worse) than the Utah median|Right at the Utah median/).first()).toBeVisible();
    await expect(page.locator('main li a[href]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page).toHaveURL(/#\/results$/);
    await expect(page.getByText(/Showing \d+ homes/)).toBeVisible({ timeout: 20_000 });
  });

  test('7. direct load of a town detail URL works', async ({ page }) => {
    await gotoAreas(page);
    await cards(page).first().getByRole('button', { name: /^About/ }).click();
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
    await page.getByRole('button', { name: 'Areas', exact: true }).click();
    await cards(page).first().getByRole('button', { name: /^About/ }).click();
    await expect(page.getByText(/Utah median/).first()).toBeVisible();
    expect(await overflow(), 'detail overflow px').toBeLessThanOrEqual(0);
  });
});
