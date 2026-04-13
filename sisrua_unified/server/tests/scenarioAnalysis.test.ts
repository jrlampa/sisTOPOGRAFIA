/**
 * Scenario Analysis Tests — Ranking & Comparison Parity
 *
 * Based on: C:\myworld\EXCEL\logica_cqt.md (SUGESTAO_CORTES heuristics)
 */

// describe, it, expect are provided by Jest
import {
  calculateScenarioScore,
  rankScenarios,
  compararCenarios,
  ScenarioScoreInput,
  CqtScenarioResult,
} from "../services/scenarioAnalysisService";

describe("Scenario Analysis – CQT Ranking", () => {
  // Helper to create realistic CQT scenario results
  const makeScenarioResult = (
    lado: "ESQUERDO" | "DIREITO" | "TRAFO",
    cargaKva: number,
    cqtPercent: number,
  ): CqtScenarioResult => ({
    scenarioId: "test",
    lado,
    cargaTotalKva: cargaKva,
    cargaPercent: 0,
    cqtPercent,
    balanceamentoScore: 0.9,
  });

  // ─── Base test case (ATUAL scenario) ─────────────────────────────────────
  it("scores a balanced scenario (ATUAL)", () => {
    const input: ScenarioScoreInput = {
      cenarioId: "ATUAL",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 95, 3.5),
      resultadosDir: makeScenarioResult("DIREITO", 92, 3.2),
      resultadoTrafo: makeScenarioResult("TRAFO", 187, 0),
    };

    const score = calculateScenarioScore(input);

    // Total load: 187 kVA
    // Utilization: 187/225 ≈ 83% (within ideal 70-85%)
    // Max CQT: 3.5% (below 5% threshold)
    // Balance: Good

    expect(score.scoreGlobal).toBeGreaterThan(80);
    expect(score.analiseDetalhada.utilizacaoPercent).toBeCloseTo(83, 0);
    expect(score.analiseDetalhada.cqtMaximoPercent).toBe(3.5);
  });

  it("penalizes underutilization", () => {
    const input: ScenarioScoreInput = {
      cenarioId: "LOW_USAGE",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 50, 1.5),
      resultadosDir: makeScenarioResult("DIREITO", 48, 1.2),
      resultadoTrafo: makeScenarioResult("TRAFO", 98, 0),
    };

    const score = calculateScenarioScore(input);

    // Total: 98 kVA, Utilization: 43.5% (below 70% threshold)
    expect(score.analiseDetalhada.utilizacaoPercent).toBeCloseTo(43.5, 0);
    expect(score.scoreGlobal).toBeLessThan(80);
    expect(score.analiseDetalhada.recomendacao).toContain("subutilizado");
  });

  it("penalizes high CQT", () => {
    const input: ScenarioScoreInput = {
      cenarioId: "HIGH_CQT",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 120, 6.8),
      resultadosDir: makeScenarioResult("DIREITO", 85, 4.2),
      resultadoTrafo: makeScenarioResult("TRAFO", 205, 0),
    };

    const score = calculateScenarioScore(input);

    // Max CQT: 6.8% (above 5% but below 8%)
    expect(score.analiseDetalhada.cqtMaximoPercent).toBe(6.8);
    expect(score.componentes.cqtScore).toBeLessThan(100);
    expect(score.analiseDetalhada.recomendacao).toContain("elevado");
  });

  it("heavily penalizes CQT above ANEEL limit (8%)", () => {
    const input: ScenarioScoreInput = {
      cenarioId: "EXCEEDS_LIMIT",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 150, 9.2), // > 8%
      resultadosDir: makeScenarioResult("DIREITO", 75, 2.1),
      resultadoTrafo: makeScenarioResult("TRAFO", 225, 0),
    };

    const score = calculateScenarioScore(input);

    expect(score.analiseDetalhada.cqtMaximoPercent).toBe(9.2);
    expect(score.componentes.cqtScore).toBeLessThan(50);
    expect(score.analiseDetalhada.recomendacao).toContain(
      "acima do limite ANEEL",
    );
  });

  it("scores imbalanced load distribution", () => {
    const input: ScenarioScoreInput = {
      cenarioId: "IMBALANCED",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 140, 5.0),
      resultadosDir: makeScenarioResult("DIREITO", 40, 1.5),
      resultadoTrafo: makeScenarioResult("TRAFO", 180, 0),
    };

    const score = calculateScenarioScore(input);

    // 140/(140+40) = 77.8% on ESQ vs 22.2% on DIR
    // ratio = min/max = 40/140 = 0.286, which is < 0.7 threshold
    expect(score.componentes.balanceamentoScore).toBeLessThan(30); // ≈28.57
    // Should be flagged with desbalanceamento recommendation
    expect(score.analiseDetalhada.recomendacao).toContain("Desbalanceamento");
  });

  it("gives bonus for ideal utilization + low CQT", () => {
    const input: ScenarioScoreInput = {
      cenarioId: "OPTIMAL",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 102, 3.0),
      resultadosDir: makeScenarioResult("DIREITO", 78, 3.5),
      resultadoTrafo: makeScenarioResult("TRAFO", 180, 0),
    };

    const score = calculateScenarioScore(input);

    // Utilization: 80% (ideal range)
    // CQT: 3.5% (low)
    // Should include bonus
    expect(score.componentes.bonusUtilizacao).toBe(5);
    expect(score.scoreGlobal).toBeGreaterThan(85);
  });

  it("ranks scenarios from best to worst", () => {
    const atual: ScenarioScoreInput = {
      cenarioId: "ATUAL",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 95, 3.5),
      resultadosDir: makeScenarioResult("DIREITO", 92, 3.2),
      resultadoTrafo: makeScenarioResult("TRAFO", 187, 0),
    };

    const proj1: ScenarioScoreInput = {
      cenarioId: "PROJ1",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 85, 2.8),
      resultadosDir: makeScenarioResult("DIREITO", 95, 3.4),
      resultadoTrafo: makeScenarioResult("TRAFO", 180, 0),
    };

    const proj2: ScenarioScoreInput = {
      cenarioId: "PROJ2",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 150, 6.5),
      resultadosDir: makeScenarioResult("DIREITO", 40, 1.0),
      resultadoTrafo: makeScenarioResult("TRAFO", 190, 0),
    };

    const ranking = rankScenarios([atual, proj1, proj2]);

    expect(ranking.length).toBe(3);
    // current ranking prefers high utilization of ATUAL over PROJ1
    expect(ranking[0].cenarioId).toBe("ATUAL"); 
    expect(ranking[2].cenarioId).toBe("PROJ2");
  });

  it("compares two scenarios (baseline vs alternative)", () => {
    const scoreAtual = calculateScenarioScore({
      cenarioId: "ATUAL",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 100, 4.0),
      resultadosDir: makeScenarioResult("DIREITO", 85, 3.5),
      resultadoTrafo: makeScenarioResult("TRAFO", 185, 0),
    });

    const scoreProj1 = calculateScenarioScore({
      cenarioId: "PROJ1",
      trafoKva: 225,
      resultadosEsq: makeScenarioResult("ESQUERDO", 95, 3.2),
      resultadosDir: makeScenarioResult("DIREITO", 90, 3.8),
      resultadoTrafo: makeScenarioResult("TRAFO", 185, 0),
    });

    const delta = compararCenarios(scoreAtual, scoreProj1);

    expect(delta.cenarioBase).toBe("ATUAL");
    expect(delta.cenarioAlternativo).toBe("PROJ1");
    expect(delta.deltaScoredGlobal).toBeDefined();
    expect(delta.recomendacao).toBeDefined();
  });
});
