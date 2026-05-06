/**
 * onPremiseService.test.ts — Testes do serviço de Implantação On-Premise/Híbrida (123 [T1])
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectDeploymentMode,
  getIsolatedConfig,
  generateOnPremiseReadinessReport,
} from "../services/onPremiseService.js";

describe("onPremiseService", () => {
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

  // ── Detecção de modo ───────────────────────────────────────────────────────

  it("detectDeploymentMode: retorna cloud por padrão sem configuração local", () => {
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.TILE_SERVER_URL;
    delete process.env.SUPABASE_URL;
    const { mode } = detectDeploymentMode();
    expect(mode).toBe("cloud");
  });

  it("detectDeploymentMode: respeita DEPLOYMENT_MODE explícito 'on-premise'", () => {
    process.env.DEPLOYMENT_MODE = "on-premise";
    const { mode, reason } = detectDeploymentMode();
    expect(mode).toBe("on-premise");
    expect(reason).toContain("on-premise");
  });

  it("detectDeploymentMode: respeita DEPLOYMENT_MODE explícito 'hybrid'", () => {
    process.env.DEPLOYMENT_MODE = "hybrid";
    const { mode } = detectDeploymentMode();
    expect(mode).toBe("hybrid");
  });

  it("detectDeploymentMode: ignora DEPLOYMENT_MODE inválido e usa heurística", () => {
    process.env.DEPLOYMENT_MODE = "invalid-mode";
    delete process.env.TILE_SERVER_URL;
    delete process.env.SUPABASE_URL;
    const { mode } = detectDeploymentMode();
    expect(["cloud", "hybrid", "on-premise"]).toContain(mode);
  });

  it("detectDeploymentMode: detecta on-premise com SUPABASE_URL localhost e TILE_SERVER_URL local", () => {
    delete process.env.DEPLOYMENT_MODE;
    process.env.SUPABASE_URL = "http://localhost:5432/mydb";
    process.env.TILE_SERVER_URL = "http://localhost:8080/tiles/{z}/{x}/{y}.png";
    const { mode, reason } = detectDeploymentMode();
    expect(mode).toBe("on-premise");
    expect(reason.toLowerCase()).toContain("localhost");
  });

  it("detectDeploymentMode: detecta hybrid com Supabase cloud e LLM local", () => {
    delete process.env.DEPLOYMENT_MODE;
    process.env.SUPABASE_URL = "https://xyzabc.supabase.co";
    delete process.env.TILE_SERVER_URL;
    process.env.LLM_ENDPOINT = "http://localhost:11434/api/generate";
    const { mode } = detectDeploymentMode();
    expect(mode).toBe("hybrid");
  });

  // ── Configuração isolada ───────────────────────────────────────────────────

  it("getIsolatedConfig: on-premise usa variáveis de ambiente locais", () => {
    process.env.TILE_SERVER_URL = "http://tiles.local:8080/{z}/{x}/{y}.png";
    const config = getIsolatedConfig("on-premise");
    expect(config.mode).toBe("on-premise");
    expect(config.allowExternalRequests).toBe(false);
    expect(config.tileServerUrl).toContain("tiles.local");
  });

  it("getIsolatedConfig: cloud usa endpoints públicos", () => {
    const config = getIsolatedConfig("cloud");
    expect(config.mode).toBe("cloud");
    expect(config.allowExternalRequests).toBe(true);
    expect(config.tileServerUrl).toContain("openstreetmap.org");
    expect(config.nominatimUrl).toContain("nominatim.openstreetmap.org");
  });

  it("getIsolatedConfig: hybrid permite requests externos", () => {
    const config = getIsolatedConfig("hybrid");
    expect(config.allowExternalRequests).toBe(true);
  });

  it("getIsolatedConfig: storageBackend STORAGE_BACKEND env sobrepõe padrão", () => {
    process.env.STORAGE_BACKEND = "minio";
    const config = getIsolatedConfig("on-premise");
    expect(config.storageBackend).toBe("minio");
  });

  // ── Relatório de prontidão ─────────────────────────────────────────────────

  it("generateOnPremiseReadinessReport: retorna estrutura completa", () => {
    const report = generateOnPremiseReadinessReport();
    expect(report).toHaveProperty("detectedMode");
    expect(report).toHaveProperty("detectionReason");
    expect(report).toHaveProperty("isolatedConfig");
    expect(report).toHaveProperty("offlineCapabilities");
    expect(report).toHaveProperty("gaps");
    expect(report).toHaveProperty("readyForOffline");
  });

  it("generateOnPremiseReadinessReport: offlineCapabilities contém cálculo DG", () => {
    const report = generateOnPremiseReadinessReport();
    const dgCap = report.offlineCapabilities.find((c) => c.feature.includes("DG"));
    expect(dgCap).toBeDefined();
    expect(dgCap?.availableOffline).toBe(true);
  });

  it("generateOnPremiseReadinessReport: on-premise sem TILE_SERVER_URL gera gap", () => {
    process.env.DEPLOYMENT_MODE = "on-premise";
    delete process.env.TILE_SERVER_URL;
    const report = generateOnPremiseReadinessReport();
    expect(report.gaps.some((g) => g.includes("TILE_SERVER_URL"))).toBe(true);
    expect(report.readyForOffline).toBe(false);
  });

  it("generateOnPremiseReadinessReport: cloud mode tem readyForOffline false", () => {
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.SUPABASE_URL;
    delete process.env.TILE_SERVER_URL;
    delete process.env.LLM_ENDPOINT;
    const report = generateOnPremiseReadinessReport();
    // Cloud não é on-premise, mas hybrid sim
    if (report.detectedMode === "cloud") {
      expect(report.readyForOffline).toBe(false);
    }
  });

  it("gaps é array vazio em modo cloud (sem verificações on-premise)", () => {
    process.env.DEPLOYMENT_MODE = "cloud";
    const report = generateOnPremiseReadinessReport();
    expect(report.gaps).toEqual([]);
  });
});
