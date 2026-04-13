/**
 * Scenario Analysis & Ranking Service
 *
 * Heuristic optimization for CQT scenarios (ATUAL, PROJ1, PROJ2)
 * Based on: C:\myworld\EXCEL\logica_cqt.md (SUGESTAO_CORTES section)
 *
 * Scoring model:
 *   - Base Load (40%): Prefer balanced load distribution
 *   - Voltage Drop CQT (35%): Lower drop is better
 *   - Balancing (20%): Penalize unbalanced phases
 *   - Bonus: Transformer utilization ≥ 70% and ≤ 85%
 */

export interface CqtScenarioResult {
  scenarioId: string;
  lado: "ESQUERDO" | "DIREITO" | "TRAFO";
  cargaTotalKva: number;
  cargaPercent: number; // vs. transformer capacity
  cqtPercent: number; // Voltage drop (%)
  balanceamentoScore: number; // 0-1 (1 = perfect balance, 0 = worst)
}

export interface ScenarioScoreInput {
  cenarioId: string;
  trafoKva: number;
  resultadosEsq: CqtScenarioResult;
  resultadosDir: CqtScenarioResult;
  resultadoTrafo: CqtScenarioResult;
}

export interface ScenarioScore {
  cenarioId: string;
  scoreGlobal: number; // 0-100
  componentes: {
    cargaTotalScore: number; // 40% weight
    cqtScore: number; // 35% weight
    balanceamentoScore: number; // 20% weight
    bonusUtilizacao: number; // +5% potential bonus
  };
  analiseDetalhada: {
    cargaTotalKva: number;
    utilizacaoPercent: number;
    cqtMaximoPercent: number;
    balanceamentoPercent: number;
    recomendacao: string;
  };
}

/**
 * Score base load (40% weight)
 * Prefer configurations close to optimal transformer utilization (70-85%)
 */
function scoreLoadBalance(cargaTotalKva: number, trafoKva: number): number {
  const utilizacao = cargaTotalKva / trafoKva;

  // Ideal range: 70-85%
  const ideal_min = 0.7;
  const ideal_max = 0.85;

  if (utilizacao >= ideal_min && utilizacao <= ideal_max) {
    return 100; // Perfect utilization
  }

  if (utilizacao < ideal_min) {
    // Underutilized: penalty grows
    const penalty = ((ideal_min - utilizacao) / ideal_min) * 100;
    return Math.max(0, 100 - penalty * 0.8);
  }

  // Overutilized: severe penalty
  const penalty = ((utilizacao - ideal_max) / (1 - ideal_max)) * 100;
  return Math.max(0, 100 - penalty * 1.2);
}

/**
 * Score voltage drop (35% weight)
 * Lower CQT is better; ANEEL limit is 8% for BT
 */
function scoreCqt(cqtPercent: number): number {
  const LIMITE_ANEEL = 8;
  const ALERTA_THRESHOLD = 5; // Above 5% starts reducing score

  if (cqtPercent <= ALERTA_THRESHOLD) {
    return 100;
  }

  if (cqtPercent <= LIMITE_ANEEL) {
    // Linear penalty between threshold and limit
    const penalty =
      ((cqtPercent - ALERTA_THRESHOLD) / (LIMITE_ANEEL - ALERTA_THRESHOLD)) *
      50;
    return 100 - penalty;
  }

  // Exceeds limit: heavy penalty
  const exceedPercent = ((cqtPercent - LIMITE_ANEEL) / LIMITE_ANEEL) * 100;
  return Math.max(0, 50 - exceedPercent * 5);
}

/**
 * Score phase balancing (20% weight)
 * ESQ and DIR should have similar loads
 */
function scoreBalancing(cargaEsqKva: number, cargaDirKva: number): number {
  const totalKva = cargaEsqKva + cargaDirKva;
  if (totalKva === 0) return 0;

  const razao =
    Math.min(cargaEsqKva, cargaDirKva) / Math.max(cargaEsqKva, cargaDirKva);
  // razao: 1.0 = perfect balance, 0.0 = total imbalance
  return razao * 100;
}

/**
 * Calculate scenario score combining all factors
 */
