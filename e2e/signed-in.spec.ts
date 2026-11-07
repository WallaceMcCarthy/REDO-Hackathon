import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

// Creates real accounts, so it refuses to run unless VITE_CONVEX_URL names a local Convex.
test.skip(!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.VITE_CONVEX_URL ?? ''), 'needs a local Convex backend');
test.describe.configure({ mode: 'serial' });

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const PASSWORD = 'correct-horse-9';
const XSS = '<img src=x onerror=alert(1)>';
const TOWN = 'provo';
const TOWN_NAME = 'Provo';

// Matches are capped at the top 20, so each run picks a random town to stay out of other runs' way.
const TOWNS: { name: string }[] = JSON.parse(readFileSync('data/cities.json', 'utf8'));
const MATE_TOWN = TOWNS[Math.floor(Math.random() * TOWNS.length)].name;

const A = { email: `a-${RUN}@example.test`, name: `Alice ${RUN}` };
const B = { email: `b-${RUN}@example.test`, name: `Bob ${RUN}` };

function watch(page: Page) {
  const dialogs: string[] = [];
  const errors: string[] = [];
  page.on('dialog', d => { dialogs.push(`${d.type()}: ${d.message()}`); void d.dismiss(); });
  page.on('pageerror', e => errors.push(String(e)));
  return { dialogs, errors };
}

const modal = (page: Page) => page.getByRole('dialog');
const accountLink = (page: Page) => page.locator('header a[href="#/account"]');

async function signUp(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await modal(page).getByRole('group').getByRole('button', { name: 'Create account' }).click();
  await modal(page).getByLabel('Email').fill(email);
  await modal(page).getByLabel('Password').fill(PASSWORD);
  await modal(page).locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await modal(page).getByLabel('Email').fill(email);
  await modal(page).getByLabel('Password').fill(password);
  await modal(page).locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
}

let projectContext: BrowserContextOptions = {};
test.beforeEach(async ({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }) => {
  projectContext = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
});

/** browser.newContext() ignores project settings, so pass the mobile ones through by hand. */
async function newUser(browser: Browser) {
  const ctx = await browser.newContext(projectContext);
  const page = await ctx.newPage();
  return { ctx, page, w: watch(page) };
}

