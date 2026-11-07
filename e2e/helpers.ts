import { expect, type Page } from '@playwright/test';

export const TOWNS = 42;

/** Priorities (category sliders, commute cap) live in a popover. */
export async function openControls(page: Page) {
  const btn = page.getByRole('button', { name: 'Priorities' });
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
}

/** Results open on Homes. */
export async function gotoResults(page: Page, persona = 'Skier') {
  await page.goto('/');
  await page.getByRole('button', { name: persona, exact: false }).first().click();
  await page.getByRole('button', { name: 'Show my matches' }).click();
  await expect(page).toHaveURL(/#\/results$/);
  await expect(page.getByText(/Showing \d+ homes in \d+ areas?/)).toBeVisible({ timeout: 20_000 });
}

export async function gotoAreas(page: Page, persona = 'Skier') {
  await gotoResults(page, persona);
  await page.getByRole('button', { name: 'Areas', exact: true }).click();
  await expect(page.getByText(/areas ranked|areas match/)).toBeVisible();
}

export const cards = (page: Page) => page.getByRole('region', { name: 'Ranked towns' }).getByRole('listitem');
export const pins = (page: Page) => page.locator('.leaflet-marker-icon');

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

/**
 * Leaflet exposes no map global, so derive the (possibly fractional) zoom from a loaded tile:
 * tile z from its URL plus log2 of its rendered width over the native 256px.
 */
export const zoomOf = (page: Page) =>
  page.evaluate(() => {
    const t = [...document.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded')]
      .map(img => ({ z: Number(img.src.match(/tile\/(\d+)\//)?.[1]), w: img.getBoundingClientRect().width }))
      .filter(x => Number.isFinite(x.z) && x.w > 0);
    if (!t.length) return -1;
    const top = t.reduce((a, b) => (b.z > a.z ? b : a));
    return Math.round((top.z + Math.log2(top.w / 256)) * 100) / 100;
  });

/** Zoom once animations and tile fades have stopped moving it. */
export async function settledZoom(page: Page) {
  let last = await zoomOf(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const z = await zoomOf(page);
    if (z === last && (await page.locator('img.leaflet-tile-loading').count()) === 0) return z;
    last = z;
  }
  return last;
}

/** Phones show the list or the map, not both. */
export async function showMap(page: Page) {
  const toggle = page.getByRole('group', { name: 'List or map' }).getByRole('button', { name: 'Map' });
  if (await toggle.isVisible()) await toggle.click();
}
export async function showList(page: Page) {
  const toggle = page.getByRole('group', { name: 'List or map' }).getByRole('button', { name: 'List' });
  if (await toggle.isVisible()) await toggle.click();
}
