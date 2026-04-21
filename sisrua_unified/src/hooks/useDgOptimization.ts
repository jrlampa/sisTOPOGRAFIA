/**
 * useDgOptimization – Integração com o motor de Design Generativo (DG).
 *
 * Converte BtTopology para o formato de entrada da API DG,
 * executa POST /api/dg/optimize e fornece handlers de aceitação parcial.
 *
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – Frente 3 (Frontend)
 */

import { useState, useCallback } from "react";
import type { BtTopology, BtEdge } from "../types";

// ─── Tipos espelhados do servidor (dgTypes.ts) ─────────────────────────────────

export interface DgLatLon {
  lat: number;
  lon: number;
}

export interface DgScenarioEdge {
  fromPoleId: string;
  toPoleId: string;
  lengthMeters: number;
  conductorId: string;
}

export interface DgElectricalResult {
  cqtMaxFraction: number;
  worstTerminalNodeId: string;
  trafoUtilizationFraction: number;
  totalCableLengthMeters: number;
  feasible: boolean;
}

export type DgConstraintCode =
  | "MAX_SPAN_EXCEEDED"
  | "INSIDE_EXCLUSION_ZONE"
  | "OUTSIDE_ROAD_CORRIDOR"
  | "CQT_LIMIT_EXCEEDED"
  | "TRAFO_OVERLOAD"
  | "NON_RADIAL_TOPOLOGY";

export interface DgConstraintViolation {
  code: DgConstraintCode;
  detail: string;
  entityId?: string;
}

export interface DgScoreComponents {
  cableCostScore: number;
  poleCostScore: number;
  trafoCostScore: number;
  cqtPenaltyScore: number;
  overloadPenaltyScore: number;
}

export interface DgScenario {
  scenarioId: string;
  trafoPositionLatLon: DgLatLon;
  edges: DgScenarioEdge[];
  electricalResult: DgElectricalResult;
  objectiveScore: number; // 0–100, maior = melhor
  scoreComponents: DgScoreComponents;
  violations: DgConstraintViolation[];
  feasible: boolean;
}

export interface DgRecommendation {
  bestScenario: DgScenario;
  alternatives: DgScenario[];
  discardedCount: number;
  discardReasonSummary: Partial<Record<DgConstraintCode, number>>;
}

export interface DgOptimizationOutput {
  runId: string;
  computedAt: string;
  totalCandidatesEvaluated: number;
  totalFeasible: number;
  recommendation: DgRecommendation | null;
  params: { maxSpanMeters: number };
}

// ─── Estado da execução ────────────────────────────────────────────────────────

export interface DgRunState {
  isOptimizing: boolean;
  result: DgOptimizationOutput | null;
  error: string | null;
}

// ─── Helpers de conversão ──────────────────────────────────────────────────────

/**
 * Converte arestas DG para formato BtEdge.
 * Reutiliza aresta existente (por par de postes) quando possível.
 */
