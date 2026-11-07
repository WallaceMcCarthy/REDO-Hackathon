import { expect, test, type Browser, type BrowserContextOptions, type Locator, type Page } from '@playwright/test';

// Creates real accounts, so it refuses to run unless VITE_CONVEX_URL names a local Convex.
test.skip(!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.VITE_CONVEX_URL ?? ''), 'needs a local Convex backend');
test.setTimeout(120_000);

const PASSWORD = 'correct-horse-9';
const run = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const modal = (page: Page) => page.getByRole('dialog');

let projectContext: BrowserContextOptions = {};
test.beforeEach(({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }) => {
  projectContext = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
});
const newPage = async (browser: Browser) => (await browser.newContext(projectContext)).newPage();

async function submit(page: Page, mode: 'Create account' | 'Sign in', email: string, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await modal(page).getByRole('group').getByRole('button', { name: mode }).click();
  await modal(page).getByLabel('Email').fill(email);
  await modal(page).getByLabel('Password').fill(password);
  await modal(page).locator('form').getByRole('button', { name: mode }).click();
}
const signedIn = (page: Page) => expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

test('one account per mailbox, whatever the capitals', async ({ browser }) => {
  const id = run();
  const first = await newPage(browser);
  await submit(first, 'Create account', `  Qa-${id}@Example.Test`);
  await signedIn(first);

  const lower = await newPage(browser);
  await submit(lower, 'Sign in', `qa-${id}@example.test`);
  await signedIn(lower);

  const twin = await newPage(browser);
  await submit(twin, 'Create account', `QA-${id}@EXAMPLE.TEST`, 'a-different-pass-1');
  await expect(modal(twin).getByText('That email already has an account.')).toBeVisible();
});

test('sign up refuses an address that cannot receive mail', async ({ browser }) => {
  const page = await newPage(browser);
  await submit(page, 'Create account', `qa-${run()}@nodot`);
  await expect(modal(page).getByText('Enter a valid email address.')).toBeVisible();
});

test('reporting tells the truth and survives a reload', async ({ browser, isMobile }) => {
  const id = run();
  const town = `/#/town/${isMobile ? 'orem' : 'provo'}`;
  const author = await newPage(browser);
  await submit(author, 'Create account', `author-${id}@example.test`);
  await signedIn(author);
  await author.goto(town);
  const body = `Comment ${id}`;
  const thread = author.getByRole('region', { name: 'Comments' }).last();
  await thread.getByRole('textbox').fill(body);
  await thread.locator('form').getByRole('button').last().click();
  const card = (scope: Locator) => scope.getByText(body).locator('xpath=ancestor::div[.//button][1]');
  await expect(card(thread).getByRole('button', { name: 'Delete' })).toBeVisible();
  await expect(card(thread).getByRole('button', { name: 'Report' })).toHaveCount(0);

  const reader = await newPage(browser);
  await submit(reader, 'Create account', `reader-${id}@example.test`);
  await signedIn(reader);
  await reader.goto(town);
  const seen = reader.getByRole('region', { name: 'Comments' }).last();
  const count = seen.getByText(/^\d+ comments?$/);
  await expect(card(seen)).toBeVisible();
  const before = parseInt(await count.innerText());
  await card(seen).getByRole('button', { name: 'Reply', exact: true }).click();
  await card(seen).getByPlaceholder(/^Reply to/).fill(`Reply ${id}`);
  await card(seen).locator('form').getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(seen.getByText(`Reply ${id}`)).toBeVisible();
  await expect(count).toHaveText(`${before + 1} comments`);

  await card(seen).getByRole('button', { name: 'Report', exact: true }).first().click();
  await expect(card(seen).getByRole('button', { name: 'Reported' }).first()).toBeDisabled();
  await reader.reload();
  const reloaded = reader.getByRole('region', { name: 'Comments' }).last();
  await expect(card(reloaded).getByRole('button', { name: 'Reported' }).first()).toBeDisabled();
});
