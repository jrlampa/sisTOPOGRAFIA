/**
 * types.canonical.ts — Modelo Canônico Poste-Driven
 *
 * Este arquivo define os tipos canônicos do domínio Poste-Driven.
 * Os tipos legados (BtPoleNode, MtPoleNode, BtEdge, MtEdge, BtTopology,
 * MtTopology) permanecem intactos em types.ts durante a migração gradual.
 *
 * Regra: NUNCA remova tipos daqui sem garantir que todos os consumidores
 * já foram migrados. Use @deprecated antes de excluir.
 */

// ─── Estruturas físicas do poste ──────────────────────────────────────────────

/** Estruturas BT instaladas no poste (herdado de BtPoleBtStructures). */
export interface CanonicalBtStructures {
  si1?: string;
  si2?: string;
  si3?: string;
  si4?: string;
}

/** Estruturas MT instaladas no poste (herdado de MtPoleStructures). */
export interface CanonicalMtStructures {
  n1?: string;
  n2?: string;
  n3?: string;
  n4?: string;
}

/** Especificação física do poste (herdado de BtPoleSpec). */
export interface CanonicalPoleSpec {
  heightM?: number;
  nominalEffortDan?: number;
}

/** Status de condição física do poste. */
export type CanonicalPoleConditionStatus =
  | "bom_estado"
  | "desaprumado"
  | "trincado"
  | "condenado";

/** Ramal conectado ao poste (herdado de BtPoleRamalEntry). */
export interface CanonicalRamalEntry {
  id: string;
  quantity: number;
  ramalType?: string;
  notes?: string;
}

/** Flag de ciclo de vida do nó. */
export type CanonicalNodeChangeFlag = "existing" | "new" | "remove" | "replace";

// ─── PoleNode canônico (Aggregate Root) ──────────────────────────────────────

/**
 * PoleNode canônico — Aggregate Root do domínio de rede.
 *
 * Unifica BtPoleNode + MtPoleNode em um único agregado.
 * Os campos `hasBt` e `hasMt` indicam quais tecnologias estão presentes.
 *
 * Mapeamento de legado:
 *   BtPoleNode → campos bt* + ramais + poleSpec + conditionStatus + circuitBreakPoint
 *   MtPoleNode → campos mt*
 */
export interface CanonicalPoleNode {
  // ── Identidade e localização ──────────────────────────────────────────────
  id: string;
  lat: number;
  lng: number;
  title: string;

  // ── Flags de tecnologia presentes ────────────────────────────────────────
  /** Poste possui rede BT. */
  hasBt: boolean;
  /** Poste possui rede MT. */
  hasMt: boolean;

  // ── Estruturas físicas ────────────────────────────────────────────────────
  btStructures?: CanonicalBtStructures;
  mtStructures?: CanonicalMtStructures;

  // ── Dados elétricos BT ───────────────────────────────────────────────────
  ramais?: CanonicalRamalEntry[];
  poleSpec?: CanonicalPoleSpec;
  conditionStatus?: CanonicalPoleConditionStatus;

  // ── Notas ────────────────────────────────────────────────────────────────
  equipmentNotes?: string;
  generalNotes?: string;

  // ── Flags operacionais ───────────────────────────────────────────────────
  /** Indica ponto de seccionamento de ramal (BT). */
  circuitBreakPoint?: boolean;
  verified?: boolean;
  nodeChangeFlag?: CanonicalNodeChangeFlag;
}

// ─── Condutor de aresta ───────────────────────────────────────────────────────

/** Condutor em uma aresta de rede (herdado de BtRamalEntry). */
export interface CanonicalConductorEntry {
  id: string;
  quantity: number;
  conductorName: string;
}

/** Flag de ciclo de vida da aresta. */
export type CanonicalEdgeChangeFlag = "existing" | "new" | "remove" | "replace";

// ─── NetworkEdge canônico ─────────────────────────────────────────────────────

/**
 * NetworkEdge canônico — conecta dois PoleNodes.
 *
 * Unifica BtEdge + MtEdge.
 * Condutores BT e MT ficam separados para preservar semântica elétrica.
 *
 * Mapeamento de legado:
 *   BtEdge → btConductors + cqtLengthMeters + replacementFromConductors + removeOnExecution
 *   MtEdge → mtConductors (sem condutores detalhados no legado)
 */
export interface CanonicalNetworkEdge {
  // ── Identidade e conectividade ────────────────────────────────────────────
  id: string;
  fromPoleId: string;
  toPoleId: string;

  // ── Geometria ────────────────────────────────────────────────────────────
  lengthMeters?: number;
  /** Comprimento elétrico para cálculo CQT (apenas BT). */
  cqtLengthMeters?: number;

  // ── Condutores por tecnologia ─────────────────────────────────────────────
  btConductors?: CanonicalConductorEntry[];
  mtConductors?: CanonicalConductorEntry[];
  /** Condutores de substituição propostos (apenas BT). */
  btReplacementConductors?: CanonicalConductorEntry[];

  // ── Flags operacionais ────────────────────────────────────────────────────
  /** Remover aresta na execução do projeto (apenas BT). */
  removeOnExecution?: boolean;
  verified?: boolean;
  edgeChangeFlag?: CanonicalEdgeChangeFlag;
}

// ─── NetworkTopology canônica ─────────────────────────────────────────────────

/**
 * NetworkTopology canônica — grafo completo de uma rede elétrica.
 *
 * Substitui BtTopology + MtTopology.
 * Transformers mantidos separados por regra de domínio atual.
 *
 * NOTA: os transformadores (BtTransformer) permanecem no tipo legado
 * durante a Fase B1; serão absorvidos no canônico na Fase B3+.
 */
export interface CanonicalNetworkTopology {
  poles: CanonicalPoleNode[];
  edges: CanonicalNetworkEdge[];
  /**
   * Transformadores mantidos como tipo legado BtTransformer durante migração.
   * Use `import type { BtTransformer } from './types.js'` nos consumidores.
   */
  // transformers: BtTransformer[];   ← adicionado na Fase B3
}

// ─── Guards de migração ───────────────────────────────────────────────────────

/**
 * Verifica se um objeto é um CanonicalPoleNode válido (mínimo).
 * Útil para narrowing em código de migração dual-read.
 */
export function isCanonicalPoleNode(obj: unknown): obj is CanonicalPoleNode {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o["id"] === "string" &&
    typeof o["lat"] === "number" &&
    typeof o["lng"] === "number" &&
    typeof o["title"] === "string"
  );
}

/**
 * Verifica se um objeto é um CanonicalNetworkEdge válido (mínimo).
 */
export function isCanonicalNetworkEdge(
  obj: unknown,
): obj is CanonicalNetworkEdge {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o["id"] === "string" &&
    typeof o["fromPoleId"] === "string" &&
    typeof o["toPoleId"] === "string"
  );
}
