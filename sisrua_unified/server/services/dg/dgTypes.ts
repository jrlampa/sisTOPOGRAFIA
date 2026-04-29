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
  currentDemandKva?: number;
}

/** Polígono de exclusão (edificação, área restrita). */
export interface DgExclusionPolygon {
  id: string;
  points: DgLatLon[];
  reason: "building" | "restricted_zone" | "road_buffer";
}

/** Classe de via OSM para heurística de calçada. */
export type OsmHighwayClass =
  | "residential"
  | "tertiary"
  | "secondary"
  | "primary"
  | "trunk"
  | "unknown";

/** Corredor viário permitido (buffer ao redor das vias). */
export interface DgRoadCorridor {
  id: string;
  centerPoints: DgLatLon[];
  bufferMeters: number;
  /**
   * Classe OSM da via. Quando informado, aplica heurística de calçada:
   * candidato deve estar a pelo menos `sidewalkOffsetMeters(highwayClass)`
   * da linha de centro para não ser colocado na pista.
   */
  highwayClass?: OsmHighwayClass;
}

/**
 * Catálogo completo de transformadores comerciais BT (Light / ABNT NBR 5356).
 * Faixa: 15 kVA até 300 kVA.
 * Fonte: TRAFOS_Z_BASELINE em cqtLookupTables.ts + prática de mercado.
 */
export const COMMERCIAL_TRAFO_KVA = [15, 30, 45, 75, 112.5, 150, 225, 300] as const;
export type CommercialTrafoKva = (typeof COMMERCIAL_TRAFO_KVA)[number];

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
  /** Modo de busca: 'exhaustive' (≤50 postes) ou 'heuristic'. Undefined para auto-seleção. */
  searchMode?: "exhaustive" | "heuristic";
  /** Número máximo de candidatos avaliados no modo heurístico. */
  maxCandidatesHeuristic: number;
  /** Espaçamento do grid para busca exaustiva/heurística (m). */
  gridSpacingMeters?: number;
  /** Pesos da função objetivo multi-critério. */
  objectiveWeights: DgObjectiveWeights;
  /** Permite propor novos postes além dos existentes (Modo B). */
  allowNewPoles: boolean;

  /**
   * Parâmetros do Wizard (Modo Full Project).
   * Definidos em docs/DG_IMPLEMENTATION_ADDENDUM_2026.md
   */
  projectMode?: "optimization" | "full_project";
  clientesPorPoste?: number;
  areaClandestinaM2?: number;
  demandaMediaClienteKva?: number;
  fatorSimultaneidade?: number;

  /**
   * Faixa de kVAs de trafo permitidos para o dimensionamento.
   * Se omitido, usa COMMERCIAL_TRAFO_KVA completo (15→300 kVA).
   *
   * Exemplos de uso:
   *   - Apenas 75 kVA:          [75]
   *   - Até 75 kVA:             [15, 30, 45, 75]
   *   - Apenas trafos grandes:  [150, 225, 300]
   *   - Catálogo completo:      [...COMMERCIAL_TRAFO_KVA]
   */
  faixaKvaTrafoPermitida?: number[];

  /**
   * Atalho para filtrar o catálogo até um kVA máximo.
   * Quando informado, `faixaKvaTrafoPermitida` é ignorado e usa-se
   * todos os trafos de COMMERCIAL_TRAFO_KVA com kVA ≤ trafoMaxKva.
   *
   * Exemplo: trafoMaxKva = 75  →  faixa efetiva = [15, 30, 45, 75]
   */
  trafoMaxKva?: number;

  wizardContractVersion?: "DG Wizard v1";
}

