/**
 * Design Generativo – Função Objetivo Multi-Critério
 *
 * Calcula o score global (0-100) de um cenário avaliado, compondo:
 *
 *   - custo de cabos      (30%): menor comprimento total de rede = melhor
 *   - custo de postes     (10%): menos postes novos = melhor (Modo B)
 *   - custo de trafo      (15%): reutilizar trafo existente = melhor
 *   - penalidade CQT      (30%): quanto mais longe do limite ANEEL = melhor
 *   - penalidade sobrecarga (15%): menor utilização do trafo = melhor
 *
 * Pesos configuráveis via DgObjectiveWeights (devem somar 1.0).
 *
 * Referência:
 *   scenarioAnalysisService.ts – mesma filosofia de scoring multi-critério
 *   docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – função objetivo configurável
 */

import type {
  DgScenario,
  DgElectricalResult,
  DgObjectiveWeights,
  DgScoreComponents,
  DgScenarioEdge,
} from "./dgTypes.js";
import { DEFAULT_DG_PARAMS } from "./dgTypes.js";

// ─── Referências de custo (valores relativos, não absolutos) ──────────────────

/** Comprimento de referência de rede BT (m) para normalização de custo. */
const CABLE_COST_REFERENCE_M = 2000;
/** Máximo de postes novos esperado antes de penalização completa. */
const MAX_NEW_POLES_REFERENCE = 20;
/** Custo relativo de substituição de trafo vs. manutenção (0-1). */
const TRAFO_RELOCATION_PENALTY = 0.4;

// ─── Componentes individuais de score ─────────────────────────────────────────

/**
 * Score de custo de cabos (0-100).
 * Menor comprimento total = score maior.
 */
function scoreCableCost(totalCableLengthMeters: number): number {
  const ratio = totalCableLengthMeters / CABLE_COST_REFERENCE_M;
  if (ratio <= 0.5) return 100;
  if (ratio >= 2.0) return 0;
  return Math.max(0, 100 - ((ratio - 0.5) / 1.5) * 100);
}

/**
 * Score de custo de postes novos (0-100).
 * 0 postes novos = 100. Modo A sempre retorna 100.
 */
function scorePoleCost(newPolesCount: number): number {
  if (newPolesCount === 0) return 100;
  const ratio = newPolesCount / MAX_NEW_POLES_REFERENCE;
  return Math.max(0, 100 - ratio * 100);
}

/**
 * Score de custo de trafo (0-100).
 * Candidato no poste existente do trafo = 100.
 * Candidato em poste existente = 100 × (1 - TRAFO_RELOCATION_PENALTY).
 * Candidato em ponto novo = 100 × (1 - TRAFO_RELOCATION_PENALTY) × 0.8.
 */
export function scoreTrafoCost(candidateSource: string): number {
  if (candidateSource === "existing_pole") {
    return 100 * (1 - TRAFO_RELOCATION_PENALTY * 0.5);
  }
  if (candidateSource === "fermat_weber" || candidateSource === "centroid") {
    return 100 * (1 - TRAFO_RELOCATION_PENALTY);
  }
  // grid = novo poste
  return 100 * (1 - TRAFO_RELOCATION_PENALTY) * 0.8;
}

/**
 * Score de penalidade CQT (0-100).
 * Abaixo de 5% → 100. Entre 5-8% → declínio linear. Acima de 8% → 0.
 */
function scoreCqtPenalty(cqtFraction: number): number {
  const LIMITE_ANEEL = 0.08;
  const ALERTA = 0.05;
  if (cqtFraction <= ALERTA) return 100;
  if (cqtFraction <= LIMITE_ANEEL) {
    return 100 - ((cqtFraction - ALERTA) / (LIMITE_ANEEL - ALERTA)) * 60;
  }
  const excess = ((cqtFraction - LIMITE_ANEEL) / LIMITE_ANEEL) * 100;
  return Math.max(0, 40 - excess * 5);
}

/**
 * Score de penalidade de sobrecarga do trafo (0-100).
 * Utilização ideal: 60-85%. Acima de 95% → 0.
 */
function scoreOverloadPenalty(utilizationFraction: number): number {
  const IDEAL_MIN = 0.6;
  const IDEAL_MAX = 0.85;
  const LIMIT = 0.95;
  if (utilizationFraction >= IDEAL_MIN && utilizationFraction <= IDEAL_MAX)
    return 100;
  if (utilizationFraction < IDEAL_MIN) {
    return Math.max(
      0,
      100 - ((IDEAL_MIN - utilizationFraction) / IDEAL_MIN) * 40,
    );
  }
  if (utilizationFraction <= LIMIT) {
    return Math.max(
      0,
      100 - ((utilizationFraction - IDEAL_MAX) / (LIMIT - IDEAL_MAX)) * 80,
    );
  }
  return 0;
}

// ─── Funções auxiliares de topologia ──────────────────────────────────────────

/** Conta postes novos num cenário (source = 'grid' → novo poste). */
export function countNewPoles(
  scenario: Pick<DgScenario, "candidateId">,
): number {
  // No Modo A (existing_pole, fermat_weber, centroid) = 0 novos postes
  // No Modo B (grid) o candidateId codifica a origem
  return 0; // expandido na integração com o optimizer
}

/** Calcula comprimento total de rede a partir das arestas do cenário. */
export function totalCableLengthMeters(edges: DgScenarioEdge[]): number {
  return edges.reduce((s, e) => s + e.lengthMeters, 0);
}

// ─── Score global ─────────────────────────────────────────────────────────────

export interface ScoreInput {
  edges: DgScenarioEdge[];
  electricalResult: DgElectricalResult;
  candidateSource: string;
  newPolesCount?: number;
  weights?: DgObjectiveWeights;
}

/**
 * Calcula score global e componentes para um cenário DG.
 * @returns { objectiveScore, scoreComponents }
 */
export function calculateObjectiveScore(input: ScoreInput): {
  objectiveScore: number;
  scoreComponents: DgScoreComponents;
} {
  const cableLen = totalCableLengthMeters(input.edges);
  const newPolesCount = input.newPolesCount ?? 0;
  const w = input.weights ?? DEFAULT_DG_PARAMS.objectiveWeights;

  const components: DgScoreComponents = {
    cableCostScore: scoreCableCost(cableLen),
    poleCostScore: scorePoleCost(newPolesCount),
    trafoCostScore: scoreTrafoCost(input.candidateSource),
    cqtPenaltyScore: scoreCqtPenalty(input.electricalResult.cqtMaxFraction),
    overloadPenaltyScore: scoreOverloadPenalty(
      input.electricalResult.trafoUtilizationFraction,
    ),
  };

  const objectiveScore =
    components.cableCostScore * w.cableCost +
    components.poleCostScore * w.poleCost +
    components.trafoCostScore * w.trafoCost +
    components.cqtPenaltyScore * w.cqtPenalty +
    components.overloadPenaltyScore * w.overloadPenalty;

  return {
    objectiveScore: Math.max(0, Math.min(100, objectiveScore)),
    scoreComponents: components,
  };
}
