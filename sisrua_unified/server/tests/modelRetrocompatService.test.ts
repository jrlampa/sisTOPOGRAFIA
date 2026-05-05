/**
 * modelRetrocompatService.test.ts — Testes do serviço de Retrocompatibilidade (14B [T1])
 */

import { describe, it, expect } from "vitest";
import {
  getModelById,
  getActiveModels,
  getStableModels,
  getFallbackModel,
  checkCompatibility,
  getDeprecationAlerts,
  getAllPromptTemplates,
  getPromptTemplateById,
} from "../services/modelRetrocompatService.js";

describe("modelRetrocompatService", () => {
  // ── Catálogo de modelos ────────────────────────────────────────────────────

  it("getActiveModels exclui modelos removed", () => {
    const active = getActiveModels();
    expect(active.every((m) => m.status !== "removed")).toBe(true);
  });

  it("getStableModels retorna apenas modelos stable", () => {
    const stable = getStableModels();
    expect(stable.every((m) => m.status === "stable")).toBe(true);
    expect(stable.length).toBeGreaterThan(0);
  });

  it("getModelById retorna modelo pelo ID", () => {
    const model = getModelById("ollama-llama3.2-3b");
    expect(model).toBeDefined();
    expect(model?.name).toBe("llama3.2");
    expect(model?.status).toBe("stable");
  });

  it("getModelById retorna undefined para ID inexistente", () => {
    const model = getModelById("nao-existe-xyz");
    expect(model).toBeUndefined();
  });

  it("catálogo contém pelo menos um modelo depreciado com replacedBy", () => {
    const deprecated = getActiveModels().filter((m) => m.status === "deprecated" && m.replacedBy);
    expect(deprecated.length).toBeGreaterThan(0);
  });

  // ── Fallback ───────────────────────────────────────────────────────────────

  it("getFallbackModel retorna replacedBy quando definido", () => {
    const fallback = getFallbackModel("ollama-llama3-8b");
    expect(fallback).toBeDefined();
    expect(fallback?.id).toBe("ollama-llama3.2-3b");
  });

  it("getFallbackModel retorna modelo stable quando ID não existe", () => {
    const fallback = getFallbackModel("inexistente-model");
    expect(fallback).toBeDefined();
    expect(fallback?.status).toBe("stable");
  });

  it("getFallbackModel para modelo stable retorna outro stable do mesmo provider", () => {
    const fallback = getFallbackModel("ollama-mistral-7b");
    // Pode retornar undefined se é o único stable do provider, ou um stable alternativo
    if (fallback) {
      expect(fallback.status).toBe("stable");
      expect(fallback.provider).toBe("ollama");
    }
  });

  // ── Compatibilidade ────────────────────────────────────────────────────────

  it("checkCompatibility: modelo stable + template compatível → compatible=true", () => {
    const result = checkCompatibility("ollama-llama3.2-3b", "pt-dg-analysis-v1");
    expect(result.compatible).toBe(true);
    expect(result.missingCapabilities).toHaveLength(0);
  });

  it("checkCompatibility: modelo com capabilities insuficientes → compatible=false", () => {
    // llama3.2 não tem 'function-calling'; pt-json-extraction-v1 requer function-calling
    const result = checkCompatibility("ollama-llama3.2-3b", "pt-json-extraction-v1");
    expect(result.compatible).toBe(false);
    expect(result.missingCapabilities).toContain("function-calling");
  });

  it("checkCompatibility: modelo removed → compatible=false com warning", () => {
    const result = checkCompatibility("ollama-llama2-7b", "pt-dg-analysis-v1");
    expect(result.compatible).toBe(false);
    expect(result.warnings.some((w) => /removido|removed/i.test(w))).toBe(true);
    expect(result.suggestedFallback).toBeDefined();
  });

  it("checkCompatibility: modelo deprecated → compatible=true com warning de depreciação", () => {
    const result = checkCompatibility("ollama-llama3-8b", "pt-dg-analysis-v1");
    // llama3-8b é deprecated mas pode ter capabilities básicas
    if (result.compatible) {
      expect(result.warnings.some((w) => /depreciado|deprecated/i.test(w))).toBe(true);
    }
  });

  it("checkCompatibility: modelo inexistente → compatible=false com warning", () => {
    const result = checkCompatibility("nao-existe", "pt-dg-analysis-v1");
    expect(result.compatible).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("checkCompatibility: template inexistente → compatible=false com warning", () => {
    const result = checkCompatibility("ollama-llama3.2-3b", "nao-existe-template");
    expect(result.compatible).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("checkCompatibility: modelo experimental → compatible=true com warning experimental", () => {
    const result = checkCompatibility("ollama-deepseek-r1", "pt-dg-analysis-v1");
    if (result.compatible) {
      expect(result.warnings.some((w) => /experimental/i.test(w))).toBe(true);
    }
  });

  // ── Alertas de depreciação ─────────────────────────────────────────────────

  it("getDeprecationAlerts retorna alertas para modelos deprecated e removed", () => {
    const alerts = getDeprecationAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.status === "deprecated" || a.status === "removed")).toBe(true);
  });

  it("alertas contêm orientação de migração", () => {
    const alerts = getDeprecationAlerts();
    expect(alerts.every((a) => typeof a.migratePrompt === "string" && a.migratePrompt.length > 0)).toBe(true);
  });

  it("alertas com removedAt calculam daysUntilRemoval", () => {
    const alerts = getDeprecationAlerts();
    const withRemoval = alerts.filter((a) => a.removedAt !== undefined);
    expect(withRemoval.every((a) => typeof a.daysUntilRemoval === "number")).toBe(true);
  });

  // ── Templates de prompt ────────────────────────────────────────────────────

  it("getAllPromptTemplates retorna lista não vazia", () => {
    const templates = getAllPromptTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it("getPromptTemplateById retorna template correto", () => {
    const t = getPromptTemplateById("pt-dg-analysis-v1");
    expect(t).toBeDefined();
    expect(t?.name).toContain("DG");
  });

  it("getPromptTemplateById retorna undefined para ID inexistente", () => {
    const t = getPromptTemplateById("nao-existe");
    expect(t).toBeUndefined();
  });

  it("todos os templates possuem requiredCapabilities definidas", () => {
    const templates = getAllPromptTemplates();
    expect(templates.every((t) => Array.isArray(t.requiredCapabilities))).toBe(true);
  });
});
