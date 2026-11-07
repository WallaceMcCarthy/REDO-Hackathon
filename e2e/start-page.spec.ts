import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoResults, openControls } from './helpers';

type RGB = [number, number, number];

const luminance = (rgb: RGB) => {
  const [r, g, b] = rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Text colour and the background it really sits on, compositing translucent ancestors over white. */
const textAndBackground = (el: Locator) =>
  el.evaluate(node => {
    const parse = (c: string) => c.match(/[\d.]+/g)!.map(Number);
    const layers: number[][] = [];
    for (let n: Element | null = node; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c[3] === undefined || c[3] > 0) layers.push(c);
      if (c[3] === undefined || c[3] === 1) break;
    }
    const bg = layers.reverse().reduce((under, [r, g, b, a = 1]) => [r, g, b].map((v, i) => v * a + under[i] * (1 - a)), [255, 255, 255]);
    return { text: parse(getComputedStyle(node).color).slice(0, 3), bg };
  }) as Promise<{ text: RGB; bg: RGB }>;

/** Reads pixels from a real screenshot, because a range track is a pseudo-element that computed styles cannot vouch for. */
async function pixels(page: Page, el: Locator, points: [number, number][]) {
  const png = (await el.screenshot({ scale: 'css' })).toString('base64');
  return page.evaluate(async ([data, at]) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return (at as [number, number][]).map(([x, y]) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3));
  }, [png, points] as const) as Promise<RGB[]>;
}

const THUMB = 24;
const snapX = (width: number, i: number) => THUMB / 2 + ((width - THUMB) * i) / 5;

