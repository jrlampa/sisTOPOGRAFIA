/**
 * formulaVersioningService.test.ts — T3.73: Versionamento Semântico de Fórmulas
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeDefinitionHash,
  listFormulas,
  getFormulaById,
  getActiveVersion,
  getVersionHistory,
  diffVersions,
  registerFormulaVersion,
  getDeprecationReport,
  resetCatalog,
} from "../services/formulaVersioningService.js";

describe("computeDefinitionHash", () => {
  it("retorna hash determinístico para mesma entrada", () => {
    const h1 = computeDefinitionHash("QT = P × Z × L / V²", { V: 127 });
    const h2 = computeDefinitionHash("QT = P × Z × L / V²", { V: 127 });
    expect(h1).toBe(h2);
  });

  it("retorna hash diferente quando expressão muda", () => {
    const h1 = computeDefinitionHash("QT = P × Z × L / V²", { V: 127 });
    const h2 = computeDefinitionHash("QT = 2 × P × Z × L / V²", { V: 127 });
    expect(h1).not.toBe(h2);
  });

  it("retorna hash diferente quando constante muda", () => {
    const h1 = computeDefinitionHash("expr", { V: 127 });
    const h2 = computeDefinitionHash("expr", { V: 220 });
    expect(h1).not.toBe(h2);
  });

  it("retorna string hexadecimal SHA-256 de 64 caracteres", () => {
    const h = computeDefinitionHash("expr", { k: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("listFormulas", () => {
  beforeEach(async () => {
    await resetCatalog();
  });

  it("retorna 5 fórmulas do catálogo inicial", async () => {
    const result = await listFormulas();
    expect(result.length).toBe(5);
  });

  it("cada entrada tem id, category, activeVersion, activeEntry", async () => {
    const result = await listFormulas();
    for (const f of result) {
      expect(f.id).toBeTruthy();
      expect(f.category).toBeTruthy();
      expect(f.activeVersion).toBeTruthy();
      expect(f.activeEntry).toBeDefined();
      expect(f.activeEntry.status).toBe("active");
    }
  });
});

describe("getFormulaById", () => {
  beforeEach(async () => {
    await resetCatalog();
  });

  it("retorna a fórmula QT_SEGMENTO_BT", async () => {
    const def = await getFormulaById("QT_SEGMENTO_BT");
    expect(def).not.toBeNull();
    expect(def!.id).toBe("QT_SEGMENTO_BT");
    expect(def!.category).toBe("bt_radial");
  });

  it("retorna null para fórmula inexistente", async () => {
    const def = await getFormulaById("FORMULA_INEXISTENTE");
    expect(def).toBeNull();
  });

  it("QT_SEGMENTO_BT tem versão ativa 2.0.0", async () => {
    const def = await getFormulaById("QT_SEGMENTO_BT");
    expect(def!.activeVersion).toBe("2.0.0");
  });
});

describe("getActiveVersion", () => {
  beforeEach(async () => {
    await resetCatalog();
  });

  it("retorna versão ativa com status 'active'", async () => {
    const active = await getActiveVersion("QT_SEGMENTO_BT");
    expect(active).not.toBeNull();
    expect(active!.status).toBe("active");
    expect(active!.version).toBe("2.0.0");
  });

  it("versão ativa contém fator de fase φ para MONO=2", async () => {
    const active = await getActiveVersion("QT_SEGMENTO_BT");
    expect(active!.constants["phi_MONO"]).toBe(2);
  });

  it("retorna null para fórmula inexistente", async () => {
    expect(await getActiveVersion("INEXISTENTE")).toBeNull();
  });

  it("LIMITE_CQT_ANEEL versão ativa é 2.0.0 com 8%", async () => {
    const active = await getActiveVersion("LIMITE_CQT_ANEEL");
    expect(active!.version).toBe("2.0.0");
    expect(active!.constants["ANEEL_CQT_LIMIT"]).toBe(0.08);
  });

  it("TENSAO_PISO_OPERACIONAL versão ativa tem V_min=117", async () => {
    const active = await getActiveVersion("TENSAO_PISO_OPERACIONAL");
    expect(active!.constants["V_min_V"]).toBe(117);
  });
});

describe("getVersionHistory", () => {
  beforeEach(async () => {
    await resetCatalog();
  });

  it("retorna histórico em ordem decrescente de versão", async () => {
    const history = await getVersionHistory("QT_SEGMENTO_BT");
    expect(history[0].version).toBe("2.0.0");
    expect(history[1].version).toBe("1.0.0");
  });

  it("retorna array vazio para fórmula inexistente", async () => {
    expect(await getVersionHistory("INEXISTENTE")).toEqual([]);
  });

  it("versão 1.0.0 de QT_SEGMENTO_BT está deprecated", async () => {
    const history = await getVersionHistory("QT_SEGMENTO_BT");
    const v1 = history.find((v) => v.version === "1.0.0");
    expect(v1?.status).toBe("deprecated");
  });
});

describe("diffVersions", () => {
  beforeEach(async () => {
    await resetCatalog();
  });

  it("detecta mudança de expressão entre v1 e v2 de QT_SEGMENTO_BT", async () => {
    const diff = await diffVersions("QT_SEGMENTO_BT", "1.0.0", "2.0.0");
    expect(diff).not.toBeNull();
    const exprChange = diff!.changedFields.find((f) => f.field === "expression");
    expect(exprChange).toBeDefined();
  });

  it("diff é marcado como breaking quando há mudança de expressão", async () => {
    const diff = await diffVersions("QT_SEGMENTO_BT", "1.0.0", "2.0.0");
    expect(diff!.isBreaking).toBe(true);
    expect(diff!.breakingReason).toBeTruthy();
  });

  it("retorna null para fórmula inexistente", async () => {
    const diff = await diffVersions("INEXISTENTE", "1.0.0", "2.0.0");
    expect(diff).toBeNull();
  });

  it("retorna null para versão inexistente", async () => {
    const diff = await diffVersions("QT_SEGMENTO_BT", "9.9.9", "2.0.0");
    expect(diff).toBeNull();
  });

  it("diff entre versão idêntica não tem campos alterados", async () => {
    const diff = await diffVersions("RESISTENCIA_CORRIGIDA", "1.0.0", "1.0.0");
    expect(diff!.changedFields).toHaveLength(0);
    expect(diff!.isBreaking).toBe(false);
  });
});

describe("registerFormulaVersion", () => {
  beforeEach(async () => {
    await resetCatalog();
  });

  it("registra nova versão numa fórmula existente", async () => {
    const result = await registerFormulaVersion("QT_SEGMENTO_BT", "bt_radial", {
      version: "3.0.0",
      status: "draft",
      name: "QT BT v3 (draft)",
      description: "Versão experimental com reatância.",
      expression: "QT = φ × P × √(R²+X²) × L / V²",
      constants: { phi: 2, V: 127 },
      standardReference: "Draft interno 2026",
      effectiveDate: "2026-06-01",
    });
    expect(result.version).toBe("3.0.0");
    expect(result.definitionHash).toBeTruthy();

    const def = await getFormulaById("QT_SEGMENTO_BT");
    expect(def!.versions.some((v) => v.version === "3.0.0")).toBe(true);
  });

  it("lança erro ao registrar versão duplicada", async () => {
    await expect(
      registerFormulaVersion("QT_SEGMENTO_BT", "bt_radial", {
        version: "2.0.0",
        status: "active",
        name: "Duplicado",
        description: "Teste",
        expression: "expr",
        constants: {},
        standardReference: "—",
        effectiveDate: "2026-01-01",
      }),
    ).rejects.toThrow(/já existe/);
  });

  it("registrar versão 'active' depreca a versão anteriormente ativa", async () => {
    await registerFormulaVersion("RESISTENCIA_CORRIGIDA", "conductor", {
      version: "2.0.0",
      status: "active",
      name: "Resistência v2",
      description: "Nova versão",
      expression: "R_corr = (R_nom / d) × [1 + α × (T − 20)]",
      constants: { alpha: 0.004 },
      standardReference: "NBR 7285 rev.2",
      effectiveDate: "2026-06-01",
    });

    const history = await getVersionHistory("RESISTENCIA_CORRIGIDA");
    const old = history.find((v) => v.version === "1.0.0");
    expect(old?.status).toBe("deprecated");

    const def = await getFormulaById("RESISTENCIA_CORRIGIDA");
    expect(def!.activeVersion).toBe("2.0.0");
  });

  it("cria nova fórmula quando ID não existe no catálogo", async () => {
    await registerFormulaVersion("FORMULA_NOVA", "standards", {
      version: "1.0.0",
      status: "active",
      name: "Nova Fórmula Teste",
      description: "Fórmula para teste",
      expression: "F = m × a",
      constants: { g: 9.8 },
      standardReference: "ISO 80000-4",
      effectiveDate: "2026-01-01",
    });

    const def = await getFormulaById("FORMULA_NOVA");
    expect(def).not.toBeNull();
    expect(def!.activeVersion).toBe("1.0.0");
  });
});

describe("getDeprecationReport", () => {
  beforeEach(async () => {
    await resetCatalog();
  });

  it("retorna fórmulas com versões depreciadas", async () => {
    const report = await getDeprecationReport();
    expect(report.length).toBeGreaterThan(0);
  });

  it("QT_SEGMENTO_BT versão 1.0.0 aparece no relatório", async () => {
    const report = await getDeprecationReport();
    const entry = report.find(
      (r) => r.formulaId === "QT_SEGMENTO_BT" && r.deprecatedVersion === "1.0.0",
    );
    expect(entry).toBeDefined();
    expect(entry!.replacedBy).toBe("2.0.0");
  });

  it("LIMITE_CQT_ANEEL 1.0.0 aparece com substituto 2.0.0", async () => {
    const report = await getDeprecationReport();
    const entry = report.find(
      (r) =>
        r.formulaId === "LIMITE_CQT_ANEEL" && r.deprecatedVersion === "1.0.0",
    );
    expect(entry).toBeDefined();
    expect(entry!.replacedBy).toBe("2.0.0");
  });
});
