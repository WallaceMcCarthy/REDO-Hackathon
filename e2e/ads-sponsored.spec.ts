import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

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

async function fillAd(page: Page, title: string) {
  const form = page.locator('main form');
  await form.getByLabel('Location').selectOption({ label: 'Kanab' });
  await form.getByLabel('Business name').fill(title);
  await form.getByLabel('Message').fill('A short pitch for the test');
  await form.getByLabel('Link').fill('https://example.com/a');
  await form.getByLabel('Business category').selectOption('outdoor');
}

test('town page groups sample campaigns beside real metrics, labelled Sponsored and Sample', async ({ page }, info) => {
  await page.goto('/#/town/provo');
  const section = sponsored(page);
  await expect(section.getByRole('heading', { name: 'Sponsored in Provo' })).toBeVisible();

  // Samples rotate daily, so assert the labels and caps rather than which businesses show today.
  await expect(section.getByText(/Town data, not an ad\./).first()).toBeVisible();

  const cards = section.getByRole('article');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(11);
  for (const card of await cards.all()) {
    await expect(card.getByText('Sponsored', { exact: true })).toBeVisible();
    await expect(card.getByText('Sample', { exact: true })).toBeVisible();
  }

  const img = section.locator('img').first();
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await noSideScroll(page)).toBe(true);
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/ads-town-${info.project.name}.png` });
});

test('campaign form validates category, image and link', async ({ page }, info) => {
  await signUp(page, `form-${RUN}-${info.project.name}@example.test`);
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  await expect(form.getByLabel('Location')).toBeVisible();
  await expect(form.getByLabel('Image URL')).toBeVisible();

  await form.getByLabel('Business name').fill('Form Check');
  await form.getByLabel('Message').fill('A short pitch');
  await form.getByLabel('Link').fill('https://example.com/a');
  await form.getByRole('button', { name: 'Publish ad' }).click();
  expect(await form.getByLabel('Business category').evaluate((el: HTMLSelectElement) => el.validity.valueMissing)).toBe(true);
  await expect(page.getByText('No campaigns yet')).toBeVisible();

  await form.getByLabel('Business category').selectOption('food');
  await form.getByLabel('Image URL').fill('http://example.com/a.png');
  await form.getByRole('button', { name: 'Publish ad' }).click();
  await expect(page.getByText('Image URL must start with https://')).toBeVisible();

  await form.getByLabel('Image URL').fill('');
  await form.getByLabel('Link').fill('http://example.com/a');
  await form.getByRole('button', { name: 'Publish ad' }).click();
  await expect(page.getByText('Destination URL must start with https://')).toBeVisible();
  await expect(page.getByText('No campaigns yet')).toBeVisible();
  await expect(page.getByText(/\[CONVEX|Uncaught|Server Error/)).toHaveCount(0);
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'form', info.project.name);
});

test('a new ad shows on its town page at once, labelled Sponsored, with no price owed', async ({ page, browser }, info) => {
  const title = `Kanab Test ${RUN} ${info.project.name}`;
  await signUp(page, `life-${RUN}-${info.project.name}@example.test`);
  await page.goto('/#/advertise');
  const main = page.locator('main');
  await expect(main.getByText('No payment needed')).toBeVisible();
  await expect(main.getByText(/\$\d/)).toHaveCount(0);
  await expect(main.locator('option', { hasText: '$' })).toHaveCount(0);
  await expect(main).not.toContainText(/sandbox|webhook|redo|pending/i);

  const form = page.locator('main form');
  await form.getByLabel('Image URL').fill('https://image-host.invalid/broken.png');
  await fillAd(page, title);
  await form.getByRole('button', { name: 'Publish ad' }).click();

  await expect(page.getByText('Your ad is live.')).toBeVisible();
  await expect(page).toHaveURL(/#\/advertise$/);
  await expect(form.getByLabel('Business name')).toHaveValue('');
  const card = page.getByRole('listitem').filter({ hasText: title });
  await expect(card.getByText('Live', { exact: true })).toBeVisible();
  await expect(card.getByText(/Sponsored section of the Kanab town page/)).toBeVisible();
  await expect(card.getByText('Outdoor', { exact: true })).toBeVisible();
  await expect(card.getByTestId('ad-image-fallback')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'live', info.project.name);

  await card.getByRole('link', { name: 'See it on the Kanab page' }).click();
  await expect(page).toHaveURL(/#\/town\/kanab$/);
  const ad = sponsored(page).getByRole('article').filter({ hasText: title });
  await expect(ad.getByText('Sponsored', { exact: true })).toBeVisible();
  await expect(ad.getByText('Sample', { exact: true })).toHaveCount(0);
  await ad.scrollIntoViewIfNeeded();
  await expect(ad.getByTestId('ad-image-fallback')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);

  const visitorContext = await browser.newContext();
  await visitorContext.route('https://example.com/**', route => route.abort());
  const visitor = await visitorContext.newPage();
  await visitor.goto('/#/town/kanab');
  const seen = sponsored(visitor).getByRole('article').filter({ hasText: title });
  await expect(seen.getByText('Sponsored', { exact: true })).toBeVisible();
  await seen.getByRole('link', { name: /Visit/ }).click();

  await page.goto('/#/advertise');
  const stat = (name: string) => card.locator('dl > div').filter({ hasText: name }).locator('dd');
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

  await fillAd(page, 'Red Mesa Outfitters');
  await form.getByRole('button', { name: 'Sign in to continue' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('group').getByRole('button', { name: 'Create account' }).click();
  await modal.getByLabel('Email').fill(`keep-${RUN}-${info.project.name}@example.test`);
  await modal.getByLabel('Password').fill('correct-horse-9');
  await modal.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  await expect(page.getByText('Sign in to publish your ad')).toHaveCount(0);
  await expect(form.getByLabel('Business name')).toHaveValue('Red Mesa Outfitters');
  await expect(form.getByLabel('Message')).toHaveValue('A short pitch for the test');
  await expect(form.getByLabel('Link')).toHaveValue('https://example.com/a');
  await expect(form.getByLabel('Business category')).toHaveValue('outdoor');
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

test('a forged REDO webhook is refused', async () => {
  const body = JSON.stringify({ id: `evt_${RUN}`, type: 'payment.succeeded', data: { paymentId: `pay_${RUN}`, campaignId: 'forged', amount: 3500, currency: 'USD', status: 'succeeded' }, createdAt: Date.now() });
  const signature = createHmac('sha256', 'forged-secret').update(body).digest('hex');
  const res = await fetch(`${SITE}/redo-webhook`, { method: 'POST', body, headers: { 'x-redo-signature': signature } });
  expect(res.status).toBe(401);
});
