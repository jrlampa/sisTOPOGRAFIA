import { test, expect } from '@playwright/test';

test.describe('Autenticação sisRUA', () => {
  
  test('Login com sucesso - e-mail corporativo', async ({ page }) => {
    await page.goto('/');
    
    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();
    
    // Preencher credenciais
    await page.getByPlaceholder('seu@empresa.com.br').fill('teste@im3brasil.com.br');
    await page.getByPlaceholder('••••••••').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByRole('button', { name: /Entrar na Plataforma/i }).click();
    
    // Verificar feedback de sucesso
    await expect(page.getByText(/Bem-vindo de volta/i)).toBeVisible();
    
    // Verificar redirecionamento (aguarda URL do portal)
    await expect(page).toHaveURL(/.*portal\/dashboard/);
  });

  test('Bloqueio de acesso - e-mail não corporativo (Gmail)', async ({ page }) => {
    await page.goto('/');
    
    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();
    
    // Preencher credenciais
    await page.getByPlaceholder('seu@empresa.com.br').fill('teste@gmail.com');
    await page.getByPlaceholder('••••••••').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByRole('button', { name: /Entrar na Plataforma/i }).click();
    
    // O backend ou frontend deve exibir o erro de domínio
    const errorBox = page.locator('div.bg-rose-500\\/10');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText(/Somente emails @.* têm autoatendimento liberado/i);
  });

});