test('sign up, sign out, wrong password, sign in again', async ({ browser }) => {
  const { ctx, page, w } = await newUser(browser);
  await signUp(page, A.email);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signIn(page, A.email, 'definitely-wrong-1');
  await expect(modal(page).getByText('Wrong email or password.')).toBeVisible();
  await modal(page).getByRole('button', { name: 'Close' }).click();

  await signIn(page, A.email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(modal(page)).toHaveCount(0);
  expect(w.errors).toEqual([]);
  await ctx.close();
});

test('account profile can be edited and survives reload', async ({ browser }) => {
  const { ctx, page } = await newUser(browser);
  await page.goto('/');
  await signIn(page, A.email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.goto('/#/results');
  await accountLink(page).click();
  await expect(page.getByRole('heading', { name: 'Your Profile' })).toBeVisible();
  await page.getByLabel('Display Name').fill(A.name);
  await page.getByLabel('Target Budget ($/mo)').fill('1800');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile updated successfully!')).toBeVisible();
  await expect(page.getByText(A.name, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Display Name')).toHaveValue(A.name);
  await expect(page.getByLabel('Target Budget ($/mo)')).toHaveValue('1800');

  // optional fields can be cleared again
  await page.getByLabel('Target Utah Town').selectOption(TOWN);
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile updated successfully!')).toBeVisible();
  await page.getByLabel('Target Budget ($/mo)').fill('');
  await page.getByLabel('Target Utah Town').selectOption('');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile updated successfully!')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Display Name')).toHaveValue(A.name);
  await expect(page.getByLabel('Target Budget ($/mo)')).toHaveValue('');
  await expect(page.getByLabel('Target Utah Town')).toHaveValue('');
  await ctx.close();
});

test('saved heart shows up in saved places and can be removed', async ({ browser }) => {
  const { ctx, page } = await newUser(browser);
  await page.goto('/');
  await signIn(page, A.email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.goto(`/#/town/${TOWN}`);
  const heart = page.getByRole('button', { name: 'Save to my places' }).first();
  await heart.scrollIntoViewIfNeeded();
  const card = page.locator('article').first();
  const label = (await card.locator('h3, h4').first().innerText().catch(() => '')).trim();
  await heart.click();
  await expect(card.getByRole('button', { name: 'Remove from saved places' })).toBeVisible();

  await page.goto('/#/results');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Saved' }).click();
  await expect(page.getByRole('heading', { name: 'My saved places' })).toBeVisible();
  const saved = page.locator('main li');
  await expect(saved).toHaveCount(1);
  if (label) await expect(saved.first()).toContainText(label);
  await saved.first().getByRole('button', { name: 'Remove from saved places' }).click();
  await expect(page.getByText(/No saved places yet/)).toBeVisible();
  await ctx.close();
});

test('town feed: signed-out can read not post; post, like, comment, delete; hostile text is inert', async ({ browser }) => {
  const anon = await newUser(browser);
  await anon.page.goto(`/#/town/${TOWN}`);
  await expect(anon.page.getByRole('heading', { name: `Ask the locals in ${TOWN_NAME}` })).toBeVisible();
  await expect(anon.page.getByText('Sign in to post, like, or comment.')).toBeVisible();
  await expect(anon.page.getByLabel(`Post to the ${TOWN_NAME} feed`)).toHaveCount(0);

  const { ctx, page, w } = await newUser(browser);
  await page.goto('/');
  await signIn(page, A.email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.goto(`/#/town/${TOWN}`);
  const text = `hello ${RUN} ${XSS}`;
  await page.getByLabel(`Post to the ${TOWN_NAME} feed`).fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const post = page.locator('article', { hasText: `hello ${RUN}` });
  await expect(post).toHaveCount(1);
  await expect(post.locator('p', { hasText: 'hello' })).toHaveText(text);
  await expect(post.locator('img')).toHaveCount(0);

  // signed-out visitor sees it, read only, as plain text
  await anon.page.reload();
  const seen = anon.page.locator('article', { hasText: `hello ${RUN}` });
  await expect(seen).toHaveCount(1);
  await expect(seen.locator('img')).toHaveCount(0);
  await expect(seen.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(seen.getByRole('button', { name: 'Report' })).toHaveCount(0);
  await expect(seen.getByRole('button', { name: /^Like/ })).toBeDisabled();
  await seen.getByPlaceholder(/Share local insights/).fill('anon comment');
  await seen.getByRole('button', { name: 'Post comment' }).click();
  await expect(seen.getByText('Please sign in to post comments.')).toBeVisible();

  await post.getByRole('button', { name: /^Like, 0 likes/ }).click();
  await expect(post.getByRole('button', { name: /^Unlike, 1 like/ })).toBeVisible();
  await post.getByRole('button', { name: /^Unlike/ }).click();
  await expect(post.getByRole('button', { name: /^Like, 0 likes/ })).toBeVisible();

  await post.getByPlaceholder(/Share local insights/).fill(`comment ${RUN} ${XSS}`);
  await post.getByRole('button', { name: 'Post comment' }).click();
  await expect(post.locator('p', { hasText: `comment ${RUN}` })).toHaveText(`comment ${RUN} ${XSS}`);
  await expect(post.locator('img')).toHaveCount(0);

  const thread = post.getByRole('region', { name: 'Comments' });

  // a signed-out visitor reads the comment but is not offered actions that would fail
  await anon.page.reload();
  const anonThread = anon.page.locator('article', { hasText: `hello ${RUN}` }).getByRole('region', { name: 'Comments' });
  await expect(anonThread.locator('p', { hasText: `comment ${RUN}` })).toHaveText(`comment ${RUN} ${XSS}`);
  await expect(anonThread.getByRole('button', { name: 'Report' })).toHaveCount(0);
  await expect(anonThread.getByRole('button', { name: 'Reply' })).toHaveCount(0);
  expect(anon.w.errors).toEqual([]);

  await thread.getByRole('button', { name: 'Delete', exact: true }).click(); // confirm dismissed
  expect(w.dialogs.some(d => d.startsWith('confirm'))).toBe(true);
  await expect(post.locator('p', { hasText: `comment ${RUN}` })).toHaveCount(1);
  page.removeAllListeners('dialog');
  page.on('dialog', d => void d.accept());
  await thread.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(post.locator('p', { hasText: `comment ${RUN}` })).toHaveCount(0);

  await post.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('article', { hasText: `hello ${RUN}` })).toHaveCount(0);
  expect(w.errors).toEqual([]);
  expect(w.dialogs.filter(d => d.startsWith('alert'))).toEqual([]);
  await ctx.close();
  await anon.ctx.close();
});

test('report a post by someone else', async ({ browser }) => {
  const a = await newUser(browser);
  await a.page.goto('/');
  await signIn(a.page, A.email, PASSWORD);
  await expect(a.page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await a.page.goto(`/#/town/${TOWN}`);
  await a.page.getByLabel(`Post to the ${TOWN_NAME} feed`).fill(`reportme ${RUN}`);
  await a.page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(a.page.locator('article', { hasText: `reportme ${RUN}` })).toHaveCount(1);

  const b = await newUser(browser);
  await signUp(b.page, B.email);
  await b.page.goto(`/#/town/${TOWN}`);
  const post = b.page.locator('article', { hasText: `reportme ${RUN}` });
  await expect(post).toHaveCount(1);
  await expect(post.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await post.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(b.page.getByRole('status').filter({ hasText: 'Thanks. We will review this post.' })).toBeVisible();

  // comment report on a's comment
  await a.page.locator('article', { hasText: `reportme ${RUN}` }).getByPlaceholder(/Share local insights/).fill(`c-${RUN}`);
  await a.page.locator('article', { hasText: `reportme ${RUN}` }).getByRole('button', { name: 'Post comment' }).click();
  await expect(post.locator('p', { hasText: `c-${RUN}` })).toBeVisible();
  await post.getByRole('button', { name: 'Report', exact: true }).last().click();
  await expect(post.getByRole('button', { name: 'Reported' })).toBeVisible();

  a.page.on('dialog', d => void d.accept());
  await a.page.locator('article', { hasText: `reportme ${RUN}` }).getByRole('button', { name: 'Delete', exact: true }).first().click();
  await a.ctx.close();
  await b.ctx.close();
});

test('roommates: match, request, accept, contact only after accept', async ({ browser }) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  await a.page.goto('/');
  await signIn(a.page, A.email, PASSWORD);
  await expect(a.page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await b.page.goto('/');
  await signIn(b.page, B.email, PASSWORD);
  await expect(b.page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  const fill = async (page: Page, bio: string, contact: string) => {
    await page.goto('/#/roommates');
    await expect(page.getByRole('heading', { name: 'Join the roommate finder' })).toBeVisible();
    await page.getByRole('button', { name: MATE_TOWN, exact: true }).click();
    await page.getByRole('button', { name: 'Quiet' }).click();
    await page.getByLabel(/Short bio/).fill(bio);
    await page.getByLabel(/^Contact/).fill(contact);
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByRole('heading', { name: 'Your roommate profile' })).toBeVisible();
  };
  await fill(a.page, `bioA ${RUN} ${XSS}`, `alice-contact-${RUN}`);
  await fill(b.page, `bioB ${RUN}`, `bob-contact-${RUN}`);
  await expect(a.page.locator('img[src="x"]')).toHaveCount(0);

  // B sees A as a match with hostile bio as text
  const match = b.page.locator('li', { hasText: `bioA ${RUN}` });
  await expect(match).toHaveCount(1);
  await expect(match).toContainText(XSS);
  await expect(match.locator('img')).toHaveCount(0);
  await expect(match).not.toContainText(`alice-contact-${RUN}`);
  await match.getByRole('button', { name: 'Request to connect' }).click();
  await expect(b.page.getByRole('status').filter({ hasText: 'Request sent.' })).toBeVisible();
  await expect(match).toHaveCount(0);

  // A sees the request, no contact yet
  await a.page.reload();
  const req = a.page.locator('li', { hasText: `bioB ${RUN}` });
  await expect(req).toHaveCount(1);
  await expect(a.page.getByText(`bob-contact-${RUN}`)).toHaveCount(0);
  await req.getByRole('button', { name: 'Accept' }).click();
  await expect(a.page.getByText(`bob-contact-${RUN}`)).toBeVisible();

  // B sees A's contact only now
  await expect(b.page.getByText(`alice-contact-${RUN}`)).toBeVisible();
  await expect(b.page.getByText(`bob-contact-${RUN}`)).toHaveCount(0);
  // A is no longer in B's matches
  await expect(b.page.getByRole('region', { name: 'Your matches' }).locator('li', { hasText: `bioA ${RUN}` })).toHaveCount(0);

  for (const u of [a, b]) {
    u.page.removeAllListeners('dialog');
    u.page.on('dialog', d => void d.accept());
    await u.page.getByRole('button', { name: 'Delete profile' }).click();
    await expect(u.page.getByRole('heading', { name: 'Join the roommate finder' })).toBeVisible();
  }
  await a.ctx.close();
  await b.ctx.close();
});

test('roommates: signed-out sees prompt only', async ({ page }) => {
  await page.goto('/#/roommates');
  await expect(page.getByRole('heading', { name: 'Roommate finder' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in or create an account' }).click();
  await expect(modal(page)).toBeVisible();
});

test('account bio-like hostile display name renders as text', async ({ browser }) => {
  const { ctx, page, w } = await newUser(browser);
  await page.goto('/');
  await signIn(page, B.email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.goto('/#/results');
  await accountLink(page).click();
  await page.getByLabel('Display Name').fill(`${XSS}${RUN}`);
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile updated successfully!')).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByText(`${XSS}${RUN}`, { exact: true }).first()).toBeVisible();
  expect(w.dialogs).toEqual([]);
  await ctx.close();
});

test('app header does not cover page controls', async ({ browser }) => {
  const { ctx, page } = await newUser(browser);
  await signUp(page, `c-${RUN}@example.test`);
  const bar = page.locator('header').first();
  const pages: [string, () => ReturnType<Page['locator']>][] = [
    ['/#/roommates', () => page.getByRole('heading', { level: 1 })],
    ['/#/account', () => page.getByRole('button', { name: /Back to results/ })],
    [`/#/town/${TOWN}`, () => page.getByRole('button', { name: 'Back to results' })],
  ];
  for (const [url, target] of pages) {
    await page.goto(url);
    await expect(target()).toBeVisible();
    const [a, b] = [await bar.boundingBox(), await target().boundingBox()];
    const overlap = a!.x < b!.x + b!.width && b!.x < a!.x + a!.width && a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
    expect(overlap, `${url} covered by the header`).toBe(false);
  }
  await ctx.close();
});

test('account form validates budget and household before saving', async ({ browser }) => {
  const { ctx, page } = await newUser(browser);
  await signUp(page, `v-${RUN}@example.test`);
  await page.goto('/#/account');
  const save = page.getByRole('button', { name: 'Save Profile' });
  const household = page.getByLabel('Household Size');

  await page.getByLabel('Target Budget ($/mo)').fill('-5');
  await household.fill('13');
  await save.click();
  await expect(page.getByText('Enter a budget from $0 to $50,000,000.')).toBeVisible();
  await expect(page.getByText('Household size is a whole number from 1 to 12.')).toBeVisible();
  await expect(household).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Profile updated successfully!')).toHaveCount(0);

  await page.getByLabel('Target Budget ($/mo)').fill('2400');
  await household.fill('2.5');
  await save.click();
  await expect(page.getByText('Household size is a whole number from 1 to 12.')).toBeVisible();
  await expect(page.getByText('Profile updated successfully!')).toHaveCount(0);

  await household.fill('3');
  await save.click();
  await expect(page.getByText('Profile updated successfully!')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Target Budget ($/mo)')).toHaveValue('2400');
  await expect(household).toHaveValue('3');
  await ctx.close();
});

test('delete account needs DELETE, removes the login and signs out', async ({ browser }) => {
  const email = `del-${RUN}@example.test`;
  const { ctx, page, w } = await newUser(browser);
  await signUp(page, email);
  await page.goto('/#/account');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  const confirm = page.getByRole('button', { name: 'Permanently delete' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('delete');
  await expect(confirm).toBeDisabled();
  await page.getByRole('button', { name: 'Keep my account' }).click();
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Your account has been deleted' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await page.goto('/#/results');
  await signIn(page, email, PASSWORD);
  await expect(modal(page).getByText('Wrong email or password.')).toBeVisible();
  expect(w.errors.filter(e => !/InvalidAccountId|InvalidSecret|Invalid credentials/.test(e))).toEqual([]);
  await ctx.close();
});

test('signed-in screens have no sideways scroll', async ({ browser }, info) => {
  const { ctx, page } = await newUser(browser);
  const shots = process.env.E2E_SHOTS;
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(modal(page)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/sign-in-modal-${info.project.name}.png` });
  await modal(page).getByRole('button', { name: 'Close' }).click();
  await signUp(page, `s-${RUN}@example.test`);

  await page.goto(`/#/town/${TOWN}`);
  await page.getByRole('button', { name: 'Save to my places' }).first().click();
  await expect(page.getByRole('button', { name: 'Remove from saved places' }).first()).toBeVisible();

  const screens: [string, string, RegExp | string][] = [
    ['account', '/#/account', 'Your Profile'],
    ['saved', '/#/saved', 'My saved places'],
    ['roommates', '/#/roommates', 'Join the roommate finder'],
    ['advertise', '/#/advertise', 'Advertiser dashboard'],
    ['town', `/#/town/${TOWN}`, `Ask the locals in ${TOWN_NAME}`],
  ];
  for (const [name, url, heading] of screens) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${name} overflow px`).toBeLessThanOrEqual(0);
    if (shots) await page.screenshot({ path: `${shots}/signed-in-${name}-${info.project.name}.png`, fullPage: name !== 'town' });
  }
  await page.goto('/#/account');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByLabel('Type DELETE to confirm').scrollIntoViewIfNeeded();
  if (shots) await page.screenshot({ path: `${shots}/signed-in-delete-confirm-${info.project.name}.png`, fullPage: true });
  await ctx.close();
});

test('advertiser form shows validation text, never a raw Convex error', async ({ browser }) => {
  const { ctx, page } = await newUser(browser);
  await page.goto('/#/advertise');
  await expect(page.getByText('Sign in to see your campaigns')).toBeVisible();
  await signUp(page, `ad-${RUN}@example.test`);
  await page.goto('/#/advertise');
  await expect(page.getByText('No campaigns yet')).toBeVisible();
  await page.getByLabel('Headline').fill('Test campaign');
  await page.getByLabel('Description').fill('A short pitch');
  await page.getByLabel(/Destination URL/).fill('http://example.test');
  await page.locator('main form').getByRole('button', { name: /checkout|campaign|create/i }).click();
  await expect(page.getByText('Destination URL must use HTTPS protocol (https://)')).toBeVisible();
  await expect(page.getByText(/\[CONVEX|Uncaught|Server Error/)).toHaveCount(0);
  await ctx.close();
});

test('listing panel comments, direct message, unread badge, and DMs die with the account', async ({ browser }, info) => {
  const shots = process.env.E2E_SHOTS;
  const openPanel = async (page: Page) => {
    await page.goto(`/#/results?town=${TOWN}`);
    await page.locator('article h3').nth(7).click();
    const panel = page.getByTestId('listing-panel');
    await expect(panel).toBeVisible();
    return panel;
  };
  const panelFits = (page: Page) => page.getByTestId('listing-panel').evaluate(el => el.scrollWidth - el.clientWidth);
  const shotPanel = async (page: Page, name: string) => {
    if (!shots) return;
    await page.getByTestId('listing-panel').getByRole('region', { name: 'Comments' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${shots}/panel-${name}-${info.project.name}.png` });
  };

  const anon = await newUser(browser);
  const anonPanel = await openPanel(anon.page);
  await expect(anonPanel.getByRole('region', { name: 'Comments' })).toBeVisible();
  await expect(anonPanel.getByRole('button', { name: 'Message' })).toHaveCount(0);
  await expect(anon.page.getByRole('link', { name: /Messages/ })).toHaveText('Messages');
  expect(await panelFits(anon.page)).toBeLessThanOrEqual(0);
  await shotPanel(anon.page, 'signed-out');
  expect(anon.w.errors.filter(e => /Sign in|Uncaught/.test(e))).toEqual([]);
  await anon.ctx.close();

  const a = await newUser(browser);
  const b = await newUser(browser);
  await signUp(a.page, `m1-${RUN}@example.test`);
  await signUp(b.page, `m2-${RUN}@example.test`);
  const aPanel = await openPanel(a.page);
  const body = `Anyone sharing this place? ${RUN}`;
  await aPanel.getByPlaceholder(/Looking for roommates/).fill(body);
  await aPanel.getByRole('button', { name: 'Post comment' }).click();
  const aComment = aPanel.getByText(body);
  await expect(aComment).toBeVisible();

  const bPanel = await openPanel(b.page);
  await expect(bPanel.getByText(body)).toBeVisible();
  const ownComment = bPanel.locator('[data-comment]').filter({ hasText: body }).first();
  await ownComment.getByRole('button', { name: 'Reply', exact: true }).click();
  await bPanel.getByPlaceholder(/^Reply to/).fill(`Yes, me too ${RUN}`);
  await bPanel.locator('form').filter({ has: b.page.getByPlaceholder(/^Reply to/) }).getByRole('button', { name: 'Reply' }).click();
  await expect(bPanel.getByText(`Yes, me too ${RUN}`)).toBeVisible();
  await expect(ownComment.getByRole('button', { name: 'Report' }).first()).toBeVisible();
  await expect(aPanel.getByRole('button', { name: 'Delete', exact: true }).first()).toBeVisible();
  expect(await panelFits(b.page)).toBeLessThanOrEqual(0);
  await shotPanel(a.page, 'owner');
  await shotPanel(b.page, 'reply');

  await ownComment.getByRole('button', { name: 'Message' }).first().click();
  await expect(b.page.getByRole('dialog', { name: 'Direct message conversation' })).toBeVisible();
  await b.page.getByPlaceholder(/Enter to send/).fill(`dm ${RUN}`);
  await b.page.getByPlaceholder(/Enter to send/).press('Enter');
  await expect(b.page.getByText(`dm ${RUN}`).last()).toBeVisible();
  if (shots) await b.page.screenshot({ path: `${shots}/messages-thread-${info.project.name}.png` });
  // The dialog sits over the app header, so its top is reachable on a phone.
  const dialogTop = (await b.page.getByRole('dialog', { name: 'Direct message conversation' }).locator('> div').boundingBox())!.y;
  const onTop = await b.page.evaluate(y => !document.elementFromPoint(195, y + 20)?.closest('header'), dialogTop);
  expect(onTop, 'conversation dialog is above the header').toBe(true);

  const badge = a.page.getByRole('link', { name: 'Messages 1 unread' });
  await expect(badge).toBeVisible();
  await badge.click();
  await a.page.getByRole('button').filter({ hasText: `dm ${RUN}` }).first().click();
  await expect(a.page.getByText(`dm ${RUN}`).last()).toBeVisible();
  await expect(a.page.getByRole('link', { name: 'Messages', exact: true })).toBeVisible();
  const scroll = await a.page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
  expect(scroll, 'messages page must not scroll under the header').toBeLessThanOrEqual(0);

  await a.page.goto('/#/messages/not-a-conversation');
  await expect(a.page.getByText('That conversation is not available')).toBeVisible();

  a.page.on('dialog', d => void d.accept());
  await a.page.goto('/#/account');
  await a.page.getByRole('button', { name: 'Delete my account' }).click();
  await a.page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await a.page.getByRole('button', { name: 'Permanently delete' }).click();
  await expect(a.page.getByRole('heading', { name: 'Your account has been deleted' })).toBeVisible();

  await b.page.goto('/#/messages');
  await expect(b.page.getByText(`dm ${RUN}`)).toHaveCount(0);
  await a.ctx.close();
  await b.ctx.close();
});

test('roommate profile form shows readable errors', async ({ browser }) => {
  const { ctx, page } = await newUser(browser);
  await signUp(page, `d-${RUN}@example.test`);
  await page.goto('/#/roommates');
  await page.getByLabel(/^Contact/).fill('x@example.test');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.getByRole('alert')).toHaveText('Pick 1 to 10 towns.');
  await page.getByRole('button', { name: TOWN_NAME, exact: true }).click();
  await page.getByLabel('Budget min ($/mo)').fill('2000');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.getByRole('alert')).toContainText("Minimum budget can't be above maximum.");
  await ctx.close();
});
