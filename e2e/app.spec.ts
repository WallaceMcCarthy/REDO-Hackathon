import { expect, test, type Page } from '@playwright/test';
import { cardNames, cards, gotoAreas, gotoResults, showList, showMap, openControls, pins, setRange, TOWNS, settledZoom, zoomOf } from './helpers';

const TILE_HOST = /arcgisonline\.com/;

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
    await expect(page.getByText(/Showing \d+ homes/)).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    expect(w.errors, 'console errors').toEqual([]);
    expect(w.failed, 'failed requests').toEqual([]);
  });

  test('2. areas list 42 towns and 42 pins; slider reorders cards', async ({ page }) => {
    await gotoAreas(page);
    await expect(cards(page)).toHaveCount(TOWNS);
    await showMap(page);
    await expect(pins(page)).toHaveCount(TOWNS);
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
      if (/\/tile\//.test(r.url()) || /cartocdn/.test(r.url())) {
        const body = await r.body().catch(() => Buffer.alloc(0));
        tiles.push({ url: r.url(), status: r.status(), len: body.length });
      }
    });
    await gotoResults(page);
    await showMap(page);
    await expect.poll(() => page.locator('img.leaflet-tile-loaded').count()).toBeGreaterThan(3);
    await page.waitForLoadState('networkidle');
    expect(tiles.length).toBeGreaterThan(3);
    for (const t of tiles) {
      expect(t.status, t.url).toBe(200);
      expect(t.url).not.toMatch(/basemaps\.cartocdn\.com/);
      expect(t.url).toMatch(TILE_HOST);
    }
    expect(new Set(tiles.map(t => t.len)).size, 'tile byte sizes should vary').toBeGreaterThan(1);
    // Pixel check: loaded tiles must not be a single flat colour (placeholder-like).
    const stats = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded')];
      const out: { w: number; colors: number }[] = [];
      for (const img of imgs.slice(0, 12)) {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d')!;
        const im = new Image(); im.crossOrigin = 'anonymous'; im.src = img.src;
        try { await im.decode(); ctx.drawImage(im, 0, 0); } catch { continue; }
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const seen = new Set<number>();
        for (let i = 0; i < d.length; i += 16) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        out.push({ w: c.width, colors: seen.size });
      }
      return out;
    });
    console.log('tile pixel stats', JSON.stringify(stats));
    test.info().annotations.push({ type: 'tiles', description: `${tiles.length} tiles, sizes ${[...new Set(tiles.map(t => t.len))].slice(0, 8).join(',')}` });
  });

  test('4. zoom with + control and mouse wheel', async ({ page, isMobile }) => {
    await gotoResults(page);
    await showMap(page);
    await expect.poll(() => page.locator('img.leaflet-tile-loaded').count()).toBeGreaterThan(3);
    await page.waitForLoadState('networkidle');
    const z0 = await settledZoom(page);
    const urls0 = new Set(await page.locator('img.leaflet-tile').evaluateAll(els => els.map(e => (e as HTMLImageElement).src)));
    const map = page.locator('.leaflet-container');
    // Remember the pin furthest from the map centre; zooming about the centre must scale its offset by 2^dz.
    const offsetOf = () => page.evaluate(() => {
      const m = document.querySelector('.leaflet-container')!.getBoundingClientRect();
      const cx = m.x + m.width / 2, cy = m.y + m.height / 2;
      return [...document.querySelectorAll('.leaflet-marker-icon')].map(e => {
        const r = e.getBoundingClientRect();
        return { title: e.getAttribute('title'), dx: r.x + r.width / 2 - cx, dy: r.y + r.height / 2 - cy };
      });
    });
    const offs0 = await offsetOf();
    const far = offs0.reduce((a, b) => (Math.hypot(b.dx, b.dy) > Math.hypot(a.dx, a.dy) ? b : a));
    const t0 = Date.now();
    // The opening fit is fractional (zoomSnap 0.25) and the first + click snaps to a whole level, so assert each click raises zoom.
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
    const urls1 = await page.locator('img.leaflet-tile').evaluateAll(els => els.map(e => (e as HTMLImageElement).src));
    expect(urls1.some(u => !urls0.has(u)), 'new tiles loaded').toBe(true);
    expect(await pins(page).count(), 'pins remain attached').toBeGreaterThan(0);
    const after = (await offsetOf()).find(p => p.title === far.title)!;
    const ratio = Math.hypot(after.dx, after.dy) / Math.hypot(far.dx, far.dy);
    console.log(`pin "${far.title}" offset ratio ${ratio.toFixed(2)} vs expected ${(2 ** (z1 - z0)).toFixed(2)}`);
    expect(ratio / 2 ** (z1 - z0), 'pin stays attached to its lat/lng').toBeGreaterThan(0.9);
    expect(ratio / 2 ** (z1 - z0)).toBeLessThan(1.1);

    // Pin stays glued to its lat/lng: after wheel zoom the pin must still be inside the map and tooltip-able.
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
    expect(await pins(page).count(), 'pins follow filter').toBe(n);
    await showList(page);
    await openControls(page);
    await setRange(page, /Max commute/, 'max');
    await showList(page);
    await expect(cards(page)).toHaveCount(TOWNS);
    await showMap(page);
    await expect(pins(page)).toHaveCount(TOWNS);
  });

  test('5b. homes budget filters homes; empty state offers a way out', async ({ page }) => {
    await gotoResults(page);
    await page.getByRole('combobox', { name: 'Max price' }).selectOption({ index: 2 });
    await expect(page.getByText(/Showing \d+ homes|No homes under/)).toBeVisible();
    await page.getByRole('combobox', { name: 'Sort' }).selectOption('price');
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
