import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração exclusiva para smoke de acessibilidade (axe / WCAG 2.1 AA).
 * Usa `vite preview` sobre o build de produção — sem backend, sem banco.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/a11y-smoke.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/a11y', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
/**
 * Configuração Playwright isolada para testes de acessibilidade (a11y).
 *
 * Usa `vite preview` para servir o build estático na porta 4173,
 * sem iniciar o backend ou exigir conexão com banco de dados.
 * Isso garante que o pipeline de PR de frontend rode de forma
 * totalmente isolada da infraestrutura de backend.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/a11y-smoke.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/a11y', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-a11y',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
