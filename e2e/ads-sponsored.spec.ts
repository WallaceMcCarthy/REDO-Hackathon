import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { cardNames, gotoAreas, gotoResults, showMap } from './helpers';

// Creates accounts and publishes ads, so it refuses to run unless it is pointed at a local Convex.
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/;
const SITE = process.env.VITE_CONVEX_SITE_URL ?? '';
test.skip(!LOCAL.test(SITE), 'needs a local Convex');

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/ads-${name}-${project}.png`, fullPage: true });
};
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const sponsored = (page: Page) => page.getByRole('region', { name: /^Sponsored in / });

async function signUp(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('group').getByRole('button', { name: 'Create account' }).click();
  await modal.getByLabel('Email').fill(email);
  await modal.getByLabel('Password').fill('correct-horse-9');
  await modal.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

const IMAGE = 'https://image-host.invalid/broken.png';

async function fillAd(page: Page, message: string, image = IMAGE, town = 'Kanab') {
  const form = page.locator('main form');
  await form.getByLabel('Or choose a town').selectOption({ label: town });
  await form.getByLabel('Image URL').fill(image);
  await form.getByLabel('Message').fill(message);
  await form.getByLabel('Link').fill('https://example.com/a');
}

/** A small PNG served in place of the advertiser's image host, so no test depends on the network. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC', 'base64');

test('town page groups sample campaigns beside real metrics, labelled Sponsored and Sample', async ({ page }, info) => {
  await page.goto('/#/town/provo');
  const section = sponsored(page);
  await expect(section.getByRole('heading', { name: 'Sponsored in Provo' })).toBeVisible();

  const food = section.getByRole('region', { name: 'Sponsored: Food and drink' });
  await expect(food.getByRole('heading', { name: 'Lanternfish Noodle Counter' })).toBeVisible();
  await expect(food.getByText(/Town data, not an ad\. Restaurants & cafes nearby: [\d.]+/)).toBeVisible();
  await expect(section.getByRole('region', { name: 'Sponsored: Tech and jobs' }).getByText(/Tech employers: [\d,]+/)).toBeVisible();

  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(9);
  for (const card of await cards.all()) {
    await expect(card.getByText('Sponsored', { exact: true })).toBeVisible();
    await expect(card.getByText('Sample', { exact: true })).toBeVisible();
  }

  const img = food.locator('img').first();
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await noSideScroll(page)).toBe(true);
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/ads-town-${info.project.name}.png` });
});

test('the form asks only for location, image, message and link, and validates them', async ({ page }, info) => {
  await signUp(page, `form-${RUN}-${info.project.name}@example.test`);
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  await expect(form.getByRole('region', { name: 'Map for placing your ad' })).toBeVisible();
  await expect(form.locator('input, textarea, select')).toHaveCount(4);
  for (const gone of ['Business name', 'Business category', 'Duration']) await expect(form.getByLabel(gone)).toHaveCount(0);
  await expect(form.getByText('Ad type')).toHaveCount(0);

  await form.getByLabel('Image URL').fill('https://example.com/a.png');
  await form.getByLabel('Message').fill('A short pitch');
  await form.getByLabel('Link').fill('https://example.com/a');
  await form.getByRole('button', { name: 'Publish ad' }).click();
  expect(await form.getByLabel('Or choose a town').evaluate((el: HTMLSelectElement) => el.validity.valueMissing)).toBe(true);
  await expect(page.getByText('No campaigns yet')).toBeVisible();

  await form.getByLabel('Or choose a town').selectOption({ label: 'Kanab' });
  await form.getByLabel('Image URL').fill('http://example.com/a.png');
  await form.getByRole('button', { name: 'Publish ad' }).click();
  await expect(page.getByText('Image URL must start with https://')).toBeVisible();

  await form.getByLabel('Image URL').fill('https://example.com/a.png');
  await form.getByLabel('Link').fill('http://example.com/a');
  await form.getByRole('button', { name: 'Publish ad' }).click();
  await expect(page.getByText('Destination URL must start with https://')).toBeVisible();
  await expect(page.getByText('No campaigns yet')).toBeVisible();
  await expect(page.getByText(/\[CONVEX|Uncaught|Server Error/)).toHaveCount(0);
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'form', info.project.name);
});