function dgEdgesToBtEdges(
  dgEdges: DgScenarioEdge[],
  existing: BtEdge[],
): BtEdge[] {
  const ts = Date.now();
  return dgEdges.map((dge, i) => {
    const reuse = existing.find(
      (e) =>
        (e.fromPoleId === dge.fromPoleId && e.toPoleId === dge.toPoleId) ||
        (e.fromPoleId === dge.toPoleId && e.toPoleId === dge.fromPoleId),
    );
    if (reuse) return { ...reuse, lengthMeters: dge.lengthMeters };
    return {
      id: `dg-edge-${ts}-${i}`,
      fromPoleId: dge.fromPoleId,
      toPoleId: dge.toPoleId,
      lengthMeters: dge.lengthMeters,
      conductors: [
        {
          id: `dg-cond-${ts}-${i}`,
          quantity: 1,
          conductorName: dge.conductorId,
        },
      ],
      edgeChangeFlag: "new" as const,
    };
  });
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useDgOptimization() {
  const [state, setState] = useState<DgRunState>({
    isOptimizing: false,
    result: null,
    error: null,
  });

  /**
   * Índice da alternativa ativa na navegação do painel DG.
   * -1 = melhor cenário; 0..N = alternatives[N].
   */
  const [activeAltIndex, setActiveAltIndex] = useState<number>(-1);

  /**
   * Executa otimização DG para a topologia BT atual.
   * Requer ao menos 1 poste e 1 transformador.
   */
  const runDgOptimization = useCallback(async (btTopology: BtTopology) => {
    if (btTopology.poles.length === 0) return;
    const transformer = btTopology.transformers[0];
    if (!transformer) return;

    setState({ isOptimizing: true, result: null, error: null });

    const payload = {
      poles: btTopology.poles.map((p) => ({
        id: p.id,
        position: { lat: p.lat, lon: p.lng },
        // Demanda padrão 1,5 kVA por ramal; valor real vem de accumulatedByPole
        demandKva: Math.max(1, (p.ramais?.length ?? 1) * 1.5),
        clients: p.ramais?.length ?? 1,
      })),
      transformer: {
        id: transformer.id,
        position: { lat: transformer.lat, lon: transformer.lng },
        kva: transformer.projectPowerKva ?? 75,
        currentDemandKva: transformer.demandKva ?? 0,
      },
    };

    try {
      const res = await fetch("/api/dg/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as DgOptimizationOutput;
      setState({ isOptimizing: false, result, error: null });
      setActiveAltIndex(-1); // Reinicia seleção ao melhor cenário
    } catch (err) {
      setState({
        isOptimizing: false,
        result: null,
        error: (err as Error).message,
      });
    }
  }, []);

  /** Limpa o resultado da última execução DG. */
  const clearDgResult = useCallback(() => {
    setState({ isOptimizing: false, result: null, error: null });
    setActiveAltIndex(-1);
  }, []);

  /**
   * Aplica cenário DG completo: realoca trafo + substitui condutores.
   * Retorna nova topologia (não modifica estado diretamente).
   */
  const applyDgAll = useCallback(
    (btTopology: BtTopology, scenario: DgScenario): BtTopology => {
      const transformer = btTopology.transformers[0];
      if (!transformer) return btTopology;
      const nextTransformer = {
        ...transformer,
        lat: scenario.trafoPositionLatLon.lat,
        lng: scenario.trafoPositionLatLon.lon,
        transformerChangeFlag: "replace" as const,
      };
      return {
        ...btTopology,
        transformers: [nextTransformer, ...btTopology.transformers.slice(1)],
        edges: dgEdgesToBtEdges(scenario.edges, btTopology.edges),
      };
    },
    [],
  );

  /**
   * Aplica apenas a relocação do transformador, mantendo condutores existentes.
   * Retorna nova topologia (não modifica estado diretamente).
   */
  const applyDgTrafoOnly = useCallback(
    (btTopology: BtTopology, scenario: DgScenario): BtTopology => {
      const transformer = btTopology.transformers[0];
      if (!transformer) return btTopology;
      const nextTransformer = {
        ...transformer,
        lat: scenario.trafoPositionLatLon.lat,
        lng: scenario.trafoPositionLatLon.lon,
        transformerChangeFlag: "replace" as const,
      };
      return {
        ...btTopology,
        transformers: [nextTransformer, ...btTopology.transformers.slice(1)],
      };
    },
    [],
  );

  return {
    ...state,
    activeAltIndex,
    setActiveAltIndex,
    /** Cenário ativo: melhor (−1) ou alternativa selecionada. */
    activeScenario:
      state.result?.recommendation == null
        ? null
        : activeAltIndex === -1
          ? state.result.recommendation.bestScenario
          : (state.result.recommendation.alternatives[activeAltIndex] ?? null),
    runDgOptimization,
    clearDgResult,
    applyDgAll,
    applyDgTrafoOnly,
  };
}
