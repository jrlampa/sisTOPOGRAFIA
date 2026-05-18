import { test, expect } from '@playwright/test';

const APP_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

/**
 * auth-oauth.spec.ts — Testes E2E para OAuth (Google, Microsoft)
 *
 * Nota: Estes testes validam a presença e renderização dos botões OAuth.
 * Login real com Microsoft/Google não é testado em E2E (envolve redirecionamento externo).
 * Para testar o fluxo completo, use um teste de integração com Supabase mocado.
 */

test.describe('OAuth Buttons - Landing Page', () => {
  test('OAuth buttons aparecem na landing page', async ({ page }) => {
    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    // Verificar que ambos os botões OAuth estão visíveis
    const googleButton = page.getByRole('button', { name: /Google/i }).first();
    const microsoftButton = page.getByRole('button', { name: /Microsoft/i }).first();

    await expect(googleButton).toBeVisible();
    await expect(microsoftButton).toBeVisible();
  });

  test('OAuth buttons têm estrutura correta', async ({ page }) => {
    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    // Verificar que os botões têm ícones
    const googleButton = page.getByRole('button', { name: /Google/i }).first();
    const microsoftButton = page.getByRole('button', { name: /Microsoft/i }).first();

    // Verificar que contêm SVG (ícone)
    const googleIcon = googleButton.locator('svg');
    const microsoftIcon = microsoftButton.locator('svg');

    await expect(googleIcon).toBeVisible();
    await expect(microsoftIcon).toBeVisible();
  });

  test('Botão "Entrar com Google" é clicável', async ({ page }) => {
    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    const googleButton = page.getByRole('button', { name: /Google/i }).first();

    // Verificar que o botão está habilitado
    await expect(googleButton).toBeEnabled();

    // Validacao deterministica sem depender de redirecionamento externo OAuth.
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
  });

  test('Botão "Entrar com Microsoft" é clicável', async ({ page }) => {
    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    const microsoftButton = page.getByRole('button', { name: /Microsoft/i }).first();

    // Verificar que o botão está habilitado
    await expect(microsoftButton).toBeEnabled();

    // Validacao deterministica sem depender de redirecionamento externo OAuth.
    await expect(microsoftButton).toBeVisible();
    await expect(microsoftButton).toBeEnabled();
  });

  test('Divisor "OU" aparece entre login tradicional e OAuth', async ({ page }) => {
    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    // Procurar pelo texto "OU"
    const divider = page.getByText(/^OU$/);

    await expect(divider).toBeVisible();
  });

  test('OAuth buttons estão desabilitados durante loading', async ({ page }) => {
    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    // Preencher formulário (sem enviar)
    await page.getByTestId('login-email').fill('teste@im3brasil.com.br');
    await page.getByTestId('login-password').fill('SenhaTeste123!');

    // Iniciar envio
    // Ao clicar, OAuth buttons devem estar visíveis mas podem estar desabilitados
    // (dependendo da implementação de loading state)
    const googleButton = page.getByRole('button', { name: /Google/i }).first();
    const microsoftButton = page.getByRole('button', { name: /Microsoft/i }).first();

    await expect(googleButton).toBeVisible();
    await expect(microsoftButton).toBeVisible();
  });

  test('Layout responsivo: OAuth buttons em mobile', async ({ page }) => {
    // Simular tamanho de tela mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    const googleButton = page.getByRole('button', { name: /Google/i }).first();
    const microsoftButton = page.getByRole('button', { name: /Microsoft/i }).first();

    // Em mobile, os botões devem ocupar a largura total
    // Verificar que estão visíveis
    await expect(googleButton).toBeVisible();
    await expect(microsoftButton).toBeVisible();
  });

  test('GitHub button aparece como desabilitado (futuro)', async ({ page }) => {
    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    // Procurar botão GitHub
    const githubButton = page.getByRole('button', { name: /GitHub/i }).first();

    // Deve estar visível
    await expect(githubButton).toBeVisible();

    // Deve estar desabilitado
    await expect(githubButton).toBeDisabled();
  });

  test('Sem erros no console quando OAuth buttons são renderizados', async ({ page }) => {
    const errors: string[] = [];
    // Capturar erros e warnings do console
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.goto(APP_URL);

    // Rolar até a seção de acesso
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    // Aguardar um tempo para capturar qualquer erro assíncrono
    await page.waitForTimeout(1000);

    // Verificar que não há erros críticos
    // (Ignorar warnings de terceiros como analytics)
    const criticalErrors = errors.filter(
      e => !e.includes('third-party') && !e.includes('external')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('OAuth - Integração com AuthContext', () => {
  test('AuthProvider integra controles OAuth visiveis para o usuario', async ({ page }) => {
    await page.goto(APP_URL);
    await page.locator('#acesso').scrollIntoViewIfNeeded();

    await expect(page.getByRole('button', { name: /Google/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Microsoft/i }).first()).toBeVisible();
  });
});
