import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: "test-results/release-smoke-report.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run server",
    url: "http://127.0.0.1:3001/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      OFFLINE_MODE: "true",
      METRICS_TOKEN: process.env.METRICS_TOKEN ?? "release-smoke-metrics-token",
      ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? "release-smoke-admin-token",
    },
  },
});
