import { defineConfig, devices } from '@playwright/test';

// Opt-in cross-engine run (npm run test:e2e:cross). Kept apart from playwright.config.ts so the default suite and the deployer stay Chromium-only and fast.
// Headless WebKit is Playwright's WebKit build on macOS, not iOS Safari: no iOS compositor, URL-bar resize, or real touch.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
});
