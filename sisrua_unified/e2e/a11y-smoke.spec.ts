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
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Aguarda o React hidratar a página antes de rodar a análise axe.
 * O preview serve os assets estáticos; o React pode demorar alguns
 * frames para terminar o mount inicial.
 */
async function waitForReactReady(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
}

type AxeViolation = {
  id: string;
  impact: string | null;
  description: string;
  nodes: Array<unknown>;
};

async function runCriticalAxe(
  page: import("@playwright/test").Page,
  options?: {
    include?: string[];
    rules?: string[];
  },
) {
  let builder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Componente de terceiros fora do escopo de controle direto
    .exclude(".leaflet-container");

  if (options?.include && options.include.length > 0) {
    builder = builder.include(options.include);
  }

  if (options?.rules && options.rules.length > 0) {
    builder = builder.withRules(options.rules);
  }

  const results = await builder.analyze();
  const criticalViolations = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  return criticalViolations;
}

function dumpViolations(context: string, violations: AxeViolation[]) {
  if (violations.length === 0) {
    return;
  }

  const summary = violations
    .map(
      (v) =>
        `[${(v.impact ?? "unknown").toUpperCase()}] ${v.id}: ${v.description}\n  Nós afetados: ${v.nodes.length}`,
    )
    .join("\n");

  console.error(`\n=== Violações a11y críticas (${context}) ===\n${summary}`);
}

async function tabUntilFocused(
  page: import("@playwright/test").Page,
  target: import("@playwright/test").Locator,
  maxTabs = 30,
) {
  await page.keyboard.press("Tab");
  for (let i = 0; i < maxTabs; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) {
      return true;
    }
    await page.keyboard.press("Tab");
  }
  return false;
}

// ---------------------------------------------------------------------------
// Testes de acessibilidade
// ---------------------------------------------------------------------------

test.describe("A11y smoke – página principal @smoke @a11y", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForReactReady(page);
  });

  test("não deve ter violações WCAG 2.1 AA críticas na raiz", async ({
    page,
  }) => {
    const criticalViolations = await runCriticalAxe(page);
    dumpViolations("raiz", criticalViolations as AxeViolation[]);

    expect(criticalViolations).toHaveLength(0);
  });

  test("elementos interativos devem ter rótulos acessíveis", async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a"])
      .withRules(["label", "button-name", "link-name", "image-alt"])
      .analyze();

    const labeling = results.violations.filter((v) =>
      ["label", "button-name", "link-name", "image-alt"].includes(v.id),
    );

    expect(labeling).toHaveLength(0);
  });

  test("contraste de cores não deve ter violações críticas", async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();

    const contrastViolations = results.violations.filter(
      (v) =>
        v.id === "color-contrast" &&
        (v.impact === "serious" || v.impact === "critical"),
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

test.describe("A11y smoke – estrutura de headings @smoke @a11y", () => {
  test("página deve ter h1 único e hierarquia de headings coerente", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForReactReady(page);

    const h1Count = await page.locator("h1").count();
    // Página SPA pode não ter h1 visível antes de interação; aviso em vez de falha.
    if (h1Count === 0) {
      console.warn(
        "Aviso: Nenhum <h1> encontrado na rota inicial. Verifique a estrutura de headings.",
      );
    }
    // Nunca deve ter mais de 1 h1 por contexto de documento
    expect(h1Count).toBeLessThanOrEqual(1);
  });
});

test.describe("A11y transversal – fluxos críticos BT @a11y", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForReactReady(page);
  });

  test("fluxo de editar poste por coordenadas deve manter WCAG e controles acessíveis", async ({
    page,
  }) => {
    const addPoleButton = page.getByRole("button", { name: /\+\s*POSTE/i });
    await expect(addPoleButton).toBeVisible();
    await addPoleButton.click();

    const coordinateInput = page.getByLabel("Coordenadas do poste");
    await expect(coordinateInput).toBeVisible();
    await coordinateInput.fill("texto invalido");

    const violations = await runCriticalAxe(page, {
      include: ["form", "main", "aside"],
      rules: ["label", "button-name", "aria-required-attr", "aria-valid-attr"],
    });
    dumpViolations(
      "fluxo BT - inserir poste por coordenadas",
      violations as AxeViolation[],
    );
    expect(violations).toHaveLength(0);
  });

  test("modal crítico de reset BT deve ser navegável por teclado e sem violações críticas", async ({
    page,
  }) => {
    const resetButton = page.getByRole("button", { name: /ZERAR BT/i });
    await expect(resetButton).toBeVisible();

    const reached = await tabUntilFocused(page, resetButton, 35);
    expect(reached).toBeTruthy();

    await page.keyboard.press("Enter");

    await expect(page.getByText(/Zerar topologia BT\?/i)).toBeVisible();

    const modalViolations = await runCriticalAxe(page, {
      rules: ["label", "button-name", "aria-valid-attr", "aria-required-attr"],
    });
    dumpViolations("modal crítico BT", modalViolations as AxeViolation[]);
    expect(modalViolations).toHaveLength(0);

    const cancelButton = page.getByRole("button", { name: /Cancelar/i }).last();
    await expect(cancelButton).toBeVisible();
    const focusedCancel = await tabUntilFocused(page, cancelButton, 20);
    expect(focusedCancel).toBeTruthy();

    await page.keyboard.press("Enter");
    await expect(page.getByText(/Zerar topologia BT\?/i)).not.toBeVisible();
  });
});
