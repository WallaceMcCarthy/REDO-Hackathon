import { expect, type Page } from '@playwright/test';

export const TOWNS = 42;

/** On narrow screens the sliders sit in a collapsed <details>. */
export async function openControls(page: Page) {
  const summary = page.getByText('Adjust what matters');
  if (await summary.isVisible()) {
    const details = page.locator('details', { has: summary }).first();
    if (!(await details.evaluate((d: HTMLDetailsElement) => d.open))) await summary.click();
  }
}

export async function gotoResults(page: Page, persona = 'Skier') {
  await page.goto('/');
  await page.getByRole('button', { name: persona, exact: false }).first().click();
  await page.getByRole('button', { name: 'Show my towns' }).click();
  await expect(page).toHaveURL(/#\/results$/);
  // Results opens on Homes; these tests are about the ranked towns.
  await page.getByRole('button', { name: /^Towns/ }).click();
  await expect(page.getByText(/towns ranked|towns match/)).toBeVisible();
}

export const cards = (page: Page) => page.getByRole('region', { name: 'Ranked towns and listings' }).getByRole('listitem');
/** The MapLibre canvas. */
export const mapCanvas = (page: Page) => page.locator('.maplibregl-canvas');

type MapHook = { __utahMap?: any };
/** Distinct town pins in the GeoJSON source (the dev hook exposes the map as window.__utahMap). */
export const pinCount = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as MapHook).__utahMap;
    if (!map || !map.getSource('towns')) return -1;
    return new Set(map.querySourceFeatures('towns').map((f: any) => f.properties.id)).size;
  });

/** Town pins actually drawn in the viewport right now (rendered features, de-duplicated across tiles). */
export const renderedPinCount = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as MapHook).__utahMap;
    if (!map) return -1;
    return new Set(map.queryRenderedFeatures({ layers: ['towns-circle', 'towns-dots'] }).map((f: any) => f.properties.id)).size;
  });

/** Screen offset of every town pin from the map centre, via the map's own projection. */
export const pinOffsets = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as MapHook).__utahMap;
    const c = map.getCanvas().getBoundingClientRect();
    const cx = c.width / 2, cy = c.height / 2;
    return map.querySourceFeatures('towns').map((f: any) => {
      const p = map.project(f.geometry.coordinates);
      return { title: f.properties.name as string, dx: p.x - cx, dy: p.y - cy };
    });
  });

export async function cardNames(page: Page, n: number) {
  return cards(page).locator('.font-display.text-xl').evaluateAll((els, k) => els.slice(0, k).map(e => e.textContent), n);
}

export async function setRange(page: Page, name: RegExp, value: number | 'min' | 'max') {
  const slider = page.getByRole('slider', { name });
  await slider.evaluate((el: HTMLInputElement, v) => {
    const val = v === 'min' ? el.min : v === 'max' ? el.max : String(v);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** Current (fractional) zoom from the map hook, -1 before the map exists. */
export const zoomOf = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as MapHook).__utahMap;
    return map ? Math.round(map.getZoom() * 100) / 100 : -1;
  });

/** Zoom once easing and inertia have stopped moving it. */
export async function settledZoom(page: Page) {
  let last = await zoomOf(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const z = await zoomOf(page);
    const moving = await page.evaluate(() => (window as unknown as MapHook).__utahMap?.isMoving() ?? false);
    if (z === last && !moving) return z;
    last = z;
  }
  return last;
}

/** Resolves once the map's 'load' fired and the style is loaded. */
export const mapReady = (page: Page) =>
  page.waitForFunction(() => {
    const map = (window as unknown as MapHook).__utahMap;
    return !!map && map.loaded() && map.isStyleLoaded() && !!map.getSource('towns');
  }, undefined, { timeout: 30_000 });
