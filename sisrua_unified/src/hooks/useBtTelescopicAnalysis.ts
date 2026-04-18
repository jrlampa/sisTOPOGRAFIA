/**
 * Hook: useBtTelescopicAnalysis – REDE NOVA Intelligence
 *
 * Gerencia a análise telescópica CQT no fluxo REDE NOVA:
 *  - Opt-in explícito do usuário antes de executar
 *  - Chamada ao endpoint POST /api/bt/telescopic-analysis
 *  - Armazena resultado e abre o modal de sugestões
 */

import { useState, useCallback } from "react";
import type { BtTopology, BtNetworkScenario } from "../types";
import type { BtPoleAccumulatedDemand } from "../utils/btTopologyFlow";
import type { TelescopicAnalysisOutput } from "../../server/services/bt/btTypes";

// ─── Interface pública do hook ────────────────────────────────────────────────

export interface UseBtTelescopicAnalysisReturn {
  isAnalyzing: boolean;
  suggestions: TelescopicAnalysisOutput | null;
  /** Dispara a análise com confirmação prévia. */
  triggerAnalysis: (
    topology: BtTopology,
    accumulatedByPole: BtPoleAccumulatedDemand[],
    transformerDebugById: Record<string, { assignedClients: number; estimatedDemandKva: number }>,
    scenario: BtNetworkScenario,
    requestConfirmation: (onConfirm: () => void) => void,
  ) => void;
  clearSuggestions: () => void;
}

// ─── Constantes elétricas (frontend, para exibição) ──────────────────────────

const DEFAULT_Z_PERCENT = 0.035;
const DEFAULT_QT_MT = 0.0183;
const DEFAULT_TEMPERATURE_C = 75;
const DEFAULT_PHASE = "TRI" as const;
const TELESCOPIC_API_PATH = "/api/bt/telescopic-analysis";

// ─── Payload builder ──────────────────────────────────────────────────────────

function buildTelescopicPayload(
  topology: BtTopology,
  accumulatedByPole: BtPoleAccumulatedDemand[],
  transformerDebugById: Record<string, { assignedClients: number; estimatedDemandKva: number }>,
) {
  const accMap = new Map(accumulatedByPole.map((a) => [a.poleId, a]));
  const transformer = topology.transformers[0];
  if (!transformer) return null;

  const rootNodeId = transformer.poleId ?? `trafo-root-${transformer.id}`;
  const trafoKva =
    transformer.projectPowerKva && transformer.projectPowerKva > 0
      ? transformer.projectPowerKva
      : transformer.demandKva && transformer.demandKva > 0
        ? transformer.demandKva
        : 75;

  // Nó raiz virtual se o trafo não estiver em nenhum poste
  const poleIds = new Set(topology.poles.map((p) => p.id));
  const needsVirtualRoot = !poleIds.has(rootNodeId);

  const nodes = topology.poles.map((pole) => {
    const acc = accMap.get(pole.id);
    return {
      id: pole.id,
      load: {
        localDemandKva: acc?.localTrechoDemandKva ?? 0,
      },
    };
  });

  if (needsVirtualRoot) {
    nodes.push({ id: rootNodeId, load: { localDemandKva: 0 } });
  }

  const activeEdges = topology.edges.filter(
    (e) => (e.edgeChangeFlag ?? "existing") !== "remove",
  );

  const edges = activeEdges
    .filter((e) => e.conductors.length > 0)
    .map((e) => ({
      fromNodeId: e.fromPoleId,
      toNodeId: e.toPoleId,
      conductorId: e.conductors[0].conductorName,
      lengthMeters: e.cqtLengthMeters ?? e.lengthMeters ?? 10,
    }));

  return {
    transformer: {
      id: transformer.id,
      rootNodeId,
      kva: trafoKva,
      zPercent: DEFAULT_Z_PERCENT,
      qtMt: DEFAULT_QT_MT,
    },
    nodes,
    edges,
    phase: DEFAULT_PHASE,
    temperatureC: DEFAULT_TEMPERATURE_C,
    nominalVoltageV: 127,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBtTelescopicAnalysis(): UseBtTelescopicAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<TelescopicAnalysisOutput | null>(null);

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
  }, []);

  const runAnalysis = useCallback(
    async (
      topology: BtTopology,
      accumulatedByPole: BtPoleAccumulatedDemand[],
      transformerDebugById: Record<string, { assignedClients: number; estimatedDemandKva: number }>,
    ) => {
      const payload = buildTelescopicPayload(topology, accumulatedByPole, transformerDebugById);
      if (!payload) return;

      setIsAnalyzing(true);
      try {
        const response = await fetch(TELESCOPIC_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          console.error("[TelescopicAnalysis] Erro na API", response.status, errBody);
          return;
        }

        const result: TelescopicAnalysisOutput = await response.json();
        setSuggestions(result);
      } catch (err) {
        console.error("[TelescopicAnalysis] Falha na requisição", err);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [],
  );

  const triggerAnalysis = useCallback(
    (
      topology: BtTopology,
      accumulatedByPole: BtPoleAccumulatedDemand[],
      transformerDebugById: Record<string, { assignedClients: number; estimatedDemandKva: number }>,
      scenario: BtNetworkScenario,
      requestConfirmation: (onConfirm: () => void) => void,
    ) => {
      // Executa apenas no modo REDE NOVA
      if (scenario !== "projeto") return;
      // Deve ter pelo menos um transformador e uma aresta para analisar
      if (topology.transformers.length === 0 || topology.edges.length === 0) return;

      requestConfirmation(() => {
        void runAnalysis(topology, accumulatedByPole, transformerDebugById);
      });
    },
    [runAnalysis],
  );

  return { isAnalyzing, suggestions, triggerAnalysis, clearSuggestions };
}
