import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for the FANCY/CODD web app.
 *
 * webServer starts ONLY the vite dev server (apps/web `dev` script = `vite`,
 * port 5173). The Express backend is intentionally NOT started — every test
 * mocks `**​/api/**` via Playwright routing, so no real backend is required.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      // iPhone 13 emulation, but forced onto chromium (only browser installed).
      name: 'Mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'Desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
