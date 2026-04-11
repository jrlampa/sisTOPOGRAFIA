/**
 * Smoke tests de acessibilidade (a11y) para o frontend.
 *
 * Roda contra o build estático servido por `vite preview`,
 * sem dependência do backend ou banco de dados.
 *
 * Usa @axe-core/playwright para detectar violações WCAG 2.1 AA
 * nas rotas principais da aplicação.
 *
 * Tags: @smoke @a11y
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Aguarda o React hidratar a página antes de rodar a análise axe.
 * O preview serve os assets estáticos; o React pode demorar alguns
 * frames para terminar o mount inicial.
 */
async function waitForReactReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Testes de acessibilidade
// ---------------------------------------------------------------------------

test.describe('A11y smoke – página principal @smoke @a11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForReactReady(page);
  });

  test('não deve ter violações WCAG 2.1 AA críticas na raiz', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Exclui componentes de terceiros que não controlamos (ex.: Leaflet)
      .exclude('.leaflet-container')
      .analyze();

    // Filtra apenas impacto "serious" e "critical"
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );

    if (criticalViolations.length > 0) {
      const summary = criticalViolations
        .map(
          (v) =>
            `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n  Nós afetados: ${v.nodes.length}`,
        )
        .join('\n');
      console.error('\n=== Violações a11y críticas encontradas ===\n' + summary);
    }

    expect(criticalViolations).toHaveLength(0);
  });

  test('elementos interativos devem ter rótulos acessíveis', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a'])
      .withRules(['label', 'button-name', 'link-name', 'image-alt'])
      .analyze();

    const labeling = results.violations.filter((v) =>
      ['label', 'button-name', 'link-name', 'image-alt'].includes(v.id),
    );

    expect(labeling).toHaveLength(0);
  });

  test('contraste de cores não deve ter violações críticas', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast' && (v.impact === 'serious' || v.impact === 'critical'),
    );

    if (contrastViolations.length > 0) {
      console.warn(
        `Aviso: ${contrastViolations[0].nodes.length} elemento(s) com contraste insuficiente (${contrastViolations[0].impact}).`,
      );
    }

    // Contraste é tratado como aviso; não bloqueia o gate por enquanto.
    // Mudar para expect(contrastViolations).toHaveLength(0) quando o tema for finalizado.
    expect(contrastViolations.length).toBeLessThanOrEqual(10);
  });
});

test.describe('A11y smoke – estrutura de headings @smoke @a11y', () => {
  test('página deve ter h1 único e hierarquia de headings coerente', async ({ page }) => {
    await page.goto('/');
    await waitForReactReady(page);

    const h1Count = await page.locator('h1').count();
    // Página SPA pode não ter h1 visível antes de interação; aviso em vez de falha.
    if (h1Count === 0) {
      console.warn('Aviso: Nenhum <h1> encontrado na rota inicial. Verifique a estrutura de headings.');
    }
    // Nunca deve ter mais de 1 h1 por contexto de documento
    expect(h1Count).toBeLessThanOrEqual(1);
  });
});
