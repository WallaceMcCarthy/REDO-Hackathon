// Renders public/og.png (1200x630) from the live start page: scene, headline and subhead only.
// Run with the dev server up: BASE=http://localhost:5173 npx tsx scripts/make-og-image.ts
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(process.env.BASE ?? 'http://localhost:5173/');
await page.getByRole('heading', { level: 1 }).waitFor();
await page.addStyleTag({ content: 'header, [aria-labelledby="budget"], main > section ~ * { display: none !important } main > section:first-child { height: 630px; display: flex; align-items: center } h1 { font-size: 72px !important } main > section p { font-size: 26px }' });
await page.screenshot({ path: 'public/og.png' });
await browser.close();
