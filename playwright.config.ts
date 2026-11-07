import { defineConfig, devices } from '@playwright/test';

const external = process.env.E2E_BASE_URL;
const baseURL = external ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: external ? undefined : {
    command: 'VITE_EXPOSE_MAP=1 npm run build && npx vite preview --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 240_000,
    env: { VITE_CONVEX_URL: 'https://dashing-wolf-264.convex.cloud' },
  },
});
