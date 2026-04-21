/**
 * Design Generativo – Serviço de Orquestração
 *
 * Ponto de entrada único para execuções DG.
 * Responsabilidades:
 *   1. Mesclar parâmetros com defaults.
 *   2. Gerar candidatos.
 *   3. Rodar otimizador.
 *   4. Construir recommendation (melhor + top-3 alternativas).
 *   5. Retornar DgOptimizationOutput reproduzível (hash de entrada).
 *
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – Frente 2
 */

import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
import type {
  DgOptimizationInput,
  DgOptimizationOutput,
  DgRecommendation,
  DgScenario,
  DgConstraintCode,
  DgParams,
} from "./dg/dgTypes.js";
import { DEFAULT_DG_PARAMS } from "./dg/dgTypes.js";
import { generateCandidates, hashDgInput } from "./dg/dgCandidates.js";
import { runDgOptimizer } from "./dg/dgOptimizer.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeParams(partial?: Partial<DgParams>): DgParams {
  return { ...DEFAULT_DG_PARAMS, ...partial };
}

/**
 * Auto-seleciona modo de busca baseado no tamanho da rede:
 *   ≤50 postes → exaustivo; >50 → heurístico.
 */
function autoSearchMode(poles: number, params: DgParams): DgParams {
  if (params.searchMode !== "exhaustive" && params.searchMode !== "heuristic") {
    return params;
  }
  // Se o usuário não forçou modo, escolher automaticamente
  return poles <= 50
    ? { ...params, searchMode: "exhaustive" }
    : { ...params, searchMode: "heuristic" };
}

function buildDiscardSummary(
  scenarios: DgScenario[],
): Record<DgConstraintCode, number> {
  const summary: Partial<Record<DgConstraintCode, number>> = {};
  for (const s of scenarios) {
    if (s.feasible) continue;
    for (const v of s.violations) {
      summary[v.code] = (summary[v.code] ?? 0) + 1;
    }
  }
  return summary as Record<DgConstraintCode, number>;
}

function buildRecommendation(
  allScenarios: DgScenario[],
): DgRecommendation | null {
  const feasible = allScenarios
    .filter((s) => s.feasible)
    .sort((a, b) => b.objectiveScore - a.objectiveScore);

  if (feasible.length === 0) return null;

  const [best, ...rest] = feasible;
  return {
    bestScenario: best,
    alternatives: rest.slice(0, 3),
    discardedCount: allScenarios.length - feasible.length,
    discardReasonSummary: buildDiscardSummary(allScenarios),
  };
}

// ─── Serviço principal ─────────────────────────────────────────────────────────

/**
 * Executa otimização DG end-to-end.
 * Lança erro se a entrada for inválida.
 */
export async function runDgOptimization(
  input: DgOptimizationInput,
): Promise<DgOptimizationOutput> {
  const runId = input.runId ?? randomUUID();
  const params = autoSearchMode(input.poles.length, mergeParams(input.params));
  const inputHash = hashDgInput(input.poles, params);

  logger.info("DG: iniciando otimização", {
    runId,
    inputHash,
    poles: input.poles.length,
    searchMode: params.searchMode,
    allowNewPoles: params.allowNewPoles,
  });

  if (input.poles.length === 0) {
    throw new Error("DG: ao menos um poste deve ser fornecido.");
  }
  if (!input.transformer || input.transformer.kva <= 0) {
    throw new Error("DG: transformador inválido (kva deve ser > 0).");
  }

  // 1. Gerar candidatos
  const candidates = generateCandidates(input.poles, params);
  logger.info("DG: candidatos gerados", { runId, count: candidates.length });

  // 2. Rodar otimizador
  const { allScenarios, totalCandidatesEvaluated } = runDgOptimizer(
    candidates,
    input.poles,
    input.transformer,
    input.exclusionPolygons ?? [],
    input.roadCorridors ?? [],
    params,
  );

  const totalFeasible = allScenarios.filter((s) => s.feasible).length;

  logger.info("DG: otimização concluída", {
    runId,
    totalCandidatesEvaluated,
    totalFeasible,
    totalScenarios: allScenarios.length,
  });

  // 3. Montar recomendação
  const recommendation = buildRecommendation(allScenarios);

  if (recommendation) {
    logger.info("DG: melhor cenário", {
      runId,
      scenarioId: recommendation.bestScenario.scenarioId,
      score: recommendation.bestScenario.objectiveScore.toFixed(2),
      cqt:
        (
          recommendation.bestScenario.electricalResult.cqtMaxFraction * 100
        ).toFixed(2) + "%",
    });
  } else {
    logger.warn("DG: nenhum cenário viável encontrado", { runId, inputHash });
  }

  return {
    runId,
    inputHash,
    computedAt: new Date().toISOString(),
    totalCandidatesEvaluated,
    totalFeasible,
    recommendation,
    allScenarios,
    params,
  };
}