test('a click or tap on the map sets the pin, and outside Utah it does not', async ({ page }, info) => {
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  const map = form.getByRole('region', { name: 'Map for placing your ad' });
  const town = form.getByLabel('Or choose a town');
  await expect(map.locator('canvas')).toBeVisible();
  const { width, height } = (await map.boundingBox())!;
  await map.scrollIntoViewIfNeeded();

  await map.click({ position: { x: 2, y: height / 2 } });
  await expect(form.getByText('Choose a spot inside Utah.')).toBeVisible();
  await expect(town).toHaveValue('');
  await expect(map.locator('.maplibregl-marker')).toHaveCount(0);

  await map.click({ position: { x: width / 2, y: height / 2 } });
  await expect(form.getByText('Click or tap the map to set your pin.')).toBeVisible();
  await expect(map.locator('.maplibregl-marker')).toHaveCount(1);
  await expect(town).not.toHaveValue('');
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'picker', info.project.name);
});

test('the town select sets the pin by keyboard alone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard flow is covered at desktop width');
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  const town = form.getByLabel('Or choose a town');
  await town.focus();
  await page.keyboard.type('Kanab');
  await expect(town).toHaveValue('kanab');
  await expect(form.locator('.maplibregl-marker')).toHaveCount(1);
});

test('a new ad shows on its town page at once, labelled Sponsored, with no price owed', async ({ page, browser }, info) => {
  const message = `Kanab Test ${RUN} ${info.project.name}`;
  await signUp(page, `life-${RUN}-${info.project.name}@example.test`);
  await page.goto('/#/advertise');
  const main = page.locator('main');
  await expect(main.getByText('No payment needed')).toBeVisible();
  await expect(main.getByText(/\$\d/)).toHaveCount(0);
  await expect(main.locator('option', { hasText: '$' })).toHaveCount(0);
  await expect(main).not.toContainText(/sandbox|webhook|redo|pending/i);

  const form = page.locator('main form');
  await fillAd(page, message);
  await form.getByRole('button', { name: 'Publish ad' }).click();

  await expect(page.getByText('Your ad is live.')).toBeVisible();
  await expect(page).toHaveURL(/#\/advertise$/);
  await expect(form.getByLabel('Message')).toHaveValue('');
  await expect(form.getByLabel('Or choose a town')).toHaveValue('');
  await expect(form.locator('.maplibregl-marker')).toHaveCount(0);
  const card = page.getByRole('listitem').filter({ hasText: message });
  await expect(card.getByText('Live', { exact: true })).toBeVisible();
  await expect(card.getByText(/Sponsored section of the Kanab town page/)).toBeVisible();
  await expect(card.getByRole('heading', { name: message })).toBeVisible();
  await expect(card.locator('p', { hasText: message })).toHaveCount(0);
  await expect(card.getByTestId('ad-image-fallback')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'live', info.project.name);

  await card.getByRole('link', { name: 'See it on the Kanab page' }).click();
  await expect(page).toHaveURL(/#\/town\/kanab$/);
  const ad = sponsored(page).getByRole('article').filter({ hasText: message });
  await expect(ad.getByRole('heading', { name: message })).toBeVisible();
  await expect(ad.locator('p', { hasText: message })).toHaveCount(0);
  await expect(ad.getByText('Sponsored', { exact: true })).toBeVisible();
  await expect(ad.getByText('Sample', { exact: true })).toHaveCount(0);
  await ad.scrollIntoViewIfNeeded();
  await expect(ad.getByTestId('ad-image-fallback')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);

  const visitorContext = await browser.newContext();
  await visitorContext.route('https://example.com/**', route => route.abort());
  const visitor = await visitorContext.newPage();
  await visitor.goto('/#/town/kanab');
  const seen = sponsored(visitor).getByRole('article').filter({ hasText: message });
  await expect(seen.getByText('Sponsored', { exact: true })).toBeVisible();
  await seen.getByRole('link', { name: /Visit/ }).click();

  await page.goto('/#/advertise');
  const stat = (name: string) => card.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) }).locator('dd');
  // Other tests' visitors load this town too, so only the click count is exact.
  await expect.poll(async () => Number(await stat('Views').textContent())).toBeGreaterThanOrEqual(1);
  await expect(stat('Clicks')).toHaveText('1');
  await visitorContext.close();
});

