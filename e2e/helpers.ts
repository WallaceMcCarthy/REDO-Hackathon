import { expect, type Page } from '@playwright/test';
import type { Map as MapLibreMap } from 'maplibre-gl';

declare global {
  interface Window { __utahMap?: MapLibreMap }
}

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
  await expect(page.getByText(/Top \d+ homes in \d+ areas?/)).toBeVisible({ timeout: 20_000 });
}

export async function gotoAreas(page: Page, persona = 'Skier') {
  await gotoResults(page, persona);
  await page.getByRole('button', { name: 'Areas', exact: true }).click();
  await expect(page.getByText(/areas ranked|areas match/)).toBeVisible();
}

export const cards = (page: Page) => page.getByRole('region', { name: 'Ranked towns' }).getByRole('listitem');

/** Town pins are WebGL circles, not DOM nodes, so count the distinct towns the map actually drew. */
export const pinCount = (page: Page) =>
  page.evaluate(() => {
    const map = window.__utahMap;
    if (!map?.getLayer('towns-circle')) return -1;
    const drawn = map.queryRenderedFeatures({ layers: ['towns-circle', 'towns-dots'] });
    return new Set(drawn.map(f => f.properties.id)).size;
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

/** Needs a build with VITE_EXPOSE_MAP=1, which sets window.__utahMap. */
export const zoomOf = (page: Page) => page.evaluate(() => window.__utahMap?.getZoom() ?? -1);

/** Zoom once the camera has stopped and every visible tile has loaded. */
export async function settledZoom(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const map = window.__utahMap;
    return !!map && !map.isMoving() && map.areTilesLoaded();
  }), { timeout: 20_000 }).toBe(true);
  return zoomOf(page);
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
