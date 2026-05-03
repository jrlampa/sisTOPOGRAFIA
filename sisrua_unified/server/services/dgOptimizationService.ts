/**
 * Design Generativo – Serviço de Orquestração
 */

import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
import type {
  DgDiscardRateByConstraint,
  DgOptimizationInput,
  DgOptimizationOutput,
  DgRecommendation,
  DgScenario,
  DgConstraintCode,
  DgParams,
  DgRunSummary,
} from "./dg/dgTypes.js";
import { DEFAULT_DG_PARAMS } from "./dg/dgTypes.js";
import { resolveTrafoFaixa } from "./dg/dgTypes.js";
import { generateCandidates, hashDgInput } from "./dg/dgCandidates.js";
import { runDgOptimizer } from "./dg/dgOptimizer.js";
import { partitionNetwork } from "./dg/dgPartitioner.js";
import { dgRunRepository } from "../repositories/dgRunRepository.js";

function mergeParams(partial?: Partial<DgParams>): DgParams {
  return { ...DEFAULT_DG_PARAMS, ...partial };
}

/**
 * Auto-seleciona modo de busca baseado no tamanho da rede.
 * Só é ignorado se o usuário informou EXPLICITAMENTE no input.
 */
function autoSearchMode(
  poles: number,
  params: DgParams,
  userParams?: Partial<DgParams>,
): DgParams {
  // Se o usuário EXPLICITAMENTE enviou um searchMode válido, respeitar
  if (
    userParams?.searchMode &&
    (userParams.searchMode === "exhaustive" ||
      userParams.searchMode === "heuristic")
  ) {
    return { ...params, searchMode: userParams.searchMode };
  }
  // Caso contrário, auto-selecionar baseado no tamanho da rede
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
    for (const v of s.violations) summary[v.code] = (summary[v.code] ?? 0) + 1;
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

export async function runDgOptimization(
  input: DgOptimizationInput,
): Promise<DgOptimizationOutput> {
  const runId = input.runId ?? randomUUID();
  const params = autoSearchMode(
    input.poles.length,
    mergeParams(input.params),
    input.params,
  );
  const inputHash = hashDgInput(input, params);

  logger.info("DG: iniciando otimização", {
    runId,
    inputHash,
    poles: input.poles.length,
    searchMode: params.searchMode,
  });

  if (input.poles.length === 0)
    throw new Error("DG: ao menos um poste deve ser fornecido.");
  const isFullProject = params.projectMode === "full_project";
  if (!isFullProject && (!input.transformer || input.transformer.kva <= 0)) {
    throw new Error("DG: transformador inválido.");
  }

  const candidates = generateCandidates(input.poles, params);
  const { allScenarios, totalCandidatesEvaluated } = await runDgOptimizer(
    candidates,
    input.poles,
    input.transformer,
    input.exclusionPolygons ?? [],
    input.roadCorridors ?? [],
    params,
  );

  const totalFeasible = allScenarios.filter((s) => s.feasible).length;
  const recommendation = buildRecommendation(allScenarios);

  // Aciona particionamento quando:
  // 1. Não há nenhum cenário único-trafo viável, OU
  // 2. Demanda total excede a capacidade máxima do trafo em full_project
  const maxKva = Math.max(...resolveTrafoFaixa(params));
  const totalDemandKva = input.poles.reduce((s, p) => s + (p.demandKva ?? 0), 0);
  const shouldPartition =
    recommendation === null ||
    (isFullProject && totalDemandKva > maxKva * (params.trafoMaxUtilization ?? 0.95));

  const partitionedResult =
    shouldPartition && input.poles.length >= 3
      ? (() => {
          logger.info("DG: acionando particionamento de rede", {
            runId,
            totalDemandKva,
            poles: input.poles.length,
          });
          return partitionNetwork(input.poles, params);
        })()
      : undefined;

  const output: DgOptimizationOutput = {
    runId,
    tenantId: input.tenantId,
    inputHash,
    computedAt: new Date().toISOString(),
    totalCandidatesEvaluated,
    totalFeasible,
    recommendation,
    allScenarios,
    params,
    partitionedResult,
  };

  await dgRunRepository.save(output);
  return output;
}

export async function getDgRun(
  runId: string,
  tenantId?: string,
): Promise<DgOptimizationOutput | null> {
  return dgRunRepository.findById(runId, tenantId);
}

export async function listDgRuns(
  limit = 20,
  tenantId?: string,
): Promise<DgRunSummary[]> {
  return dgRunRepository.list(limit, tenantId);
}

export async function listDgDiscardRates(
  limit = 100,
  tenantId?: string,
): Promise<DgDiscardRateByConstraint[]> {
  return dgRunRepository.listDiscardRates(limit, tenantId);
}

export async function getDgRunScenarios(
  runId: string,
  tenantId?: string,
): Promise<DgScenario[] | null> {
  return dgRunRepository.findScenarios(runId, tenantId);
}

export async function getDgRunRecommendation(
  runId: string,
  tenantId?: string,
): Promise<DgRecommendation | null> {
  return dgRunRepository.findRecommendation(runId, tenantId);
}