test('signed out, the form asks for sign-in up front and keeps what was typed', async ({ page }, info) => {
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  await expect(page.getByText('Sign in to publish your ad')).toBeVisible();
  await shot(page, 'signed-out', info.project.name);

  await fillAd(page, 'Red Mesa Outfitters rents rafts');
  await form.getByRole('button', { name: 'Sign in to continue' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('group').getByRole('button', { name: 'Create account' }).click();
  await modal.getByLabel('Email').fill(`keep-${RUN}-${info.project.name}@example.test`);
  await modal.getByLabel('Password').fill('correct-horse-9');
  await modal.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await expect(page.getByText('Sign in to publish your ad')).toHaveCount(0);
  await expect(form.getByLabel('Message')).toHaveValue('Red Mesa Outfitters rents rafts');
  await expect(form.getByLabel('Link')).toHaveValue('https://example.com/a');
  await expect(form.getByLabel('Image URL')).toHaveValue(IMAGE);
  await expect(form.getByLabel('Or choose a town')).toHaveValue('kanab');
  await form.getByRole('button', { name: 'Publish ad' }).click();
  await expect(page.getByText('Your ad is live.')).toBeVisible();
});

test('a sixth live ad gets a plain message and is not published', async ({ page }, info) => {
  await signUp(page, `cap-${RUN}-${info.project.name}@example.test`);
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  for (let i = 1; i <= 6; i++) {
    await fillAd(page, `Cap Test ${i}`);
    await form.getByRole('button', { name: 'Publish ad' }).click();
    if (i < 6) await expect(page.getByRole('listitem').filter({ hasText: `Cap Test ${i}` })).toBeVisible();
  }
  await expect(page.getByText('You already have 5 live ads. Wait for one to end before publishing another.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Cap Test' })).toHaveCount(5);
  await expect(page.getByText(/\[CONVEX|Uncaught|Server Error/)).toHaveCount(0);
  expect(await noSideScroll(page)).toBe(true);
});

test('a new ad is a labelled image circle on the results map, and a click opens its link and counts', async ({ page, browser }, info) => {
  const message = `Map Test ${RUN} ${info.project.name}`;
  await signUp(page, `map-${RUN}-${info.project.name}@example.test`);
  // A fresh visitor each time: a second pass through the start screen changes the persona, and so the order.
  const ranked = async () => {
    const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const reader = await fresh.newPage();
    await gotoAreas(reader);
    const names = await cardNames(reader, 42);
    await fresh.close();
    return names;
  };
  const organic = await ranked();
  await page.goto('/#/advertise');
  // Each project gets a town of its own: ads at one spot thin out to a single pin, which the other tests would win.
  const [town, townId] = info.project.name === 'mobile' ? ['Vernal', 'vernal'] : ['Moab', 'moab'];
  await fillAd(page, message, 'https://image-host.invalid/round.png', town);
  await page.locator('main form').getByRole('button', { name: 'Publish ad' }).click();
  await expect(page.getByText('Your ad is live.')).toBeVisible();
  expect(await ranked(), 'a paid ad never moves a town').toEqual(organic);

  const context = await browser.newContext({ viewport: page.viewportSize()!, isMobile: info.project.name === 'mobile', hasTouch: info.project.name === 'mobile' });
  await context.route('https://image-host.invalid/**', route => route.fulfill({ contentType: 'image/png', body: PIXEL }));
  await context.route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: 'advertiser site' }));
  const visitor = await context.newPage();
  await gotoResults(visitor);
  await visitor.goto(`/#/results?town=${townId}`);
  await showMap(visitor);

  const ad = visitor.locator('.maplibregl-marker a').filter({ hasText: message });
  await expect(ad).toBeVisible();
  await expect(ad.getByText('Sponsored', { exact: true })).toBeVisible();
  await expect(ad).toHaveAttribute('target', '_blank');
  await expect(ad).toHaveAttribute('rel', /noopener/);
  await expect.poll(() => ad.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const circle = await ad.locator('img').evaluate(el => {
    const { width, height } = el.getBoundingClientRect();
    return { round: parseFloat(getComputedStyle(el).borderRadius) >= width / 2, square: width === height };
  });
  expect(circle).toEqual({ round: true, square: true });
  const canvas = (await visitor.locator('canvas.maplibregl-canvas').boundingBox())!;
  const edges = (await ad.boundingBox())!;
  expect(edges.x, 'the whole ad, label included, stays on the map').toBeGreaterThanOrEqual(canvas.x);
  expect(edges.x + edges.width).toBeLessThanOrEqual(canvas.x + canvas.width);
  const shown = await visitor.locator('.maplibregl-marker a').count();
  expect(shown).toBeLessThanOrEqual(8);
  expect(await noSideScroll(visitor)).toBe(true);
  await shot(visitor, 'map', info.project.name);

  const box = (await ad.boundingBox())!;
  let opened = 0;
  context.on('page', () => { opened += 1; });
  await visitor.mouse.move(box.x + 20, box.y + 20);
  await visitor.mouse.down();
  await visitor.mouse.move(box.x + 60, box.y + 40, { steps: 6 });
  await visitor.mouse.up();
  await visitor.waitForTimeout(300);
  expect(opened, 'dragging the map across an ad does not open it').toBe(0);

  await expect(ad).toBeVisible();
  const [tab] = await Promise.all([context.waitForEvent('page', { timeout: 10_000 }), ad.click()]);
  await expect(tab).toHaveURL('https://example.com/a');
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await expect(visitor.getByTestId('listing-panel')).toHaveCount(0);

  await page.goto('/#/advertise');
  const card = page.getByRole('listitem').filter({ hasText: message });
  const stat = (name: string) => card.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) }).locator('dd');
  await expect(stat('Clicks')).toHaveText('1');
  await expect.poll(async () => Number(await stat('Views').textContent())).toBeGreaterThanOrEqual(1);
  await context.close();
});