export const DEFAULT_DG_PARAMS: DgParams = {
  maxSpanMeters: 40,
  minSpanMeters: 8,
  cqtLimitFraction: 0.08,
  trafoMaxUtilization: 0.95,
  searchMode: undefined, // Auto-seleção ativada por padrão
  maxCandidatesHeuristic: 200,
  objectiveWeights: {
    cableCost: 0.3,
    poleCost: 0.1,
    trafoCost: 0.15,
    cqtPenalty: 0.3,
    overloadPenalty: 0.15,
  },
  allowNewPoles: false,
  projectMode: "optimization",
  // Catálogo padrão: faixa completa 15→300 kVA
  faixaKvaTrafoPermitida: [...COMMERCIAL_TRAFO_KVA],
  fatorSimultaneidade: 0.8,
  demandaMediaClienteKva: 1.5,
  wizardContractVersion: "DG Wizard v1",
};

/**
 * Resolve a faixa de kVAs efetiva a partir dos parâmetros DG.
 * Respeita `trafoMaxKva` (atalho) antes de `faixaKvaTrafoPermitida`.
 * Garante que a lista esteja ordenada e contenha apenas kVAs positivos.
 */
export function resolveTrafoFaixa(params: Pick<DgParams, "faixaKvaTrafoPermitida" | "trafoMaxKva">): number[] {
  if (params.trafoMaxKva != null && params.trafoMaxKva > 0) {
    return [...COMMERCIAL_TRAFO_KVA].filter((k) => k <= params.trafoMaxKva!);
  }
  const faixa = params.faixaKvaTrafoPermitida ?? [...COMMERCIAL_TRAFO_KVA];
  return [...faixa].filter((k) => k > 0).sort((a, b) => a - b);
}

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
  /** Opcional no Modo Full Project (Wizard). */
  transformer?: DgTransformerInput;
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
  source: "fermat_weber" | "existing_pole" | "grid" | "centroid";
}

// ─── Restrições ────────────────────────────────────────────────────────────────

export type DgConstraintCode =
  | "MAX_SPAN_EXCEEDED"
  | "INSIDE_EXCLUSION_ZONE"
  | "OUTSIDE_ROAD_CORRIDOR"
  | "INSIDE_ROAD_CARRIAGEWAY"
  | "CQT_LIMIT_EXCEEDED"
  | "TRAFO_OVERLOAD"
  | "NON_RADIAL_TOPOLOGY";

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
  metadata?: {
    selectedKva?: number;
    projectMode?: "optimization" | "full_project";
  };
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
  /** Resultado do particionamento, quando a rede não cabe num único trafo. */
  partitionedResult?: DgPartitionedResult;
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

// ─── Particionamento de rede (multi-trafo) ────────────────────────────────────

/** Uma sub-rede resultante do particionamento — possui seu próprio transformador. */
export interface DgPartition {
  partitionId: string;
  poles: DgPoleInput[];
  trafoPositionLatLon: DgLatLon;
  trafoPositionUtm: DgPoint;
  selectedKva: number;
  edges: DgScenarioEdge[];
  electricalResult: DgElectricalResult;
  totalDemandKva: number;
  /** O trafo foi movido da posição Fermat-Weber para respeitar a excentricidade de 200m? */
  eccentricityAdjusted: boolean;
  /** Distância máxima de qualquer poste ao trafo após ajuste. */
  maxNodeDistanceM: number;
  /** Baricentro Fermat-Weber antes do ajuste de excentricidade (diagnóstico). */
  centroid?: DgPoint;
}

/** Resultado completo do particionamento da rede. */
export interface DgPartitionedResult {
  partitions: DgPartition[];
  totalPartitions: number;
  /** Arestas MST removidas para criar as partições ("fromId→toId"). */
  cutEdgeIds: string[];
  /** Grau de equilíbrio médio dos cortes (0=desequilibrado, 1=50/50 perfeito). */
  avgBalanceRatio: number;
  /** Partições com resultado elétrico infeasible (CQT ou sobrecarga). */
  infeasiblePartitions: number;
  /** Demanda total de todos os postes (kVA). */
  totalDemandKva: number;
}
