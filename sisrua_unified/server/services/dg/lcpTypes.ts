/**
 * Motor Least-Cost Path (LCP) — Tipos
 *
 * Extensão do MT Router com roteamento ponderado por custo:
 * terreno, tipo de via, reuso de infraestrutura existente.
 *
 * Referência: T2.59 — docs/STRATEGIC_ROADMAP_2026.md
 */

import type { DgLatLon, DgRoadCorridor } from "./dgTypes.js";

// ─── Perfis de custo ──────────────────────────────────────────────────────────

/**
 * Multiplicadores de custo por característica do segmento viário.
 * Valor 1.0 = custo neutro. < 1.0 = caminho preferencial. > 1.0 = penalidade.
 */
export interface LcpCostProfile {
  id: string;
  /** Nome legível (para UI). */
  name: string;
  /**
   * Multiplicador por classe de via OSM.
   * Chave: classe da via. Valor: multiplicador de custo (≥ 0.1).
   */
  highwayMultiplier: Partial<Record<LcpHighwayClass, number>>;
  /**
   * Bônus de reuso de poste existente.
   * Segmentos que passam por postes existentes têm custo multiplicado por este fator.
   * Ex: 0.7 = 30% mais barato reutilizar infraestrutura.
   */
  existingPoleBonus: number;
  /**
   * Multiplicador de penalidade por travessia de área sensível.
   * Áreas sensíveis são polígonos de exclusão parcial (apenas custo, não bloqueio).
   */
  sensitiveCrossing: number;
  /**
   * Custo base por metro linear (R$/m) — para normalização comparativa.
   * Usado apenas no relatório de custo estimado, não na otimização.
   */
  baseCostPerMeter: number;
}

/** Classes de via reconhecidas pelo motor LCP (subconjunto de OSM highway). */
export type LcpHighwayClass =
  | "motorway"
  | "trunk"
  | "primary"
  | "secondary"
  | "tertiary"
  | "residential"
  | "service"
  | "track"
  | "path"
  | "unknown";

/** Perfis de custo predefinidos para uso rápido. */
export const LCP_COST_PROFILES: Record<string, LcpCostProfile> = {
  URBAN_STANDARD: {
    id: "URBAN_STANDARD",
    name: "Urbano Padrão",
    highwayMultiplier: {
      residential: 1.0,
      tertiary: 1.1,
      secondary: 1.3,
      primary: 1.6,
      trunk: 2.0,
      motorway: 3.0,
      service: 0.9,
      track: 1.2,
      path: 1.5,
      unknown: 1.0,
    },
    existingPoleBonus: 0.7,
    sensitiveCrossing: 1.8,
    baseCostPerMeter: 85,
  },
  RURAL_STANDARD: {
    id: "RURAL_STANDARD",
    name: "Rural Padrão",
    highwayMultiplier: {
      residential: 1.0,
      tertiary: 1.0,
      secondary: 1.2,
      primary: 1.5,
      trunk: 2.0,
      motorway: 3.5,
      service: 0.8,
      track: 0.9,
      path: 1.0,
      unknown: 1.0,
    },
    existingPoleBonus: 0.65,
    sensitiveCrossing: 2.2,
    baseCostPerMeter: 60,
  },
  CORRIDOR_PREFERRED: {
    id: "CORRIDOR_PREFERRED",
    name: "Preferência de Corredor",
    highwayMultiplier: {
      residential: 1.0,
      tertiary: 0.85,
      secondary: 0.75,
      primary: 0.9,
      trunk: 1.5,
      motorway: 2.5,
      service: 1.0,
      track: 1.3,
      path: 1.8,
      unknown: 1.0,
    },
    existingPoleBonus: 0.6,
    sensitiveCrossing: 2.0,
    baseCostPerMeter: 75,
  },
  MINIMIZE_CROSSINGS: {
    id: "MINIMIZE_CROSSINGS",
    name: "Mínimo de Travessias",
    highwayMultiplier: {
      residential: 1.0,
      tertiary: 1.2,
      secondary: 1.8,
      primary: 2.5,
      trunk: 4.0,
      motorway: 6.0,
      service: 0.8,
      track: 1.0,
      path: 1.2,
      unknown: 1.1,
    },
    existingPoleBonus: 0.75,
    sensitiveCrossing: 3.0,
    baseCostPerMeter: 90,
  },
};

// ─── Segmento viário anotado ──────────────────────────────────────────────────

/**
 * Corredor viário com metadados de custo adicionais para o motor LCP.
 * Extende DgRoadCorridor com classificação de terreno e área sensível.
 */
