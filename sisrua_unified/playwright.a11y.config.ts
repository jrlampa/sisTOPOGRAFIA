import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração exclusiva para smoke de acessibilidade (axe / WCAG 2.1 AA).
 * Usa `vite preview` sobre o build de produção — sem backend, sem banco.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/a11y-smoke.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/a11y", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
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
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
