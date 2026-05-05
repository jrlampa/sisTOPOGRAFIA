/**
 * gridLegibilityService.test.ts — Testes do serviço de Legibilidade de Grid (27 [T1])
 */

import { describe, it, expect } from "vitest";
import {
  getAllProfiles,
  getProfileById,
  getDefaultProfile,
  calculateLegibilityMetrics,
  suggestProfile,
  type DensityProfile,
} from "../services/gridLegibilityService.js";

describe("gridLegibilityService", () => {
  // ── Catálogo de perfis ─────────────────────────────────────────────────────

  it("getAllProfiles retorna lista não vazia", () => {
    const profiles = getAllProfiles();
    expect(profiles.length).toBeGreaterThan(0);
  });

  it("catálogo contém perfis: compact, comfortable, spacious, industrial", () => {
    const profiles = getAllProfiles();
    const ids = profiles.map((p) => p.id);
    expect(ids).toContain("compact");
    expect(ids).toContain("comfortable");
    expect(ids).toContain("spacious");
    expect(ids).toContain("industrial");
  });

  it("getProfileById retorna perfil correto", () => {
    const profile = getProfileById("industrial");
    expect(profile).toBeDefined();
    expect(profile?.colorScheme).toBe("industrial-dark");
  });

  it("getProfileById retorna undefined para ID inexistente", () => {
    expect(getProfileById("nao-existe")).toBeUndefined();
  });

  it("getDefaultProfile retorna perfil 'comfortable'", () => {
    const profile = getDefaultProfile();
    expect(profile.id).toBe("comfortable");
  });

  it("todos os perfis possuem rowHeightPx e fontSizePx positivos", () => {
    const profiles = getAllProfiles();
    expect(profiles.every((p) => p.rowHeightPx > 0 && p.fontSizePx > 0)).toBe(true);
  });

  // ── Métricas de legibilidade ───────────────────────────────────────────────

  it("calculateLegibilityMetrics retorna estrutura completa", () => {
    const metrics = calculateLegibilityMetrics("comfortable", 100);
    expect(metrics).toHaveProperty("profile");
    expect(metrics).toHaveProperty("rowsVisible");
    expect(metrics).toHaveProperty("estimatedReadingTimeMs");
    expect(metrics).toHaveProperty("accessibilityScore");
    expect(metrics).toHaveProperty("recommendations");
  });

  it("rowsVisible é positivo e não excede maxVisibleRows do perfil", () => {
    const profile = getProfileById("compact")!;
    const metrics = calculateLegibilityMetrics("compact", 500, 1080);
    expect(metrics.rowsVisible).toBeGreaterThan(0);
    expect(metrics.rowsVisible).toBeLessThanOrEqual(profile.maxVisibleRows);
  });

  it("accessibilityScore está entre 0 e 100", () => {
    for (const profile of getAllProfiles()) {
      const metrics = calculateLegibilityMetrics(profile.id, 50);
      expect(metrics.accessibilityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.accessibilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("estimatedReadingTimeMs é pelo menos 100ms", () => {
    const metrics = calculateLegibilityMetrics("compact", 10);
    expect(metrics.estimatedReadingTimeMs).toBeGreaterThanOrEqual(100);
  });

  it("totalRows acima do virtualScrollThreshold gera recomendação de virtual scroll", () => {
    const profile = getProfileById("comfortable")!;
    const metrics = calculateLegibilityMetrics("comfortable", profile.virtualScrollThreshold + 1);
    expect(metrics.recommendations.some((r) => /virtual.?scroll/i.test(r))).toBe(true);
  });

  it("perfil 'spacious' com muitos dados sugere perfil mais denso", () => {
    const profile = getProfileById("spacious")!;
    const metrics = calculateLegibilityMetrics("spacious", profile.maxVisibleRows * 10);
    expect(metrics.recommendations.some((r) => /compact|industrial/i.test(r))).toBe(true);
  });

  it("perfil inexistente usa perfil padrão (comfortable)", () => {
    const metrics = calculateLegibilityMetrics("nao-existe", 50);
    expect(metrics.profile).toBe("comfortable");
  });

  it("screenHeightPx afeta rowsVisible", () => {
    const metricsSmall = calculateLegibilityMetrics("comfortable", 100, 600);
    const metricsLarge = calculateLegibilityMetrics("comfortable", 100, 1440);
    expect(metricsLarge.rowsVisible).toBeGreaterThanOrEqual(metricsSmall.rowsVisible);
  });

  // ── Sugestão de perfil ─────────────────────────────────────────────────────

  it("suggestProfile: contexto 'presentation' → spacious", () => {
    const profile = suggestProfile(100, "presentation");
    expect(profile.id).toBe("spacious");
  });

  it("suggestProfile: contexto 'noc' → industrial", () => {
    const profile = suggestProfile(100, "noc");
    expect(profile.id).toBe("industrial");
  });

  it("suggestProfile: contexto 'field' → industrial", () => {
    const profile = suggestProfile(50, "field");
    expect(profile.id).toBe("industrial");
  });

  it("suggestProfile: contexto 'office' com muitos dados → compact", () => {
    const profile = suggestProfile(1500, "office");
    expect(profile.id).toBe("compact");
  });

  it("suggestProfile: contexto 'office' com volume médio → comfortable", () => {
    const profile = suggestProfile(300, "office");
    expect(profile.id).toBe("comfortable");
  });

  it("suggestProfile: contexto 'office' com poucos dados → comfortable (padrão)", () => {
    const profile = suggestProfile(50, "office");
    expect(profile.id).toBe("comfortable");
  });
});