export function calculateScenarioScore(
  input: ScenarioScoreInput,
): ScenarioScore {
  const totalCargaKva =
    input.resultadosEsq.cargaTotalKva + input.resultadosDir.cargaTotalKva;
  const utilizacaoPercent = (totalCargaKva / input.trafoKva) * 100;

  // Sub-scores
  const cargaTotalScore = scoreLoadBalance(totalCargaKva, input.trafoKva);
  const cqtMaximo = Math.max(
    input.resultadosEsq.cqtPercent,
    input.resultadosDir.cqtPercent,
  );
  const cqtScore = scoreCqt(cqtMaximo);
  const balanceamentoScore = scoreBalancing(
    input.resultadosEsq.cargaTotalKva,
    input.resultadosDir.cargaTotalKva,
  );

  // Bonus: if utilization is in ideal range AND CQT is low
  let bonusUtilizacao = 0;
  if (utilizacaoPercent >= 70 && utilizacaoPercent <= 85 && cqtMaximo <= 5) {
    bonusUtilizacao = 5;
  }

  // Weighted global score
  const scoreGlobal =
    (cargaTotalScore * 0.4 +
      cqtScore * 0.35 +
      balanceamentoScore * 0.2 +
      bonusUtilizacao) *
    (100 / 105);

  const recomendacao = gerarRecomendacao(
    utilizacaoPercent,
    cqtMaximo,
    cargaTotalScore,
    cqtScore,
    balanceamentoScore,
  );

  return {
    cenarioId: input.cenarioId,
    scoreGlobal: Math.round(scoreGlobal * 100) / 100,
    componentes: {
      cargaTotalScore: Math.round(cargaTotalScore * 100) / 100,
      cqtScore: Math.round(cqtScore * 100) / 100,
      balanceamentoScore: Math.round(balanceamentoScore * 100) / 100,
      bonusUtilizacao,
    },
    analiseDetalhada: {
      cargaTotalKva: totalCargaKva,
      utilizacaoPercent: Math.round(utilizacaoPercent * 100) / 100,
      cqtMaximoPercent: Math.round(cqtMaximo * 100) / 100,
      balanceamentoPercent: Math.round(balanceamentoScore * 100) / 100,
      recomendacao,
    },
  };
}

/**
 * Generate descriptive recommendation
 */
function gerarRecomendacao(
  utilizacaoPercent: number,
  cqtMaximo: number,
  cargaScore: number,
  cqtScore: number,
  balancScore: number,
): string {
  const issues: string[] = [];

  if (utilizacaoPercent < 70) {
    issues.push("Transformador subutilizado (<70%)");
  } else if (utilizacaoPercent > 85) {
    issues.push("Transformador sobrecarregado (>85%)");
  }

  if (cqtMaximo > 8) {
    issues.push("CQT acima do limite ANEEL (>8%)");
  } else if (cqtMaximo > 5) {
    issues.push("CQT elevado (recomenda-se <5%)");
  }

  if (balancScore < 70) {
    issues.push("Desbalanceamento entre lados (rebalancear cargas)");
  }

  if (issues.length === 0) {
    return "Cenário adequado. Todos os parâmetros dentro das recomendações.";
  }

  return `Atenção: ${issues.join("; ")}.`;
}

/**
 * Rank multiple scenarios
 */
export function rankScenarios(
  scenarios: ScenarioScoreInput[],
): ScenarioScore[] {
  const scores = scenarios.map(calculateScenarioScore);
  return scores.sort((a, b) => b.scoreGlobal - a.scoreGlobal);
}

/**
 * Compare two scenarios (baseline vs alternative)
 */
export interface ScenarioDelta {
  cenarioBase: string;
  cenarioAlternativo: string;
  deltaCargaPercent: number; // Change in total load (%)
  deltaCqtPercent: number; // Change in max CQT (%)
  deltaBalanceamento: number; // Change in balance score (-1 to +1)
  deltaScoredGlobal: number; // Change in global score
  recomendacao: string;
}

export function compararCenarios(
  scoreBase: ScenarioScore,
  scoreAlternativo: ScenarioScore,
): ScenarioDelta {
  const deltaCargaPercent =
    scoreAlternativo.analiseDetalhada.utilizacaoPercent -
    scoreBase.analiseDetalhada.utilizacaoPercent;

  const deltaCqtPercent =
    scoreAlternativo.analiseDetalhada.cqtMaximoPercent -
    scoreBase.analiseDetalhada.cqtMaximoPercent;

  const deltaBalanceamento =
    (scoreAlternativo.componentes.balanceamentoScore -
      scoreBase.componentes.balanceamentoScore) /
    100;

  const deltaScoredGlobal =
    scoreAlternativo.scoreGlobal - scoreBase.scoreGlobal;

  const recomendacao =
    deltaScoredGlobal > 2
      ? "Cenário alternativo é significativamente melhor"
      : deltaScoredGlobal > 0
        ? "Cenário alternativo é ligeiramente melhor"
        : deltaScoredGlobal < -2
          ? "Cenário base é significativamente melhor"
          : "Desempenho similar, avaliar outras critérios operacionais";

  return {
    cenarioBase: scoreBase.cenarioId,
    cenarioAlternativo: scoreAlternativo.cenarioId,
    deltaCargaPercent,
    deltaCqtPercent,
    deltaBalanceamento,
    deltaScoredGlobal,
    recomendacao,
  };
}
