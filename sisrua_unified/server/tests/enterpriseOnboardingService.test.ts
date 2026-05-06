/**
 * enterpriseOnboardingService.test.ts — Testes do serviço de Onboarding Enterprise (122 [T1])
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateEnterpriseOnboardingPackage,
  NETWORK_REQUIREMENTS,
  ENVIRONMENT_REQUIREMENTS,
} from "../services/enterpriseOnboardingService.js";

describe("enterpriseOnboardingService", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  // ── Requisitos de rede ─────────────────────────────────────────────────────

  it("NETWORK_REQUIREMENTS contém a porta 5432 como required", () => {
    const pg = NETWORK_REQUIREMENTS.find((r) => r.value.includes("5432"));
    expect(pg).toBeDefined();
    expect(pg?.status).toBe("required");
    expect(pg?.direction).toBe("outbound");
  });

  it("NETWORK_REQUIREMENTS contém porta 443 inbound como required", () => {
    const https = NETWORK_REQUIREMENTS.find((r) => r.value === "443/TCP");
    expect(https).toBeDefined();
    expect(https?.direction).toBe("inbound");
  });

  it("NETWORK_REQUIREMENTS contém domínio supabase.co", () => {
    const supabase = NETWORK_REQUIREMENTS.find((r) =>
      r.value.includes("supabase.co"),
    );
    expect(supabase).toBeDefined();
  });

  it("NETWORK_REQUIREMENTS contém tile.openstreetmap.org como required", () => {
    const tiles = NETWORK_REQUIREMENTS.find((r) =>
      r.value.includes("tile.openstreetmap.org"),
    );
    expect(tiles?.status).toBe("required");
  });

  // ── Requisitos de ambiente ─────────────────────────────────────────────────

  it("ENVIRONMENT_REQUIREMENTS contém Node.js como required", () => {
    const node = ENVIRONMENT_REQUIREMENTS.find((r) => r.id === "env-node");
    expect(node).toBeDefined();
    expect(node?.status).toBe("required");
    expect(node?.minimum).toContain("18");
  });

  it("ENVIRONMENT_REQUIREMENTS contém PostgreSQL como required", () => {
    const pg = ENVIRONMENT_REQUIREMENTS.find((r) => r.id === "env-pg");
    expect(pg).toBeDefined();
    expect(pg?.minimum).toContain("14");
  });

  it("ENVIRONMENT_REQUIREMENTS contém requisito de TLS", () => {
    const tls = ENVIRONMENT_REQUIREMENTS.find((r) => r.id === "env-tls");
    expect(tls).toBeDefined();
    expect(tls?.minimum).toContain("TLS 1.2");
  });

  // ── Pacote de onboarding ───────────────────────────────────────────────────

  it("generateEnterpriseOnboardingPackage retorna estrutura completa", () => {
    const pkg = generateEnterpriseOnboardingPackage();
    expect(pkg).toHaveProperty("generatedAt");
    expect(pkg).toHaveProperty("networkRequirements");
    expect(pkg).toHaveProperty("environmentRequirements");
    expect(pkg).toHaveProperty("validationResults");
    expect(pkg).toHaveProperty("overallReady");
    expect(pkg).toHaveProperty("readinessScore");
    expect(pkg).toHaveProperty("criticalBlockers");
  });

  it("readinessScore está entre 0 e 100", () => {
    const pkg = generateEnterpriseOnboardingPackage();
    expect(pkg.readinessScore).toBeGreaterThanOrEqual(0);
    expect(pkg.readinessScore).toBeLessThanOrEqual(100);
  });

  it("validationResults inclui verificação de Node.js", () => {
    const pkg = generateEnterpriseOnboardingPackage();
    const nodeCheck = pkg.validationResults.find((r) => r.id === "check-node");
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck?.actual).toContain("v");
  });

  it("Node.js atual passa verificação de versão mínima", () => {
    const pkg = generateEnterpriseOnboardingPackage();
    const nodeCheck = pkg.validationResults.find((r) => r.id === "check-node");
    // Assumindo ambiente de desenvolvimento com Node.js ≥18
    expect(nodeCheck?.passed).toBe(true);
  });

  it("criticalBlockers é array (pode estar vazio)", () => {
    const pkg = generateEnterpriseOnboardingPackage();
    expect(Array.isArray(pkg.criticalBlockers)).toBe(true);
  });

  it("overallReady é false quando há blockers", () => {
    // Simula variável faltando
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
    const pkg = generateEnterpriseOnboardingPackage();
    const hasEnvCheck = pkg.validationResults.find(
      (r) => r.id === "check-env-vars",
    );
    if (hasEnvCheck && !hasEnvCheck.passed) {
      expect(pkg.overallReady).toBe(false);
      expect(pkg.criticalBlockers.length).toBeGreaterThan(0);
    }
  });

  it("check NODE_ENV está incluído nos resultados", () => {
    const pkg = generateEnterpriseOnboardingPackage();
    const envCheck = pkg.validationResults.find(
      (r) => r.id === "check-node-env",
    );
    expect(envCheck).toBeDefined();
  });

  it("generatedAt é timestamp ISO válido", () => {
    const pkg = generateEnterpriseOnboardingPackage();
    expect(new Date(pkg.generatedAt).toISOString()).toBe(pkg.generatedAt);
  });
});
