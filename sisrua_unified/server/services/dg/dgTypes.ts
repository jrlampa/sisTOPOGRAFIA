/**
 * Design Generativo – Tipos Compartilhados
 *
 * Contratos de entrada/saída do motor de otimização DG.
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md
 */

// ─── Geometria base ────────────────────────────────────────────────────────────

/** Ponto geográfico em coordenadas métricas UTM SIRGAS (metros). */
export interface DgPoint {
    x: number; // Easting (m)
    y: number; // Northing (m)
}

/** Conversão lat/lon → UTM aproximada para uso interno (zona 23S Brasil). */
export interface DgLatLon {
    lat: number;
    lon: number;
}

// ─── Entrada do otimizador ─────────────────────────────────────────────────────

/** Poste existente com carga associada. */
export interface DgPoleInput {
    id: string;
    position: DgLatLon;
    demandKva: number;
    /** Número de ramais no poste (clientes). */
    clients: number;
}

/** Transformador existente. */
export interface DgTransformerInput {
    id: string;
    position: DgLatLon;
    kva: number;
    currentDemandKva: number;
}

/** Polígono de exclusão (edificação, área restrita). */
export interface DgExclusionPolygon {
    id: string;
    points: DgLatLon[];
    reason: 'building' | 'restricted_zone' | 'road_buffer';
}

/** Corredor viário permitido (buffer ao redor das vias). */
export interface DgRoadCorridor {
    id: string;
    centerPoints: DgLatLon[];
    bufferMeters: number;
}

/** Parâmetros configuráveis do DG. */
export interface DgParams {
    /** Vão máximo por trecho (m). Padrão 40 m. */
    maxSpanMeters: number;
    /** Vão mínimo (m). Padrão 8 m. */
    minSpanMeters: number;
    /** Limite ANEEL de queda de tensão (fração). 0.08 = 8%. */
    cqtLimitFraction: number;
    /** Fator de utilização máximo do trafo. Padrão 0.95. */
    trafoMaxUtilization: number;
    /** Modo de busca: 'exhaustive' (≤50 postes) ou 'heuristic'. */
    searchMode: 'exhaustive' | 'heuristic';
    /** Número máximo de candidatos avaliados no modo heurístico. */
    maxCandidatesHeuristic: number;
    /** Pesos da função objetivo multi-critério. */
    objectiveWeights: DgObjectiveWeights;
    /** Permite propor novos postes além dos existentes (Modo B). */
    allowNewPoles: boolean;
}

export const DEFAULT_DG_PARAMS: DgParams = {
    maxSpanMeters: 40,
    minSpanMeters: 8,
    cqtLimitFraction: 0.08,
    trafoMaxUtilization: 0.95,
    searchMode: 'exhaustive',
    maxCandidatesHeuristic: 200,
    objectiveWeights: {
        cableCost: 0.30,
        poleCost: 0.10,
        trafoCost: 0.15,
        cqtPenalty: 0.30,
        overloadPenalty: 0.15,
    },
    allowNewPoles: false,
};

/** Pesos da função objetivo. Devem somar 1.0. */
export interface DgObjectiveWeights {
    cableCost: number;
    poleCost: number;
    trafoCost: number;
    cqtPenalty: number;
    overloadPenalty: number;
}

/** Payload de entrada completo para uma execução DG. */
export interface DgOptimizationInput {
    runId?: string;
    tenantId?: string;
    poles: DgPoleInput[];
    transformer: DgTransformerInput;
    exclusionPolygons?: DgExclusionPolygon[];
    roadCorridors?: DgRoadCorridor[];
    params?: Partial<DgParams>;
}

// ─── Candidatos ────────────────────────────────────────────────────────────────

/** Posição candidata para o trafo (resultado do Fermat-Weber ou grid). */
export interface DgCandidate {
    candidateId: string;
    position: DgLatLon;
    positionUtm: DgPoint;
    /** Distância total ponderada à demanda (objetivo Fermat-Weber). */
    weightedDistanceSum: number;
    /** Origem do candidato. */
    source: 'fermat_weber' | 'existing_pole' | 'grid' | 'centroid';
}

// ─── Restrições ────────────────────────────────────────────────────────────────

export type DgConstraintCode =
    | 'MAX_SPAN_EXCEEDED'
    | 'INSIDE_EXCLUSION_ZONE'
    | 'OUTSIDE_ROAD_CORRIDOR'
    | 'CQT_LIMIT_EXCEEDED'
    | 'TRAFO_OVERLOAD'
    | 'NON_RADIAL_TOPOLOGY';

export interface DgConstraintViolation {
    code: DgConstraintCode;
    detail: string;
    /** ID do poste/trecho que causou a violação, se aplicável. */
    entityId?: string;
}

// ─── Cenários e resultados ─────────────────────────────────────────────────────

/** Trecho de rede no cenário DG. */
export interface DgScenarioEdge {
    fromPoleId: string;
    toPoleId: string;
    lengthMeters: number;
    conductorId: string;
}

/** Resultado elétrico de um cenário. */
export interface DgElectricalResult {
    cqtMaxFraction: number;
    worstTerminalNodeId: string;
    trafoUtilizationFraction: number;
    totalCableLengthMeters: number;
    feasible: boolean;
}

/** Um cenário DG avaliado. */
export interface DgScenario {
    scenarioId: string;
    candidateId: string;
    trafoPositionUtm: DgPoint;
    trafoPositionLatLon: DgLatLon;
    edges: DgScenarioEdge[];
    electricalResult: DgElectricalResult;
    objectiveScore: number; // 0-100, maior = melhor
    scoreComponents: DgScoreComponents;
    violations: DgConstraintViolation[];
    feasible: boolean;
}

export interface DgScoreComponents {
    cableCostScore: number;
    poleCostScore: number;
    trafoCostScore: number;
    cqtPenaltyScore: number;
    overloadPenaltyScore: number;
}

// ─── Saída do otimizador ───────────────────────────────────────────────────────

export interface DgRecommendation {
    bestScenario: DgScenario;
    alternatives: DgScenario[]; // Top 3 alternativas viáveis
    discardedCount: number;
    discardReasonSummary: Record<DgConstraintCode, number>;
}

export interface DgOptimizationOutput {
    runId: string;
    tenantId?: string;
    inputHash: string;
    computedAt: string;
    totalCandidatesEvaluated: number;
    totalFeasible: number;
    recommendation: DgRecommendation | null;
    allScenarios: DgScenario[];
    params: DgParams;
}

export interface DgRunSummary {
    runId: string;
    tenantId?: string;
    inputHash: string;
    computedAt: string;
    totalCandidatesEvaluated: number;
    totalFeasible: number;
    bestObjectiveScore: number | null;
    discardedCount: number;
}

export interface DgDiscardRateByConstraint {
    runId: string;
    tenantId?: string;
    code: DgConstraintCode;
    discardedScenarios: number;
    totalScenarios: number;
    discardRatePercent: number;
}
