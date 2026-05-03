import React from "react";
import { BtTopology, DgDecisionMode, BtNetworkScenario, AppSettings } from "../types";
import { DgScenario } from "./useDgOptimization";
import { DgWizardParams } from "../components/DgWizardModal";

export function useAppEngineeringWorkflows({
  dgTopologySource,
  runDgOptimization,
  dgResult,
  logDgDecision,
  dgActiveScenario,
  setAppState,
  applyDgAll,
  applyDgTrafoOnly,
  clearDgResult,
  showToast,
  findNearestMtPole,
  updateBtTopology,
  isBtTelescopicAnalyzing,
  triggerBtTelescopicAnalysis,
  btTopology,
  btAccumulatedByPole,
  btTransformerDebugById,
  requestCriticalConfirmation,
  settings,
  clearBtTelescopicSuggestions,
  btTelescopicSuggestions,
}: any) {
  const [lastAppliedDgResults, setLastAppliedDgResults] = React.useState<Record<string, any> | null>(null);

  const appendDgDecisionHistory = React.useCallback(
    (params: {
      mode: DgDecisionMode;
      runId: string;
      scenarioId?: string;
      score?: number;
      notes?: string;
    }) => {
      setAppState(
        (prev: any) => ({
          ...prev,
          dgDecisionHistory: [
            {
              decidedAt: new Date().toISOString(),
              mode: params.mode,
              runId: params.runId,
              scenarioId: params.scenarioId,
              score: params.score,
              notes: params.notes,
            },
            ...(prev.dgDecisionHistory ?? []),
          ].slice(0, 200),
        }),
        false,
        "Decisão DG",
      );
    },
    [setAppState],
  );

  const handleRunDgOptimization = React.useCallback(
    (wizardParams?: DgWizardParams) => {
      void runDgOptimization(dgTopologySource, wizardParams);
    },
    [runDgOptimization, dgTopologySource],
  );

  const handleAcceptDgAll = React.useCallback(
    (scenario: DgScenario) => {
      const runId = dgResult?.runId;
      if (runId) {
        void logDgDecision("all", scenario);
        appendDgDecisionHistory({
          mode: "all",
          runId,
          scenarioId: scenario.scenarioId,
          score: scenario.objectiveScore,
          notes: "Aplicação completa: trafo + condutores.",
        });
      }

      setLastAppliedDgResults({
        selectedKva: scenario.metadata?.selectedKva,
        cqtMax: scenario.electricalResult.cqtMaxFraction,
        trafoUtilization: scenario.electricalResult.trafoUtilizationFraction,
        totalCableLength: scenario.electricalResult.totalCableLengthMeters,
        score: scenario.objectiveScore,
        discardedCount: dgResult?.recommendation?.discardedCount,
        scoreComponents: scenario.scoreComponents,
      });

      updateBtTopology(applyDgAll(dgTopologySource, scenario), "Design Generativo (Trafo + Condutores)");
      clearDgResult();
      showToast("Solução DG aplicada: trafo + condutores atualizados.", "success");

      const trafoLoc = {
        lat: scenario.trafoPositionLatLon.lat,
        lng: scenario.trafoPositionLatLon.lon,
      };
      const nearMtPole = findNearestMtPole(trafoLoc, 50);
      if (nearMtPole) {
        showToast(
          `Poste MT "${nearMtPole.title}" detectado a menos de 50 m do trafo DG — considere adicionar aresta MT para conexão.`,
          "info",
        );
      }
    },
    [dgResult, logDgDecision, appendDgDecisionHistory, applyDgAll, dgTopologySource, updateBtTopology, clearDgResult, showToast, findNearestMtPole],
  );

  const handleAcceptDgTrafoOnly = React.useCallback(
    (scenario: DgScenario) => {
      const runId = dgResult?.runId;
      if (runId) {
        void logDgDecision("trafo_only", scenario);
        appendDgDecisionHistory({
          mode: "trafo_only",
          runId,
          scenarioId: scenario.scenarioId,
          score: scenario.objectiveScore,
          notes: "Aplicação parcial: somente trafo.",
        });
      }

      setLastAppliedDgResults({
        selectedKva: scenario.metadata?.selectedKva,
        cqtMax: scenario.electricalResult.cqtMaxFraction,
        trafoUtilization: scenario.electricalResult.trafoUtilizationFraction,
        totalCableLength: scenario.electricalResult.totalCableLengthMeters,
        score: scenario.objectiveScore,
        discardedCount: dgResult?.recommendation?.discardedCount,
        scoreComponents: scenario.scoreComponents,
      });

      updateBtTopology(applyDgTrafoOnly(dgTopologySource, scenario), "Design Generativo (Apenas Trafo)");
      clearDgResult();
      showToast("Posição do trafo atualizada pelo DG.", "success");

      const trafoLoc = {
        lat: scenario.trafoPositionLatLon.lat,
        lng: scenario.trafoPositionLatLon.lon,
      };
      const nearMtPole = findNearestMtPole(trafoLoc, 50);
      if (nearMtPole) {
        showToast(
          `Poste MT "${nearMtPole.title}" detectado a menos de 50 m do trafo DG — considere adicionar aresta MT para conexão.`,
          "info",
        );
      }
    },
    [dgResult, logDgDecision, appendDgDecisionHistory, applyDgTrafoOnly, dgTopologySource, updateBtTopology, clearDgResult, findNearestMtPole, showToast],
  );

  const handleDiscardDgResult = React.useCallback(() => {
    const runId = dgResult?.runId;
    if (runId) {
      void logDgDecision("discard", dgActiveScenario ?? undefined);
      appendDgDecisionHistory({
        mode: "discard",
        runId,
        scenarioId: dgActiveScenario?.scenarioId,
        score: dgActiveScenario?.objectiveScore,
        notes: "Usuário descartou recomendação DG.",
      });
    }
    clearDgResult();
    showToast("Recomendação DG descartada.", "info");
  }, [dgResult?.runId, dgActiveScenario, logDgDecision, appendDgDecisionHistory, clearDgResult, showToast]);

  const handleTriggerTelescopicAnalysis = React.useCallback(() => {
    if (isBtTelescopicAnalyzing) {
      showToast("Análise telescópica já está em execução.", "info");
      return;
    }

    triggerBtTelescopicAnalysis(
      btTopology,
      btAccumulatedByPole,
      btTransformerDebugById,
      "projeto",
      (onConfirm: any) => {
        requestCriticalConfirmation({
          title: "Executar análise telescópica da REDE NOVA?",
          message: "A análise avalia quedas de tensão e sugere substituições de condutores no sentido trafo para ponta.",
          confirmLabel: "Executar análise",
          cancelLabel: "Cancelar",
          tone: "info",
          onConfirm,
        });
      },
    );
  }, [isBtTelescopicAnalyzing, showToast, triggerBtTelescopicAnalysis, btTopology, btAccumulatedByPole, btTransformerDebugById, requestCriticalConfirmation]);

  const handleApplyTelescopicSuggestions = React.useCallback(
    (analysisOutput: NonNullable<typeof btTelescopicSuggestions>) => {
      if ((settings.btNetworkScenario ?? "asis") !== "projeto") {
        showToast("As sugestões telescópicas só podem ser aplicadas na REDE NOVA.", "info");
        clearBtTelescopicSuggestions();
        return;
      }

      const conductorByEdgeId = new Map<string, string>();
      for (const suggestion of analysisOutput.suggestions) {
        for (const edge of suggestion.pathEdges) {
          conductorByEdgeId.set(edge.edgeId, edge.suggestedConductorId);
        }
      }

      if (conductorByEdgeId.size === 0) {
        showToast("Nenhuma substituição de condutor foi sugerida.", "info");
        clearBtTelescopicSuggestions();
        return;
      }

      const nextEdges = btTopology.edges.map((edge: any, index: number) => {
        const directKey = `${edge.fromPoleId}->${edge.toPoleId}`;
        const reverseKey = `${edge.toPoleId}->${edge.fromPoleId}`;
        const suggestedConductor = conductorByEdgeId.get(directKey) ?? conductorByEdgeId.get(reverseKey);

        if (!suggestedConductor) return edge;

        const currentPrimary = edge.conductors[0];
        if (currentPrimary?.conductorName === suggestedConductor) return edge;

        const nextPrimary = currentPrimary
          ? { ...currentPrimary, quantity: 1, conductorName: suggestedConductor }
          : { id: `cond-auto-${Date.now()}-${index}`, quantity: 1, conductorName: suggestedConductor };

        return {
          ...edge,
          edgeChangeFlag: (edge.edgeChangeFlag === "new" ? "new" : "replace") as "new" | "replace",
          removeOnExecution: false,
          replacementFromConductors: edge.replacementFromConductors && edge.replacementFromConductors.length > 0 ? edge.replacementFromConductors : edge.conductors,
          conductors: [nextPrimary],
        };
      });

      const changedCount = nextEdges.reduce((count: number, edge: any, index: number) => (edge !== btTopology.edges[index] ? count + 1 : count), 0);

      if (changedCount === 0) {
        showToast("As sugestões já estavam refletidas na topologia.", "info");
        clearBtTelescopicSuggestions();
        return;
      }

      updateBtTopology({ ...btTopology, edges: nextEdges });
      showToast(`${changedCount} trecho(s) atualizado(s) com sugestões telescópicas na REDE NOVA.`, "success");
      clearBtTelescopicSuggestions();
    },
    [settings.btNetworkScenario, showToast, clearBtTelescopicSuggestions, btTopology, updateBtTopology],
  );

  return {
    lastAppliedDgResults,
    handleRunDgOptimization,
    handleAcceptDgAll,
    handleAcceptDgTrafoOnly,
    handleDiscardDgResult,
    handleTriggerTelescopicAnalysis,
    handleApplyTelescopicSuggestions,
  };
}
