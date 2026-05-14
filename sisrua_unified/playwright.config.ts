import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3001/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      METRICS_TOKEN: process.env.METRICS_TOKEN ?? 'release-smoke-metrics-token',
      ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? 'e2e-admin-test-token',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    },
  },
});