// Run on its own against a Convex with a fake STRIPE_SECRET_KEY: the rest of this file needs none set.
test('with Stripe on, a free ad skips checkout and goes live for a day', async ({ page }, info) => {
  test.skip(!process.env.E2E_STRIPE_SET, 'needs STRIPE_SECRET_KEY on the local Convex');
  const message = `Free Test ${RUN} ${info.project.name}`;
  await signUp(page, `free-${RUN}-${info.project.name}@example.test`);
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  await expect(form.getByRole('button', { name: 'Pay $35 with Stripe' })).toBeVisible();
  await form.getByRole('radio', { name: 'Free, 1 day' }).click();
  await fillAd(page, message);
  const chosen = form.getByRole('radio', { name: 'Free, 1 day' });
  await expect(chosen).toHaveAttribute('aria-checked', 'true');
  await expect(chosen).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(form.getByRole('radio', { name: '$35, 7 days' })).toHaveAttribute('aria-checked', 'false');
  await expect(form.getByText('No payment. Your ad goes live at once for 1 day.', { exact: false })).toBeVisible();
  await shot(page, 'free', info.project.name);
  await form.getByRole('button', { name: 'Publish ad' }).click();

  await expect(page.getByText('Your ad is live.')).toBeVisible();
  await expect(page).toHaveURL(/#\/advertise$/);
  const card = page.getByRole('listitem').filter({ hasText: message });
  await expect(card.getByText('Live', { exact: true })).toBeVisible();
  await expect(card.getByText('No charge')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});

test('a forged REDO webhook is refused', async () => {
  const body = JSON.stringify({ id: `evt_${RUN}`, type: 'payment.succeeded', data: { paymentId: `pay_${RUN}`, campaignId: 'forged', amount: 3500, currency: 'USD', status: 'succeeded' }, createdAt: Date.now() });
  const signature = createHmac('sha256', 'forged-secret').update(body).digest('hex');
  const res = await fetch(`${SITE}/redo-webhook`, { method: 'POST', body, headers: { 'x-redo-signature': signature } });
  expect(res.status).toBe(401);
});