async function expectVisibleTrack(page: Page, slider: Locator) {
  await slider.evaluate((el: HTMLInputElement) => { el.blur(); });
  const { width, height } = (await slider.boundingBox())!;
  const value = Number(await slider.inputValue());
  const filledAt = value > 0 ? (snapX(width, 0) + snapX(width, 1)) / 2 : null;
  const unfilledAt = value < 5 ? (snapX(width, 4) + snapX(width, 5)) / 2 : null;
  const [card, ...track] = await pixels(page, slider, [[width / 2, 4], ...[filledAt, unfilledAt].filter(x => x !== null).map(x => [x, height / 2] as [number, number])]);
  for (const colour of track) expect(contrast(colour, card), `track ${colour} on ${card}`).toBeGreaterThanOrEqual(3);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`start page, ${colorScheme} OS`, () => {
    test.use({ colorScheme });

    test('header controls are readable', async ({ page }) => {
      await page.goto('/');
      const signIn = page.getByRole('button', { name: 'Sign in' });
      await expect(signIn).toBeVisible();
      const controls = [signIn, ...(await page.locator('header a').all())];
      for (const control of controls) {
        const { text, bg } = await textAndBackground(control);
        const label = await control.textContent();
        expect(contrast(text, bg), `${label}: ${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    test('slider tracks are visible on the start page and in Results', async ({ page }) => {
      await page.goto('/');
      await expectVisibleTrack(page, page.getByRole('slider').first());
      await gotoResults(page);
      await openControls(page);
      await expectVisibleTrack(page, page.getByRole('slider', { name: /Cost of living/ }));
    });
  });
}

test('hero leads with the headline and an obvious primary action', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find a home in Utah that fits how you live');
  await expect(page.getByRole('button', { name: 'Show my matches' })).toBeInViewport();
  await expect(page.getByLabel('Max price')).toBeInViewport();
  await expect(page.getByRole('button', { name: /Skier/ })).toBeAttached();
  await page.getByRole('link', { name: 'Browse areas instead' }).click();
  await expect(page).toHaveURL(/#\/results\?view=areas$/);
});

test('budget submits with Enter', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Max price').fill('500000');
  await expect(page.getByLabel('Max price')).toHaveAttribute('aria-valuetext', 'Up to $500,000');
  await page.getByRole('button', { name: 'Show my matches' }).click();
  await expect(page).toHaveURL(/#\/results$/);
});

test('quiz budget reaches Results filters and updates with FilterBar', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Max price').fill('500000');
  await page.getByRole('button', { name: 'Show my matches' }).click();
  await expect(page).toHaveURL(/#\/results$/);

  const priceSelect = page.getByRole('slider', { name: 'Max price' });
  await expect(priceSelect).toHaveValue('500000');

  await priceSelect.fill('650000');
  await expect(priceSelect).toHaveValue('650000');

  await priceSelect.fill('2025000');
  await expect(priceSelect).toHaveAttribute('aria-valuetext', 'Any price');
});

test('quiz rent budget navigates to apartments view and sets Max rent filter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Rent' }).click();
  await page.getByLabel('Max rent per month').fill('2000');
  await page.getByRole('button', { name: 'Show my matches' }).click();
  await expect(page).toHaveURL(/#\/results\?view=apartments$/);

  const rentSelect = page.getByRole('slider', { name: 'Max rent' });
  await expect(rentSelect).toHaveValue('2000');
});

test('every slider has a tick at each snap, end labels and a 44px target', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('slider').first()).toBeVisible();
  const sliders = await page.getByRole('slider').all();
  await expect(page.getByText('Not important')).toHaveCount(sliders.length);
  await expect(page.getByText('Essential')).toHaveCount(sliders.length);
  for (const slider of sliders) {
    const box = (await slider.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const ticks = await slider.locator('xpath=..').locator('[data-tick]').all();
    expect(ticks).toHaveLength(6);
    for (const [i, tick] of ticks.entries()) {
      const t = (await tick.boundingBox())!;
      expect(t.height).toBeGreaterThan(6);
      expect(t.x + t.width / 2 - box.x).toBeCloseTo(snapX(box.width, i), 0);
    }
  }
});

test('the thumb lands on each tick', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider').first();
  await slider.focus();
  await slider.press('Home');
  const { width, height } = (await slider.boundingBox())!;
  for (let i = 0; i <= 5; i++) {
    await expect(slider).toHaveValue(String(i));
    const [centre] = await pixels(page, slider, [[snapX(width, i), height / 2]]);
    expect(centre, `white thumb centre at snap ${i}`).toEqual([255, 255, 255]);
    await slider.press('ArrowRight');
  }
});

test('sliders work from the keyboard and announce their value', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: /Cost of living/ });
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', '0, Not important');
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '1 of 5');
  await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', '5, Essential');
});

test('a tap on the track snaps the slider', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider').first();
  await slider.scrollIntoViewIfNeeded();
  const { width, height } = (await slider.boundingBox())!;
  await slider.click({ position: { x: snapX(width, 4), y: height / 2 } });
  await expect(slider).toHaveValue('4');
});

test('no slider shows while metrics load', async ({ page }) => {
  await page.routeWebSocket(/convex|\/api\/.*\/sync/, () => {});
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(0);
  await page.goto('/#/results');
  await page.getByRole('button', { name: 'Priorities' }).click();
  await expect(page.getByRole('dialog', { name: 'Priorities' }).locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole('slider', { name: /Community|Cost of living/, includeHidden: true })).toHaveCount(0);
});

test.describe('sign-in modal', () => {
  const open = async (page: Page) => {
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Sign in' });
    await opener.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    return opener;
  };

  test('opens on the email field and closes back to its opener', async ({ page }) => {
    const opener = await open(page);
    await expect(page.getByLabel('Email')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    await opener.click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('shows an error and marks both inputs invalid, without reaching the server', async ({ page }) => {
    await open(page);
    const dialog = page.getByRole('dialog');
    await expect(page.getByLabel('Email')).not.toHaveAttribute('aria-invalid', 'true');
    await dialog.getByRole('group').getByRole('button', { name: 'Create account' }).click();
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('short');
    await page.getByLabel('Password').press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Use at least 8 characters for your password.');
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Password')).toHaveAccessibleDescription(/Use at least 8 characters/);
    const { text, bg } = await textAndBackground(page.getByRole('alert'));
    expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
    await dialog.getByRole('group').getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeEmpty();
    await expect(page.getByLabel('Password')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('Tab stays inside the dialog', async ({ page }) => {
    await open(page);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.getByRole('dialog').evaluate(d => d.contains(document.activeElement))).toBe(true);
    }
  });
});

test('no horizontal scroll, with or without the modal', async ({ page }) => {
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.goto('/');
  await expect(page.getByRole('slider').first()).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
