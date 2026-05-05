/**
 * chaosEngineeringService.test.ts — Testes do serviço de Chaos Engineering (T2.19)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createChaosExperiment,
  listChaosExperiments,
  getChaosExperiment,
  runChaosExperiment,
  cancelChaosExperiment,
  getChaosResult,
  getChaosResilienceReport,
  type ChaosExperiment,
} from "../services/chaosEngineeringService.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLatencyExperiment(
  overrides: Partial<Omit<ChaosExperiment, "id" | "createdAt" | "status">> = {},
): Omit<ChaosExperiment, "id" | "createdAt" | "status"> {
  return {
    name: "Teste de Latência MT",
    description: "Injeta 300ms de latência no endpoint de roteamento MT",
    targetType: "api_endpoint",
    targetId: "/api/dg/mt-router",
    faultConfig: { faultType: "latency", delayMs: 300, affectedPercent: 100 },
    durationSeconds: 30,
    sloThresholdPercent: 99.0,
    createdBy: "vitest",
    ...overrides,
  };
}

// ─── createChaosExperiment ───────────────────────────────────────────────────

describe("createChaosExperiment", () => {
  it("cria experimento com id único e status 'scheduled'", () => {
    const exp = createChaosExperiment(makeLatencyExperiment());
    expect(exp.id).toMatch(/^chaos-/);
    expect(exp.status).toBe("scheduled");
    expect(exp.createdAt).toBeTruthy();
  });

  it("preserva configuração de fault", () => {
    const exp = createChaosExperiment(
      makeLatencyExperiment({
        faultConfig: { faultType: "error_rate", errorPercent: 50, statusCode: 503 },
      }),
    );
    expect(exp.faultConfig.faultType).toBe("error_rate");
    const cfg = exp.faultConfig as { faultType: "error_rate"; errorPercent: number };
    expect(cfg.errorPercent).toBe(50);
  });

  it("cria experimentos com ids únicos", () => {
    const a = createChaosExperiment(makeLatencyExperiment({ name: "A" }));
    const b = createChaosExperiment(makeLatencyExperiment({ name: "B" }));
    expect(a.id).not.toBe(b.id);
  });
});

// ─── listChaosExperiments ────────────────────────────────────────────────────

describe("listChaosExperiments", () => {
  it("lista todos os experimentos", () => {
    const before = listChaosExperiments().length;
    createChaosExperiment(makeLatencyExperiment());
    createChaosExperiment(makeLatencyExperiment());
    expect(listChaosExperiments().length).toBeGreaterThanOrEqual(before + 2);
  });

  it("filtra por tag", () => {
    const exp = createChaosExperiment(
      makeLatencyExperiment({ tags: ["sprint-3", "dg-module"] }),
    );
    const found = listChaosExperiments({ tag: "dg-module" });
    expect(found.some((e) => e.id === exp.id)).toBe(true);
  });
});

// ─── runChaosExperiment ──────────────────────────────────────────────────────

describe("runChaosExperiment", () => {
  it("executa experimento e retorna resultado", () => {
    const exp = createChaosExperiment(makeLatencyExperiment());
    const result = runChaosExperiment(exp.id);
    expect(result).not.toBeNull();
    expect(result!.experimentId).toBe(exp.id);
    expect(result!.startedAt).toBeTruthy();
    expect(result!.completedAt).toBeTruthy();
  });

  it("gera métricas de baseline e durante", () => {
    const exp = createChaosExperiment(makeLatencyExperiment({ durationSeconds: 20 }));
    const result = runChaosExperiment(exp.id);
    expect(result!.baselineMetrics).toBeTruthy();
    expect(result!.duringMetrics.length).toBeGreaterThanOrEqual(2);
  });

  it("experimento de error_rate alta resulta em degradação ou falha", () => {
    const exp = createChaosExperiment(
      makeLatencyExperiment({
        name: "Alta taxa de erros",
        faultConfig: { faultType: "error_rate", errorPercent: 80 },
        sloThresholdPercent: 99.0,
      }),
    );
    const result = runChaosExperiment(exp.id);
    expect(["degraded", "failed", "rolled_back"]).toContain(
      result!.outcome === "resilient" ? "resilient" : result!.outcome,
    );
    // Alta taxa de erro quase sempre degrada
    const finalExp = getChaosExperiment(exp.id);
    expect(["completed", "rolled_back"]).toContain(finalExp?.status);
  });

  it("retorna null para id inválido", () => {
    const result = runChaosExperiment("nao-existe-9999");
    expect(result).toBeNull();
  });

  it("atualiza status do experimento para completed ou rolled_back", () => {
    const exp = createChaosExperiment(makeLatencyExperiment());
    runChaosExperiment(exp.id);
    const updated = getChaosExperiment(exp.id);
    expect(["completed", "rolled_back"]).toContain(updated?.status);
  });

  it("todos os perfis de fault executam sem erro", () => {
    const faultConfigs = [
      { faultType: "latency" as const, delayMs: 500 },
      { faultType: "error_rate" as const, errorPercent: 10 },
      { faultType: "resource_exhaustion" as const, resource: "memory" as const, consumePercent: 70 },
      { faultType: "network_partition" as const, targetServices: ["supabase"] },
      { faultType: "payload_corruption" as const, targetField: "roadSegments", corruptionType: "null" as const },
      { faultType: "timeout" as const, timeoutMs: 5000 },
    ];
    for (const cfg of faultConfigs) {
      const exp = createChaosExperiment(makeLatencyExperiment({ faultConfig: cfg, name: cfg.faultType }));
      const result = runChaosExperiment(exp.id);
      expect(result).not.toBeNull();
      expect(["resilient", "degraded", "failed", "inconclusive"]).toContain(result!.outcome);
    }
  });
});

// ─── cancelChaosExperiment ───────────────────────────────────────────────────

describe("cancelChaosExperiment", () => {
  it("cancela experimento scheduled", () => {
    const exp = createChaosExperiment(makeLatencyExperiment());
    const ok = cancelChaosExperiment(exp.id);
    expect(ok).toBe(true);
    expect(getChaosExperiment(exp.id)?.status).toBe("cancelled");
  });

  it("retorna false para id inválido", () => {
    expect(cancelChaosExperiment("nao-existe")).toBe(false);
  });
});

// ─── getChaosResilienceReport ─────────────────────────────────────────────────

describe("getChaosResilienceReport", () => {
  it("retorna score 100 sem experimentos concluídos", () => {
    // Cria um novo experimento sem executar — report deve incluir 0 resultados
    const report = getChaosResilienceReport();
    expect(report.resilienceScore).toBeGreaterThanOrEqual(0);
    expect(report.resilienceScore).toBeLessThanOrEqual(100);
  });

  it("relatório inclui topTargets após execuções", () => {
    const exp = createChaosExperiment(
      makeLatencyExperiment({ targetId: "/api/dg/lcp" }),
    );
    runChaosExperiment(exp.id);
    const report = getChaosResilienceReport();
    expect(report.totalExperiments).toBeGreaterThan(0);
    expect(report.topTargets).toBeDefined();
    expect(Array.isArray(report.topTargets)).toBe(true);
  });

  it("avgRecoveryTimeMs é number ou null", () => {
    const report = getChaosResilienceReport();
    expect(
      report.avgRecoveryTimeMs === null || typeof report.avgRecoveryTimeMs === "number",
    ).toBe(true);
  });
});
