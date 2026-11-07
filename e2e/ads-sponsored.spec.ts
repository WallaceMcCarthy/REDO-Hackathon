import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// Creates accounts and posts signed webhooks, so it refuses to run unless it is pointed at a local Convex.
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/;
const SITE = process.env.VITE_CONVEX_SITE_URL ?? '';
const SECRET = process.env.E2E_REDO_SECRET ?? '';
test.skip(!LOCAL.test(SITE) || !SECRET, 'needs a local Convex with E2E_REDO_SECRET set as REDO_WEBHOOK_SECRET');

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

function postWebhook(campaignId: string, amount: number, secret: string) {
  const body = JSON.stringify({
    id: `evt_${RUN}_${campaignId}_${secret.length}`,
    type: 'payment.succeeded',
    data: { paymentId: `pay_${RUN}`, campaignId, amount, currency: 'USD', status: 'succeeded' },
    createdAt: Date.now(),
  });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return fetch(`${SITE}/redo-webhook`, { method: 'POST', body, headers: { 'x-redo-signature': signature } });
}

test('town page groups sample campaigns beside real metrics, labelled Sponsored and Sample', async ({ page }, info) => {
  await page.goto('/#/town/provo');
  const section = sponsored(page);
  await expect(section.getByRole('heading', { name: 'Sponsored in Provo' })).toBeVisible();

  const food = section.getByRole('region', { name: 'Sponsored: Food and drink' });
  await expect(food.getByRole('heading', { name: 'Lanternfish Noodle Counter' })).toBeVisible();
  await expect(food.getByText(/Town data, not an ad\. Restaurants & cafes nearby: [\d.]+/)).toBeVisible();
  await expect(section.getByRole('region', { name: 'Sponsored: Tech and jobs' }).getByText(/Tech employers: [\d,]+/)).toBeVisible();

  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card.getByText('Sponsored', { exact: true })).toBeVisible();
    await expect(card.getByText('Sample', { exact: true })).toBeVisible();
  }

  const img = food.locator('img');
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
  await form.getByRole('button', { name: /campaign|pay/i }).click();
  expect(await form.getByLabel('Business category').evaluate((el: HTMLSelectElement) => el.validity.valueMissing)).toBe(true);
  await expect(page.getByText('No campaigns yet')).toBeVisible();

  await form.getByLabel('Business category').selectOption('food');
  await form.getByLabel('Image URL').fill('http://example.com/a.png');
  await form.getByRole('button', { name: /campaign|pay/i }).click();
  await expect(page.getByText('Image URL must use HTTPS protocol (https://)')).toBeVisible();

  await form.getByLabel('Image URL').fill('');
  await form.getByLabel('Link').fill('http://example.com/a');
  await form.getByRole('button', { name: /campaign|pay/i }).click();
  await expect(page.getByText('Destination URL must use HTTPS protocol (https://)')).toBeVisible();
  await expect(page.getByText('No campaigns yet')).toBeVisible();
  await expect(page.getByText(/\[CONVEX|Uncaught|Server Error/)).toHaveCount(0);
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'form', info.project.name);
});

test('a campaign stays hidden until a verified payment, and the dashboard says where it is', async ({ page, browser }, info) => {
  const title = `Kanab Test ${RUN} ${info.project.name}`;
  const visitor = await (await browser.newContext()).newPage();
  const onTownPage = async () => {
    await visitor.goto('about:blank');
    await visitor.goto('/#/town/kanab');
    await expect(sponsored(visitor).getByRole('heading', { name: 'Sponsored in Kanab' })).toBeVisible();
    return sponsored(visitor).getByRole('heading', { name: title });
  };

  await signUp(page, `life-${RUN}-${info.project.name}@example.test`);
  await page.goto('/#/advertise');
  const form = page.locator('main form');
  await form.getByLabel('Location').selectOption({ label: 'Kanab' });
  await form.getByLabel('Image URL').fill('https://image-host.invalid/broken.png');
  await form.getByLabel('Business name').fill(title);
  await form.getByLabel('Message').fill('A short pitch for the test');
  await form.getByLabel('Link').fill('https://example.com/a');
  await form.getByLabel('Business category').selectOption('outdoor');
  await form.getByRole('button', { name: /campaign|pay/i }).click();

  const card = page.getByRole('listitem').filter({ hasText: title });
  await expect(card.getByText('Pending payment')).toBeVisible();
  await expect(card.getByText(/^Not visible yet/)).toBeVisible();
  await expect(card.getByText(/^Next step:/)).toBeVisible();
  await expect(card.getByText('Outdoor', { exact: true })).toBeVisible();
  await expect(card.getByText('Kanab', { exact: true })).toBeVisible();
  await expect(card.getByRole('link')).toHaveCount(0);
  await expect(card.getByTestId('ad-image-fallback')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, 'pending', info.project.name);

  await expect(await onTownPage()).toHaveCount(0);

  const checkout = await page.getByRole('link', { name: 'View sandbox checkout info' }).getAttribute('href');
  const campaignId = new URLSearchParams(checkout?.split('?')[1]).get('campaignId') ?? '';
  expect(campaignId).not.toBe('');
  const amount = 7 * 500;

  expect((await postWebhook(campaignId, amount, 'forged-secret')).status).toBe(401);
  await expect(await onTownPage()).toHaveCount(0);
  await expect(card.getByText('Pending payment')).toBeVisible();

  expect((await postWebhook(campaignId, amount, SECRET)).status).toBe(200);
  await expect(card.getByText('Live', { exact: true })).toBeVisible();
  await expect(card.getByText(/Sponsored section of the Kanab town page/)).toBeVisible();
  await shot(page, 'live', info.project.name);

  await card.getByRole('link', { name: 'See it on the Kanab page' }).click();
  await expect(page).toHaveURL(/#\/town\/kanab$/);
  const ad = sponsored(page).getByRole('article').filter({ hasText: title });
  await expect(ad.getByText('Sponsored', { exact: true })).toBeVisible();
  await expect(ad.getByText('Sample', { exact: true })).toHaveCount(0);
  await ad.scrollIntoViewIfNeeded();
  await expect(ad.getByTestId('ad-image-fallback')).toBeVisible();

  await expect(await onTownPage()).toBeVisible();
  await visitor.context().close();
});
