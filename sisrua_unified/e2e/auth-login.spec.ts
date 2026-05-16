import { test, expect } from '@playwright/test';

test.describe('Autenticação sisRUA', () => {
  
  test('Login com sucesso - e-mail corporativo', async ({ page }) => {
    await page.goto('/');
    
    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();
    
<<<<<<< HEAD
    // Preencher credenciais usando data-testid
    await page.getByTestId('login-email').fill('teste@im3brasil.com.br');
    await page.getByTestId('login-password').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByTestId('login-submit').click();
    
    // Verificar feedback de sucesso usando data-testid
    const successMsg = page.getByTestId('login-success-message');
    await expect(successMsg).toBeVisible();
    await expect(successMsg).toContainText(/Bem-vindo/i);
    
    // Verificar redirecionamento funcional
    // Em vez de checar URL exata, checamos se um elemento do dashboard apareceu
    // Isso é mais robusto a mudanças de roteamento (ex: /portal vs /admin)
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15000 });
    
    // Checagem de URL como secundária e flexível
    await expect(page).toHaveURL(/.*dashboard/);
=======
    // Preencher credenciais
    await page.getByPlaceholder('seu@empresa.com.br').fill('teste@im3brasil.com.br');
    await page.getByPlaceholder('••••••••').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByRole('button', { name: /Entrar na Plataforma/i }).click();
    
    // Verificar feedback de sucesso
    await expect(page.getByText(/Bem-vindo de volta/i)).toBeVisible();
    
    // Verificar redirecionamento (aguarda URL do portal)
    await expect(page).toHaveURL(/.*portal\/dashboard/);
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)
  });

  test('Bloqueio de acesso - e-mail não corporativo (Gmail)', async ({ page }) => {
    await page.goto('/');
    
    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();
    
<<<<<<< HEAD
    // Preencher credenciais inválidas (domínio não permitido)
    await page.getByTestId('login-email').fill('teste@gmail.com');
    await page.getByTestId('login-password').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByTestId('login-submit').click();
    
    // O backend ou frontend deve exibir o erro de domínio
    // Usamos o data-testid estável 'login-error-message'
    const errorBox = page.getByTestId('login-error-message');
    await expect(errorBox).toBeVisible();
    
    // Regex flexível para a mensagem de erro, focando no domínio
    await expect(errorBox).toContainText(/emails? @.* liberado/i);
=======
    // Preencher credenciais
    await page.getByPlaceholder('seu@empresa.com.br').fill('teste@gmail.com');
    await page.getByPlaceholder('••••••••').fill('SenhaTeste123!');
    
    // Clicar em entrar
    await page.getByRole('button', { name: /Entrar na Plataforma/i }).click();
    
    // O backend ou frontend deve exibir o erro de domínio
    const errorBox = page.locator('div.bg-rose-500\\/10');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText(/Somente emails @.* têm autoatendimento liberado/i);
>>>>>>> 7065075 (chore: stabilize audit gates, remediate security deps, update RAG/MEMORY + CAC)
  });

});
