/**
 * Design Generativo – Função Objetivo Multi-Critério
 */

import type {
  DgScenario,
  DgElectricalResult,
  DgObjectiveWeights,
  DgScoreComponents,
  DgScenarioEdge,
} from "./dgTypes.js";
import { DEFAULT_DG_PARAMS } from "./dgTypes.js";

const CABLE_COST_REFERENCE_M = 2000;
const MAX_NEW_POLES_REFERENCE = 20;
const TRAFO_RELOCATION_PENALTY = 0.4;

function scoreCableCost(totalCableLengthMeters: number): number {
  const ratio = totalCableLengthMeters / CABLE_COST_REFERENCE_M;
  if (ratio <= 0.5) return 100;
  if (ratio >= 2.0) return 0;
  return Math.max(0, 100 - ((ratio - 0.5) / 1.5) * 100);
}

function scorePoleCost(newPolesCount: number): number {
  if (newPolesCount === 0) return 100;
  const ratio = newPolesCount / MAX_NEW_POLES_REFERENCE;
  return Math.max(0, 100 - ratio * 100);
}

export function scoreTrafoCost(candidateSource: string): number {
  if (candidateSource === "existing_pole") return 100 * (1 - TRAFO_RELOCATION_PENALTY * 0.5);
  if (candidateSource === "fermat_weber" || candidateSource === "centroid") return 100 * (1 - TRAFO_RELOCATION_PENALTY);
  return 100 * (1 - TRAFO_RELOCATION_PENALTY) * 0.8;
}

function scoreCqtPenalty(cqtFraction: number): number {
  const LIMITE_ANEEL = 0.08, ALERTA = 0.05;
  if (cqtFraction <= ALERTA) return 100;
  if (cqtFraction <= LIMITE_ANEEL) return 100 - ((cqtFraction - ALERTA) / (LIMITE_ANEEL - ALERTA)) * 60;
  const excess = ((cqtFraction - LIMITE_ANEEL) / LIMITE_ANEEL) * 100;
  return Math.max(0, 40 - excess * 5);
}

function scoreOverloadPenalty(utilizationFraction: number): number {
  const IDEAL_MIN = 0.6, IDEAL_MAX = 0.85, LIMIT = 0.95;
  if (utilizationFraction >= IDEAL_MIN && utilizationFraction <= IDEAL_MAX) return 100;
  if (utilizationFraction < IDEAL_MIN) return Math.max(0, 100 - ((IDEAL_MIN - utilizationFraction) / IDEAL_MIN) * 40);
  if (utilizationFraction <= LIMIT) return Math.max(0, 100 - ((utilizationFraction - IDEAL_MAX) / (LIMIT - IDEAL_MAX)) * 80);
  return 0;
}

/**
 * Conta postes novos num cenário.
 * Correção: verifica prefixo 'grid' no candidateId.
 */
export function countNewPoles(scenario: Pick<DgScenario, "candidateId" | "edges">): number {
  let count = 0;
  if (scenario.candidateId.startsWith("grid")) count++;
  // Futuro: contar novos postes intermediários se implementado no MST
  return count;
}

export function totalCableLengthMeters(edges: DgScenarioEdge[]): number {
  return edges.reduce((s, e) => s + e.lengthMeters, 0);
}

export interface ScoreInput {
  edges: DgScenarioEdge[];
  electricalResult: DgElectricalResult;
  candidateSource: string;
  newPolesCount?: number;
  weights?: DgObjectiveWeights;
}

export function calculateObjectiveScore(input: ScoreInput): { objectiveScore: number; scoreComponents: DgScoreComponents; } {
  const cableLen = totalCableLengthMeters(input.edges);
  const newPolesCount = input.newPolesCount ?? 0;
  const w = input.weights ?? DEFAULT_DG_PARAMS.objectiveWeights;

  const components: DgScoreComponents = {
    cableCostScore: scoreCableCost(cableLen),
    poleCostScore: scorePoleCost(newPolesCount),
    trafoCostScore: scoreTrafoCost(input.candidateSource),
    cqtPenaltyScore: scoreCqtPenalty(input.electricalResult.cqtMaxFraction),
    overloadPenaltyScore: scoreOverloadPenalty(input.electricalResult.trafoUtilizationFraction),
  };

  const objectiveScore = components.cableCostScore * w.cableCost + components.poleCostScore * w.poleCost + components.trafoCostScore * w.trafoCost + components.cqtPenaltyScore * w.cqtPenalty + components.overloadPenaltyScore * w.overloadPenalty;
  return { objectiveScore: Math.max(0, Math.min(100, objectiveScore)), scoreComponents: components };
}
