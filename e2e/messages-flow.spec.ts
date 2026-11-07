import { expect, test, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

// Creates real accounts, so it refuses to run unless VITE_CONVEX_URL names a local Convex.
test.skip(!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.VITE_CONVEX_URL ?? ''), 'needs a local Convex backend');
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const PASSWORD = 'correct-horse-9';
const HOSTILE = '<img src=x onerror=alert(1)><script>alert(2)</script> <b>bold</b>';
const SHOTS = process.env.E2E_SHOTS;

let projectContext: BrowserContextOptions = {};
test.beforeEach(async ({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }) => {
  projectContext = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
});

async function newUser(browser: Browser) {
  const ctx = await browser.newContext(projectContext);
  const page = await ctx.newPage();
  const dialogs: string[] = [];
  const errors: string[] = [];
  page.on('dialog', d => { dialogs.push(`${d.type()}: ${d.message()}`); void d.accept(); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, dialogs, errors };
}
type User = Awaited<ReturnType<typeof newUser>>;

const modal = (page: Page) => page.getByRole('dialog');

async function signUp(page: Page, email: string, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await modal(page).getByRole('group').getByRole('button', { name: 'Create account' }).click();
  await modal(page).getByLabel('Email').fill(email);
  await modal(page).getByLabel('Password').fill(PASSWORD);
  await modal(page).locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.goto('/#/account');
  await page.getByLabel('Display Name').fill(name);
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile updated successfully!')).toBeVisible();
}

const composer = (page: Page) => page.getByPlaceholder(/Enter to send/);
async function send(page: Page, text: string) {
  await composer(page).fill(text);
  await composer(page).press('Enter');
}
const messagesLink = (page: Page, unread?: number) =>
  page.getByRole('link', { name: unread ? `Messages ${unread} unread` : 'Messages', exact: true });
const bubbles = (page: Page) => page.locator('span.whitespace-pre-wrap');

/** Sends until the server pushes back or n messages are out; returns how many went through. */
async function burst(page: Page, prefix: string, n: number) {
  const limit = page.getByText('Message limit reached. Please try again later.');
  let sent = 0;
  for (; sent < n; sent++) {
    await send(page, `${prefix}-${sent}`);
    await expect(limit.or(bubbles(page).getByText(`${prefix}-${sent}`, { exact: true }))).toBeVisible();
    if (await limit.isVisible()) break;
  }
  return sent;
}

async function openListingThread(page: Page, town: string) {
  await page.goto(`/#/results?town=${town}`);
  await page.locator('article h3').nth(5).click();
  const panel = page.getByTestId('listing-panel');
  await expect(panel).toBeVisible();
  return panel;
}

const shot = async (u: User, name: string, info: { project: { name: string } }) => {
  if (SHOTS) await u.page.screenshot({ path: `${SHOTS}/dm-${name}-${info.project.name}.png` });
};
const controlsOutside = (page: Page) => page.evaluate(() => {
  const edge = document.querySelector('main')!.getBoundingClientRect().right;
  return [...document.querySelectorAll('main button, main a')].filter(el => el.getBoundingClientRect().right > edge).length;
});
const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('DM lifecycle: listing comment, unread, outsider, signed-out, block, report, limits, history, delete', async ({ browser }, info) => {
  const A = { email: `dma-${RUN}@example.test`, name: `Alice ${RUN}` };
  const B = { email: `dmb-${RUN}@example.test`, name: `Bob ${RUN}` };
  const C = { email: `dmc-${RUN}@example.test`, name: `Cara ${RUN}` };
  const TOWN = ['provo', 'ogden', 'logan', 'orem', 'sandy'][Math.floor(Math.random() * 5)];
  const a = await newUser(browser);
  const b = await newUser(browser);
  await signUp(a.page, A.email, A.name);
  await signUp(b.page, B.email, B.name);

  // Message someone from a listing comment.
  const aPanel = await openListingThread(a.page, TOWN);
  const comment = `Anyone sharing? ${RUN}`;
  await aPanel.getByPlaceholder(/Looking for roommates/).fill(comment);
  await aPanel.getByRole('button', { name: 'Post comment' }).click();
  await expect(aPanel.getByText(comment)).toBeVisible();
  await expect(aPanel.locator('[data-comment]').filter({ hasText: comment }).getByRole('button', { name: 'Message' })).toHaveCount(0);

  const bPanel = await openListingThread(b.page, TOWN);
  const theirs = bPanel.locator('[data-comment]').filter({ hasText: comment }).first();
  await theirs.getByRole('button', { name: 'Message' }).click();
  const dm = b.page.getByRole('dialog', { name: 'Direct message conversation' });
  await expect(dm).toBeVisible();
  await expect(dm.getByRole('heading', { name: A.name })).toBeVisible();
  await expect(dm.getByText('Participant')).toHaveCount(0);
  await send(b.page, `hello-1 ${RUN}`);
  await expect(dm.getByText(`hello-1 ${RUN}`)).toBeVisible();
  await shot(b, 'dialog', info);

  // Conversation appears for both; unread rises, then clears on open.
  await expect(messagesLink(a.page, 1)).toBeVisible();
  await messagesLink(a.page, 1).click();
  const row = a.page.getByRole('button').filter({ hasText: `hello-1 ${RUN}` }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(B.name);
  await row.click();
  await expect(bubbles(a.page).getByText(`hello-1 ${RUN}`)).toBeVisible();
  await expect(messagesLink(a.page)).toBeVisible();
  await expect(messagesLink(a.page, 1)).toHaveCount(0);
  const convoId = await a.page.evaluate(() => location.hash.split('/')[2]);
  expect(convoId).toBeTruthy();
  await b.page.keyboard.press('Escape');
  await expect(b.page.getByRole('dialog', { name: 'Direct message conversation' })).toHaveCount(0);
  await send(a.page, `reply-1 ${RUN}`);
  await expect(messagesLink(b.page, 1)).toBeVisible();
  await messagesLink(b.page, 1).click();
  await b.page.getByRole('button').filter({ hasText: `reply-1 ${RUN}` }).first().click();
  await expect(bubbles(b.page).getByText(`reply-1 ${RUN}`)).toBeVisible();
  await expect(messagesLink(b.page, 1)).toHaveCount(0);
  await shot(a, 'thread-a', info);
  await shot(b, 'thread-b', info);
  expect(await fits(a.page) && await fits(b.page), 'no horizontal overflow').toBe(true);

  // Hostile HTML is plain text; a long unbroken string wraps inside the bubble.
  await send(a.page, HOSTILE);
  await expect(bubbles(b.page).getByText(HOSTILE, { exact: true })).toBeVisible();
  const long = `L${'x'.repeat(400)}`;
  await send(a.page, long);
  await expect(bubbles(b.page).getByText(long, { exact: true })).toBeVisible();
  await expect(b.page.locator('main img, main script, main b')).toHaveCount(0);
  expect(a.dialogs.concat(b.dialogs).filter(d => d.startsWith('alert'))).toEqual([]);
  const overflowing = await b.page.evaluate(() => {
    const edge = document.querySelector('main')!.getBoundingClientRect().right;
    return [...document.querySelectorAll('span.whitespace-pre-wrap')].filter(el => el.getBoundingClientRect().right > edge).length;
  });
  expect(overflowing, 'long text wraps').toBe(0);
  expect(await fits(b.page)).toBe(true);
  await shot(b, 'hostile-long', info);
  expect(await controlsOutside(a.page), 'thread controls stay inside the card').toBe(0);

  // An outsider and a malformed id both get the friendly page.
  const c = await newUser(browser);
  await signUp(c.page, C.email, C.name);
  await c.page.goto(`/#/messages/${convoId}`);
  await expect(c.page.getByText('That conversation is not available')).toBeVisible();
  await expect(c.page.getByText(`hello-1 ${RUN}`)).toHaveCount(0);
  await c.page.goto('/#/messages/not-a-conversation');
  await expect(c.page.getByText('That conversation is not available')).toBeVisible();
  await c.page.goto('/#/messages');
  await expect(c.page.getByText('No conversations yet')).toBeVisible();

  // Signed out: sign-in prompt, no crash, no console errors.
  const anon = await newUser(browser);
  await anon.page.goto(`/#/messages/${convoId}`);
  await expect(anon.page.getByRole('button', { name: 'Sign in or create account' })).toBeVisible();
  await anon.page.goto('/#/messages');
  await expect(anon.page.getByRole('heading', { name: 'Sign in to view messages' })).toBeVisible();
  await anon.page.waitForTimeout(1500);
  expect(anon.errors).toEqual([]);
  await shot(anon, 'signed-out', info);
  await anon.ctx.close();
  await c.ctx.close();

  // Report a message from the other person; own messages have no Report.
  await expect(b.page.getByRole('button', { name: 'Report' })).toHaveCount(3);
  await expect(a.page.getByRole('button', { name: 'Report' })).toHaveCount(1);
  await a.page.getByRole('button', { name: 'Report' }).click();
  await expect(a.page.getByRole('button', { name: 'Reported' })).toHaveCount(1);
  await a.page.reload();
  await expect(a.page.getByRole('button', { name: 'Reported' })).toHaveCount(1);

  // Block: the blocked person cannot send and sees nothing that says why.
  await a.page.getByRole('button', { name: 'Block', exact: true }).click();
  await expect(a.page.getByRole('button', { name: 'Unblock' })).toBeVisible();
  await expect(composer(a.page)).toHaveCount(0);
  await send(b.page, `nope ${RUN}`);
  const err = b.page.getByRole('alert');
  await expect(err).toHaveText('Your message could not be sent.');
  await expect(err).not.toContainText(/block/i);
  await expect(b.page.getByRole('button', { name: /Unblock/ })).toHaveCount(0);
  await expect(b.page.getByRole('main').getByText(/blocked/i)).toHaveCount(0);
  await expect(bubbles(a.page).getByText(`nope ${RUN}`)).toHaveCount(0);
  await shot(a, 'blocked-a', info);
  expect(await controlsOutside(a.page), 'blocked view controls stay inside the card').toBe(0);
  await shot(b, 'blocked-b', info);
  await a.page.getByRole('button', { name: 'Unblock' }).click();
  await expect(composer(a.page)).toBeVisible();
  await send(b.page, `unblocked ${RUN}`);
  await expect(bubbles(a.page).getByText(`unblocked ${RUN}`)).toBeVisible();

  // Rate limit reads politely, then history past 50 messages loads on request.
  const sentA = await burst(a.page, `a${RUN}`, 25);
  expect(sentA, 'rate limit stops a burst').toBeLessThan(25);
  await expect(a.page.getByRole('alert')).toHaveText('Message limit reached. Please try again later.');
  await shot(a, 'rate-limit', info);
  await burst(b.page, `b${RUN}`, 20);
  await a.page.waitForTimeout(62_000);
  await burst(a.page, `c${RUN}`, 20);
  await a.page.reload();
  await expect(bubbles(a.page)).toHaveCount(50);
  const earlier = a.page.getByRole('button', { name: 'Load earlier messages' });
  await expect(earlier).toBeVisible();
  await earlier.click();
  await expect(bubbles(a.page).getByText(`hello-1 ${RUN}`)).toBeVisible();
  await expect(earlier).toHaveCount(0);
  await shot(a, 'history', info);

  // Deleting an account removes its conversations for the other person too.
  await a.page.goto('/#/account');
  await a.page.getByRole('button', { name: 'Delete my account' }).click();
  await a.page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await a.page.getByRole('button', { name: 'Permanently delete' }).click();
  await expect(a.page.getByRole('heading', { name: 'Your account has been deleted' })).toBeVisible();
  await b.page.goto('/#/messages');
  await expect(b.page.getByText('No conversations yet')).toBeVisible();
  await expect(b.page.getByText(`hello-1 ${RUN}`)).toHaveCount(0);
  await b.page.goto(`/#/messages/${convoId}`);
  await expect(b.page.getByText('That conversation is not available')).toBeVisible();

  expect(a.errors.filter(e => !/Failed to load resource|Server Error|ConvexError|Conversation not available|Message limit/.test(e))).toEqual([]);
  await a.ctx.close();
  await b.ctx.close();
});
