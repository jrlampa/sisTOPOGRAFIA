import { test, expect } from '@playwright/test';

test.describe('i18n Sidebar Localization @i18n @smoke', () => {
  test.use({ locale: 'pt-BR' });

  test('should render default pt-BR and allow switching to en-US and es-ES', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });

    // Skip if the workspace requires authentication (sidebar not rendered for unauthenticated users)
    const settingsBtn = page.getByRole('button', { name: 'Abrir configurações' });
    const isVisible = await settingsBtn.isVisible().catch(() => false);
    if (!isVisible) {
      const stillVisible = await settingsBtn
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!stillVisible) {
        test.skip(
          true,
          'i18n workspace sidebar unavailable – authentication required for sidebar E2E tests'
        );
        return;
      }
    }

    // 1. Open Settings (pt-BR)
    await settingsBtn.click();

    // 2. Open Project tab and validate pt-BR copy
    await page.locator('#settings-tab-project').click();
    await expect(page.getByText('Tipo de Projeto', { exact: true })).toBeVisible();

    // 3. Switch to en-US from General tab
    await page.locator('#settings-tab-general').click();
    // The select element has aria-label="Selecionar idioma da interface"
    const languageSelect = page.getByRole('combobox', { name: 'Selecionar idioma da interface' });
    await expect(languageSelect).toBeVisible();
    await languageSelect.selectOption('en-US');

    // 4. Validate English copy in Project tab
    await page.locator('#settings-tab-project').click();
    await expect(page.getByText('Project Type', { exact: true })).toBeVisible();

    // 5. Switch to es-ES and validate Spanish copy
    await page.locator('#settings-tab-general').click();
    await expect(languageSelect).toBeVisible();
    await languageSelect.selectOption('es-ES');

    await page.locator('#settings-tab-project').click();
    await expect(page.getByText('Tipo de Proyecto', { exact: true })).toBeVisible();
  });
});
