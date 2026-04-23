import { test, expect } from "@playwright/test";

test.describe("i18n Sidebar Localization @i18n @smoke", () => {
  test.use({ locale: 'pt-BR' });

  test("should render default pt-BR and allow switching to en-US and es-ES", async ({ page }) => {
    await page.goto("/app");

    // 1. Verify default pt-BR texts in the BT Topology Panel (Project Type title)
    await expect(page.getByText("Tipo de Projeto", { exact: true })).toBeVisible();

    // 2. Open Settings (pt-BR)
    await page.getByRole("button", { name: "Abrir configurações" }).click();
    
    // 3. Wait for the settings modal to load and switch to en-US
    // The select element has aria-label="Selecionar idioma da interface"
    const languageSelect = page.getByRole("combobox", { name: "Selecionar idioma da interface" });
    await expect(languageSelect).toBeVisible();
    await languageSelect.selectOption("en-US");
    
    // Close settings modal by pressing Escape
    await page.keyboard.press("Escape");

    // 4. Verify English text in Sidebar
    await expect(page.getByText("Project Type", { exact: true })).toBeVisible();

    // 5. Open Settings (en-US)
    await page.getByRole("button", { name: "Open settings" }).click();

    // 6. Wait for modal and switch to es-ES
    await expect(languageSelect).toBeVisible();
    await languageSelect.selectOption("es-ES");
    await page.keyboard.press("Escape");

    // 7. Verify Spanish text
    await expect(page.getByText("Tipo de Proyecto", { exact: true })).toBeVisible();
  });
});