export interface LcpRoadSegment extends DgRoadCorridor {
  /** Classe OSM da via para cálculo de custo. */
  highwayClass?: LcpHighwayClass;
  /**
   * Indica se este corredor cruza área sensível (APP, unidade de conservação, etc.).
   * Penalidade `sensitiveCrossing` é aplicada a todos os seus segmentos.
   */
  isSensitiveArea?: boolean;
  /**
   * Custo fixo adicional por segmento (R$ ou unidade genérica).
   * Útil para travessias de rios, rodovias, áreas com licenciamento especial.
   */
  fixedPenalty?: number;
}

// ─── Poste existente para reuso ───────────────────────────────────────────────

export interface LcpExistingPole {
  id: string;
  position: DgLatLon;
}

// ─── Entrada do motor LCP ────────────────────────────────────────────────────

export interface LcpInput {
  /** Ponto de origem da rede MT (subestação ou ponto de entrega). */
  source: DgLatLon;
  /** Terminais a conectar (trafos MT ou pontos de entrega). */
  terminals: Array<{
    id: string;
    position: DgLatLon;
    /** Demanda no terminal (para priorização). Opcional. */
    demandKva?: number;
  }>;
  /** Rede viária com metadados de custo. */
  roadSegments: LcpRoadSegment[];
  /** Perfil de custo a utilizar. Default: URBAN_STANDARD. */
  costProfile?: LcpCostProfile;
  /**
   * Postes existentes para reuso de infraestrutura.
   * Nós próximos a estes postes recebem o bônus de reuso.
   */
  existingPoles?: LcpExistingPole[];
  /**
   * Raio máximo (m) para snap de origem/terminais ao grafo.
   * Default: 150 m.
   */
  maxSnapDistanceMeters?: number;
  /**
   * Threshold de fusão de nós (m) para eliminar duplicatas.
   * Default: 0.5 m.
   */
  nodeMergeThresholdMeters?: number;
  /** ID opcional da execução para rastreabilidade. */
  runId?: string;
}

// ─── Saída do motor LCP ───────────────────────────────────────────────────────

/** Detalhe por segmento do caminho ótimo. */
export interface LcpPathSegment {
  fromNodeId: string;
  toNodeId: string;
  fromLatLon?: DgLatLon;
  toLatLon?: DgLatLon;
  /** Distância geométrica (m). */
  lengthMeters: number;
  /** Custo ponderado do segmento (unidade adimensional). */
  weightedCost: number;
  /** Classe de via (se disponível). */
  highwayClass?: LcpHighwayClass;
  /** Indica que o segmento utiliza infraestrutura de poste existente. */
  usesExistingPole?: boolean;
  /** Indica que o segmento cruza área sensível. */
  isSensitiveArea?: boolean;
}

/** Caminho ótimo por terminal. */
export interface LcpPath {
  terminalId: string;
  /** Distância total geométrica (m). */
  totalLengthMeters: number;
  /** Custo total ponderado (menor = melhor). */
  totalWeightedCost: number;
  /** Custo estimado em R$ (baseCostPerMeter × totalLengthMeters × fator). */
  estimatedCostBrl?: number;
  segments: LcpPathSegment[];
  /** Número de postes existentes reutilizados. */
  existingPolesReused: number;
  /** Número de segmentos em área sensível. */
  sensitiveCrossings: number;
}

/** Edge único de saída (para renderização no mapa). */
export interface LcpEdge {
  fromNodeId: string;
  toNodeId: string;
  fromLatLon?: DgLatLon;
  toLatLon?: DgLatLon;
  lengthMeters: number;
  weightedCost: number;
  highwayClass?: LcpHighwayClass;
  usesExistingPole?: boolean;
  isSensitiveArea?: boolean;
}

/** Resultado completo do motor LCP. */
export interface LcpResult {
  feasible: boolean;
  reason?: string;
  runId?: string;
  /** ID do perfil de custo utilizado. */
  costProfileId: string;
  /** Número de terminais conectados com sucesso. */
  connectedTerminals: number;
  /** Distância total geométrica de todos os caminhos (m). */
  totalLengthMeters: number;
  /** Custo total ponderado consolidado. */
  totalWeightedCost: number;
  /** Custo estimado consolidado em R$. */
  estimatedCostBrl?: number;
  /** Edges únicos (deduplicated) para renderização. */
  edges: LcpEdge[];
  /** Detalhe por terminal. */
  paths: LcpPath[];
  /** Terminais não alcançados. */
  unreachableTerminals: string[];
  /** Número total de postes existentes reutilizados no traçado. */
  totalExistingPolesReused: number;
  /** Comparativo: economia estimada vs caminho mais curto sem pesos (m). */
  lengthVsUnweightedMeters?: number;
}
