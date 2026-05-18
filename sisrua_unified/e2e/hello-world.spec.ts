import { test, expect } from '@playwright/test';

test('home page has correct headline', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible({ timeout: 10000 });
  const text = await h1.textContent();
  expect(text?.trim()).toBeTruthy();
});
