import { test, expect } from '@playwright/test';

test.describe('Autenticação sisRUA', () => {
  
  test('Login com sucesso - e-mail corporativo', async ({ page }) => {
    await page.goto('/');
    
    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();
    
    // Preencher credenciais usando data-testid
    await page.getByTestId('login-email').fill('teste@im3brasil.com.br');
    await page.getByTestId('login-password').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByTestId('login-submit').click();
    
    // Verificar feedback de sucesso usando data-testid
    const successMsg = page.getByTestId('login-success-message');
    await expect(successMsg).toBeVisible();
    await expect(successMsg).toContainText(/Bem-vindo de volta/i);
    
    // Verificar redirecionamento funcional (aguarda URL do portal ou mudança de estado)
    // Aumentamos o timeout pois há um delay de 1.5s intencional no componente
    await expect(page).toHaveURL(/.*portal\/dashboard/, { timeout: 10000 });
  });

  test('Bloqueio de acesso - e-mail não corporativo (Gmail)', async ({ page }) => {
    await page.goto('/');
    
    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();
    
    // Preencher credenciais inválidas
    await page.getByTestId('login-email').fill('teste@gmail.com');
    await page.getByTestId('login-password').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByTestId('login-submit').click();
    
    // O backend ou frontend deve exibir o erro de domínio
    const errorBox = page.getByTestId('login-error-message');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText(/Somente emails @.* têm autoatendimento liberado/i);
  });

});
