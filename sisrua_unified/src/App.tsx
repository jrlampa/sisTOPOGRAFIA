import React from "react";
import {
  GlobalState,
  BtEditorMode,
  BtNetworkScenario,
  GeoLocation,
  DgDecisionMode,
  BtTopology,
} from "./types";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useOsmEngine } from "./hooks/useOsmEngine";
import { useElevationProfile } from "./hooks/useElevationProfile";
import { useAutoSave } from "./hooks/useAutoSave";
import { useMapState } from "./hooks/useMapState";
import { useBtNavigationState } from "./hooks/useBtNavigationState";
import { useBtCrudHandlers } from "./hooks/useBtCrudHandlers";
import { useBtDerivedState } from "./hooks/useBtDerivedState";
import { useBtExportHistory } from "./hooks/useBtExportHistory";
import { useMtCrudHandlers } from "./hooks/useMtCrudHandlers";
import { useBtDxfWorkflow } from "./hooks/useBtDxfWorkflow";
import { useProjectDataWorkflow } from "./hooks/useProjectDataWorkflow";
import { useAppAnalysisWorkflow } from "./hooks/useAppAnalysisWorkflow";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useBtCriticalConfirmations } from "./hooks/useBtCriticalConfirmations";
import { useBtTelescopicAnalysis } from "./hooks/useBtTelescopicAnalysis";
import { useMapUrlState } from "./hooks/useMapUrlState";
import { useDgOptimization } from "./hooks/useDgOptimization";
import type { DgScenario } from "./hooks/useDgOptimization";
import type { DgWizardParams } from "./components/DgWizardModal";
import { EMPTY_BT_TOPOLOGY } from "./utils/btNormalization";
import { AppShellLayout } from "./components/AppShellLayout";
import { GuidedTaskChecklist } from "./components/GuidedTaskChecklist";
import { INITIAL_APP_STATE } from "./app/initialState";
import { persistAppSettings } from "./utils/preferencesPersistence";
import { mergeMtTopologyWithBtPoles } from "./utils/mtTopologyBridge";
import { synchronizeGlobalTopologyState } from "./utils/synchronizeGlobalTopologyState";
import { selectMapTopologyRenderSources } from "./utils/selectMapTopologyRenderSources";
import type { CriticalConfirmationConfig } from "./components/BtModals";
import { getCommandPaletteText } from "./i18n/commandPaletteText";

// ─── Lazy components (Audit P1: Routing & Bundle Optimization) ──────────
const SidebarBtEditorSection = React.lazy(() =>
  import("./components/SidebarBtEditorSection").then((m) => ({
    default: m.SidebarBtEditorSection,
  })),
);
const SidebarAnalysisResults = React.lazy(() =>
  import("./components/SidebarAnalysisResults").then((m) => ({
    default: m.SidebarAnalysisResults,
  })),
);
const SidebarSelectionControls = React.lazy(() =>
  import("./components/SidebarSelectionControls").then((m) => ({
    default: m.SidebarSelectionControls,
  })),
);
const BtModalStack = React.lazy(() =>
  import("./components/BtModalStack").then((m) => ({
    default: m.BtModalStack,
  })),
);
const BtTelescopicSuggestionModal = React.lazy(() =>
  import("./components/BtTelescopicSuggestionModal").then((m) => ({
    default: m.BtTelescopicSuggestionModal,
  })),
);
const HelpModal = React.lazy(() =>
  import("./components/HelpModal").then((m) => ({ default: m.HelpModal })),
);
const CommandPalette = React.lazy(() =>
  import("./components/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);
const ElectricalAuditDrawer = React.lazy(() =>
  import("./components/ElectricalAuditDrawer").then((m) => ({
    default: m.ElectricalAuditDrawer,
  })),
);

function App() {
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isFocusModeManual, setIsFocusModeManual] = React.useState(false);

  const {
    state: appState,
    past: appPast,
    future: appFuture,
    setState: setAppStateBase,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot,
  } = useUndoRedo<GlobalState>(
    synchronizeGlobalTopologyState(INITIAL_APP_STATE),
  );

  const setAppState = React.useCallback(
    (
      nextState: GlobalState | ((prev: GlobalState) => GlobalState),
      addToHistory = true,
      actionLabel = "Ação",
    ) => {
      setAppStateBase(
        (prev) => {
          const resolvedNext =
            typeof nextState === "function" ? nextState(prev) : nextState;
          return synchronizeGlobalTopologyState(resolvedNext);
        },
        addToHistory,
        actionLabel,
      );
    },
    [setAppStateBase],
  );

  // Derived state
  const { center, radius, selectionMode, polygon, settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btNetworkScenario: BtNetworkScenario =
    settings.btNetworkScenario ?? "asis";
  const isDark = settings.theme === "dark";
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? "none";
  const mtTopology = React.useMemo(
    () => mergeMtTopologyWithBtPoles(btTopology, appState.mtTopology),
    [btTopology, appState.mtTopology],
  );
  const mapRenderSources = React.useMemo(
    () =>
      selectMapTopologyRenderSources({
        canonicalTopology: appState.canonicalTopology,
        btTopology,
        mtTopology,
        btTransformers: btTopology.transformers,
      }),
    [appState.canonicalTopology, btTopology, mtTopology],
  );
  const dgTopologySource = React.useMemo<BtTopology>(() => {
    const markerTopology = mapRenderSources.btMarkerTopology;

    return {
      poles: markerTopology.poles.map((pole) => {
        const existingPole = btTopology.poles.find(
          (item) => item.id === pole.id,
        );
        return {
          ...existingPole,
          ...pole,
          ramais: pole.ramais ?? existingPole?.ramais ?? [],
        };
      }),
      transformers: markerTopology.transformers.map((transformer) => {
        const existingTransformer = btTopology.transformers.find(
          (item) => item.id === transformer.id,
        );
        return {
          ...existingTransformer,
          ...transformer,
          readings: transformer.readings ?? existingTransformer?.readings ?? [],
        };
      }),
      edges: markerTopology.edges.map((edge) => {
        const existingEdge = btTopology.edges.find(
          (item) => item.id === edge.id,
        );
        return {
          ...existingEdge,
          ...edge,
          conductors: edge.conductors ?? existingEdge?.conductors ?? [],
        };
      }),
    };
  }, [mapRenderSources.btMarkerTopology, btTopology]);
  const hasBtPoles = btTopology.poles.length > 0;

  const isFocusMode =
    isFocusModeManual ||
    (settings.enableFocusMode &&
      btEditorMode !== "none" &&
      btEditorMode !== undefined);

  // Ctrl+F for Focus Mode
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsFocusModeManual((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const {
    btAccumulatedByPole,
    btTransformerDebugById,
    btCriticalPoleId,
    btSummary,
    btPointDemandKva,
    btSectioningImpact,
    btClandestinoDisplay,
    btTransformersDerived,
  } = useBtDerivedState({ appState, setAppState });

  // Core analysis engine
  const {
    isProcessing,
    progressValue,
    statusMessage,
    osmData,
    terrainData,
    stats,
    analysisText,
    error,
    runAnalysis,
    clearData,
  } = useOsmEngine();

  // Auto-save: persist appState to localStorage with debounce
  const { status: autoSaveStatus, lastSaved: lastAutoSaved } =
    useAutoSave(appState);

  React.useEffect(() => {
    persistAppSettings(settings);
  }, [settings]);

  const {
    profileData: elevationProfileData,
    loadProfile: loadElevationProfile,
    clearProfile,
  } = useElevationProfile();

  const {
    toast,
    closeToast,
    showToast,
    toasts,
    showSettings,
    openSettings,
    closeSettings,
    sessionDraft,
    handleRestoreSession,
    handleDismissSession,
    updateSettings,
    handleMapClick,
    handleSelectionModeChange: handleBaseSelectionModeChange,
    handleMeasurePathChange,
    handleRadiusChange,
    handleClearPolygon,
    handlePolygonChange,
    isPolygonValid,
    polygonPoints,
    measurePathPoints,
  } = useMapState({
    appState,
    setAppState,
    clearData,
    loadElevationProfile,
    clearProfile,
  });

  // Sincroniza centro, raio e modo de seleção com os query params da URL.
  useMapUrlState({ appState, setAppState });

  const previousTransformerCountRef = React.useRef(
    btTopology.transformers.length,
  );

  React.useEffect(() => {
    const previousTransformerCount = previousTransformerCountRef.current;
    const currentTransformerCount = btTopology.transformers.length;
    const hadTransformerRemoval =
      currentTransformerCount < previousTransformerCount;

    if (
      hadTransformerRemoval &&
      btSectioningImpact.unservedPoleIds.length > 0
    ) {
      const unservedPolesCount = btSectioningImpact.unservedPoleIds.length;
      const unservedClients = btSectioningImpact.unservedClients;
      showToast(
        `Atenção: circuito sem transformador (${unservedPolesCount} poste(s), ${unservedClients} cliente(s) sem atendimento).`,
        "error",
      );
    }

    previousTransformerCountRef.current = currentTransformerCount;
  }, [
    btTopology.transformers.length,
    btSectioningImpact.unservedPoleIds.length,
    btSectioningImpact.unservedClients,
    showToast,
  ]);

  // Sync theme with document attribute for CSS variables
  React.useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
    document.documentElement.lang = settings.locale;
    document.documentElement.setAttribute("data-locale", settings.locale);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark, settings.locale]);

  // Escuta mudanças no esquema de cores do sistema operacional.
  // Só aplica se o tema atual ainda coincide com o sistema (usuário não divergiu manualmente).
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const systemTheme = e.matches ? "dark" : "light";
      // Só segue o sistema se o tema atual já estava seguindo-o
      setAppState(
        (prev) => ({
          ...prev,
          settings: { ...prev.settings, theme: systemTheme },
        }),
        false,
      );
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
    // Intencionalmente sem appState/settings nas deps: o listener não deve reagir
    // a mudanças manuais do usuário — apenas a eventos do sistema.
  }, [setAppState]);

  const {
    latestBtExport,
    btExportHistory,
    btHistoryTotal,
    btHistoryLoading,
    btHistoryCanLoadMore,
    btHistoryProjectTypeFilter,
    setBtHistoryProjectTypeFilter,
    btHistoryCqtScenarioFilter,
    setBtHistoryCqtScenarioFilter,
    handleLoadMoreBtHistory,
    handleClearBtExportHistory,
    ingestBtContextHistory,
  } = useBtExportHistory({
    appState,
    setAppState,
    showToast,
    projectType:
      settings.projectType === "clandestino" ? "clandestino" : "ramais",
  });

  const {
    btEdgeFlyToTarget,
    btPoleFlyToTarget,
    btTransformerFlyToTarget,
    selectedPoleId,
    selectedEdgeId,
    selectedTransformerId,
    handleBtSelectedEdgeChange,
    handleBtSelectedPoleChange,
    handleBtSelectedTransformerChange,
    setSelectedPoleId,
    setSelectedEdgeId,
    setSelectedTransformerId,
  } = useBtNavigationState({ btTopology, showToast });

  const {
    btPoleCoordinateInput,
    setBtPoleCoordinateInput,
    pendingBtEdgeStartPoleId,
    clearPendingBtEdge,
    pendingNormalClassificationPoles,
    clandestinoToNormalModal,
    setClandestinoToNormalModal,
    normalToClandestinoModal,
    setNormalToClandestinoModal,
    normalRamalModal,
    setNormalRamalModal,
    isSidebarDockedForRamalModal,
    updateBtTopology,
    onProjectTypeChange: updateProjectType,
    updateClandestinoAreaM2,
    handleBtInsertPoleByCoordinates,
    handleBtMapClick,
    insertBtPoleAtLocation,
    handleBtMapClickAddTransformer,
    handleBtMapClickAddEdge,
    handleBtDeletePole,
    handleBtDeleteEdge,
    handleBtSetEdgeChangeFlag,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtSetTransformerChangeFlag,
    handleBtSetEdgeReplacementFromConductors,
    handleBtDeleteTransformer,
    handleBtToggleTransformerOnPole,
    handleBtDragPole,
    handleBtDragTransformer,
    handleBtRenamePole,
    handleBtRenameTransformer,
    handleBtSetPoleVerified,
    handleBtQuickAddPoleRamal,
    handleBtQuickRemovePoleRamal,
    handleBtQuickAddEdgeConductor,
    handleBtQuickRemoveEdgeConductor,
    handleBtSetEdgeLengthMeters,
    handleConfirmNormalRamalModal,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    handleResetBtTopology,
    resetConfirmOpen,
    setResetConfirmOpen,
    handleConfirmResetBtTopology,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    validateBtBeforeExport,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
  } = useBtCrudHandlers({
    appState,
    setAppState,
    showToast,
    onSelectedPoleChange: handleBtSelectedPoleChange,
    undo,
  });

  const {
    handleMtMapClick,
    handleMtDeletePole,
    handleMtDeleteEdge,
    handleMtRenamePole,
    handleMtSetPoleVerified,
    handleMtDragPole,
    handleMtSetPoleChangeFlag,
    handleMtSetEdgeChangeFlag,
    updateMtTopology,
    insertMtPoleAtLocation: insertMtPoleAtLocationBase,
    findNearestMtPole,
  } = useMtCrudHandlers({ appState, setAppState, showToast, undo });

  const handleMtContextAction = React.useCallback(
    (action: "add-pole" | "add-edge", location: GeoLocation) => {
      if (action === "add-pole") {
        insertMtPoleAtLocationBase(location);
        return;
      }
      handleMtMapClick(location);
    },
    [handleMtMapClick, insertMtPoleAtLocationBase],
  );

  const [criticalConfirmationModal, setCriticalConfirmationModal] =
    React.useState<CriticalConfirmationConfig | null>(null);

  const requestCriticalConfirmation = React.useCallback(
    (config: CriticalConfirmationConfig) => {
      setCriticalConfirmationModal(config);
    },
    [],
  );

  const closeCriticalConfirmationModal = React.useCallback(() => {
    setCriticalConfirmationModal(null);
  }, []);

  const {
    confirmDeletePole,
    confirmDeleteEdge,
    confirmDeleteTransformer,
    confirmQuickRemovePoleRamal,
    confirmQuickRemoveEdgeConductor,
  } = useBtCriticalConfirmations({
    requestCriticalConfirmation,
    handleBtDeletePole,
    handleBtDeleteEdge,
    handleBtDeleteTransformer,
    handleBtQuickRemovePoleRamal,
    handleBtQuickRemoveEdgeConductor,
  });

  const handleBtContextAction = React.useCallback(
    (
      action: "add-edge" | "add-transformer" | "add-pole",
      location: GeoLocation,
    ) => {
      if (action === "add-pole") {
        insertBtPoleAtLocation(location);
        return;
      }

      if (action === "add-transformer") {
        handleBtMapClickAddTransformer(location);
        return;
      }

      handleBtMapClickAddEdge(location);
    },
    [
      handleBtMapClickAddEdge,
      handleBtMapClickAddTransformer,
      insertBtPoleAtLocation,
    ],
  );

  const {
    isAnalyzing: isBtTelescopicAnalyzing,
    suggestions: btTelescopicSuggestions,
    triggerAnalysis: triggerBtTelescopicAnalysis,
    clearSuggestions: clearBtTelescopicSuggestions,
  } = useBtTelescopicAnalysis();

  // Design Generativo – Frente 3 (Frontend)
  const {
    isOptimizing: isDgOptimizing,
    result: dgResult,
    error: dgError,
    activeAltIndex: dgActiveAltIndex,
    setActiveAltIndex: setDgActiveAltIndex,
    activeScenario: dgActiveScenario,
    runDgOptimization,
    clearDgResult,
    logDgDecision,
    applyDgAll,
    applyDgTrafoOnly,
  } = useDgOptimization();

  /** Resultados técnicos do último cenário DG aplicado (para o memorial). */
  const [lastAppliedDgResults, setLastAppliedDgResults] = React.useState<Record<
    string,
    unknown
  > | null>(null);

  const appendDgDecisionHistory = React.useCallback(
    (params: {
      mode: DgDecisionMode;
      runId: string;
      scenarioId?: string;
      score?: number;
      notes?: string;
    }) => {
      setAppState(
        (prev) => ({
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
      showToast(
        "Solução DG aplicada: trafo + condutores atualizados.",
        "success",
      );

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
    [
      dgResult,
      logDgDecision,
      appendDgDecisionHistory,
      applyDgAll,
      dgTopologySource,
      updateBtTopology,
      clearDgResult,
      showToast,
      findNearestMtPole,
    ],
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
    [
      dgResult,
      logDgDecision,
      appendDgDecisionHistory,
      applyDgTrafoOnly,
      dgTopologySource,
      updateBtTopology,
      clearDgResult,
      findNearestMtPole,
      showToast,
    ],
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
  }, [
    dgResult?.runId,
    dgActiveScenario,
    logDgDecision,
    appendDgDecisionHistory,
    clearDgResult,
    showToast,
  ]);

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
      (onConfirm) => {
        requestCriticalConfirmation({
          title: "Executar análise telescópica da REDE NOVA?",
          message:
            "A análise avalia quedas de tensão e sugere substituições de condutores no sentido trafo para ponta.",
          confirmLabel: "Executar análise",
          cancelLabel: "Cancelar",
          tone: "info",
          onConfirm,
        });
      },
    );
  }, [
    isBtTelescopicAnalyzing,
    showToast,
    triggerBtTelescopicAnalysis,
    btTopology,
    btAccumulatedByPole,
    btTransformerDebugById,
    requestCriticalConfirmation,
  ]);

  const handleApplyTelescopicSuggestions = React.useCallback(
    (analysisOutput: NonNullable<typeof btTelescopicSuggestions>) => {
      if ((settings.btNetworkScenario ?? "asis") !== "projeto") {
        showToast(
          "As sugestões telescópicas só podem ser aplicadas na REDE NOVA.",
          "info",
        );
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

      const nextEdges = btTopology.edges.map((edge, index) => {
        const directKey = `${edge.fromPoleId}->${edge.toPoleId}`;
        const reverseKey = `${edge.toPoleId}->${edge.fromPoleId}`;
        const suggestedConductor =
          conductorByEdgeId.get(directKey) ?? conductorByEdgeId.get(reverseKey);

        if (!suggestedConductor) {
          return edge;
        }

        const currentPrimary = edge.conductors[0];
        if (currentPrimary?.conductorName === suggestedConductor) {
          return edge;
        }

        const nextPrimary = currentPrimary
          ? {
              ...currentPrimary,
              quantity: 1,
              conductorName: suggestedConductor,
            }
          : {
              id: `cond-auto-${Date.now()}-${index}`,
              quantity: 1,
              conductorName: suggestedConductor,
            };

        return {
          ...edge,
          edgeChangeFlag: (edge.edgeChangeFlag === "new"
            ? "new"
            : "replace") as "new" | "replace",
          removeOnExecution: false,
          replacementFromConductors:
            edge.replacementFromConductors &&
            edge.replacementFromConductors.length > 0
              ? edge.replacementFromConductors
              : edge.conductors,
          conductors: [nextPrimary],
        };
      });

      const changedCount = nextEdges.reduce(
        (count, edge, index) =>
          edge !== btTopology.edges[index] ? count + 1 : count,
        0,
      );

      if (changedCount === 0) {
        showToast("As sugestões já estavam refletidas na topologia.", "info");
        clearBtTelescopicSuggestions();
        return;
      }

      updateBtTopology({
        ...btTopology,
        edges: nextEdges,
      });

      showToast(
        `${changedCount} trecho(s) atualizado(s) com sugestões telescópicas na REDE NOVA.`,
        "success",
      );
      clearBtTelescopicSuggestions();
    },
    [
      settings.btNetworkScenario,
      showToast,
      clearBtTelescopicSuggestions,
      btTopology,
      updateBtTopology,
    ],
  );

  const {
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
  } = useBtDxfWorkflow({
    center,
    radius,
    selectionMode,
    polygon,
    settings,
    btTopology,
    btNetworkScenario,
    hasOsmData: !!osmData,
    validateBtBeforeExport,
    showToast,
    ingestBtContextHistory,
    dgResults: lastAppliedDgResults || undefined,
  });

  const { handleKmlDrop, handleSaveProject, handleLoadProject } =
    useProjectDataWorkflow({
      appState,
      setAppState,
      clearData,
      clearPendingBtEdge,
      showToast,
    });

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearch,
    handleSelectionModeChange,
    handleFetchAndAnalyze,
    showDxfProgress,
    dxfProgressValue,
    dxfProgressStatus,
    dxfProgressLabel,
  } = useAppAnalysisWorkflow({
    appState,
    setAppState,
    clearData,
    showToast,
    clearPendingBtEdge,
    handleBaseSelectionModeChange,
    runAnalysis,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
  });

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    onCancel: () => {
      updateSettings({ ...settings, btEditorMode: "none" });
      handleSelectionModeChange("circle");
    },
    onSetEditorMode: (mode) =>
      updateSettings({ ...settings, btEditorMode: mode }),
    onSetSelectionMode: (mode) => handleSelectionModeChange(mode),
    onUndo: undo,
    onRedo: redo,
    onToggleHelp: () => setIsHelpOpen((current) => !current),
    enabled: true,
  });

  // Ctrl+K for Command Palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const setBtEditorMode = React.useCallback(
    (mode: BtEditorMode) => {
      setAppState(
        (prev) => ({
          ...prev,
          settings: { ...prev.settings, btEditorMode: mode },
        }),
        true,
        `Modo Editor: ${mode}`,
      );
    },
    [setAppState],
  );

  const setBtNetworkScenario = React.useCallback(
    (scenario: BtNetworkScenario) => {
      setAppState(
        (prev) => ({
          ...prev,
          settings: { ...prev.settings, btNetworkScenario: scenario },
        }),
        true,
        `Cenário: ${scenario}`,
      );
    },
    [setAppState],
  );
  const mapSelectorProps = {
    center,
    flyToEdgeTarget: btEdgeFlyToTarget,
    flyToPoleTarget: btPoleFlyToTarget,
    flyToTransformerTarget: btTransformerFlyToTarget,
    radius,
    selectionMode,
    polygonPoints,
    onLocationChange: handleMapClick,
    btEditorMode,
    btMarkerTopology: mapRenderSources.btMarkerTopology,
    btPopupTopology: mapRenderSources.btPopupTopology,
    onBtMapClick: handleBtMapClick,
    onBtContextAction: handleBtContextAction,
    pendingBtEdgeStartPoleId,
    onBtDeletePole: confirmDeletePole,
    onBtDeleteEdge: confirmDeleteEdge,
    onBtDeleteTransformer: confirmDeleteTransformer,
    onBtSetEdgeChangeFlag: handleBtSetEdgeChangeFlag,
    onBtToggleTransformerOnPole: handleBtToggleTransformerOnPole,
    onBtQuickAddPoleRamal: handleBtQuickAddPoleRamal,
    onBtQuickRemovePoleRamal: confirmQuickRemovePoleRamal,
    onBtQuickAddEdgeConductor: handleBtQuickAddEdgeConductor,
    onBtQuickRemoveEdgeConductor: confirmQuickRemoveEdgeConductor,
    onBtSetEdgeLengthMeters: handleBtSetEdgeLengthMeters,
    onBtSetEdgeReplacementFromConductors:
      handleBtSetEdgeReplacementFromConductors,
    onBtRenamePole: handleBtRenamePole,
    onBtRenameTransformer: handleBtRenameTransformer,
    onBtSetPoleVerified: handleBtSetPoleVerified,
    onBtSetPoleChangeFlag: handleBtSetPoleChangeFlag,
    onBtTogglePoleCircuitBreak: handleBtTogglePoleCircuitBreak,
    onBtSetTransformerChangeFlag: handleBtSetTransformerChangeFlag,
    onBtDragPole: handleBtDragPole,
    onBtDragTransformer: handleBtDragTransformer,
    criticalPoleId: btCriticalPoleId,
    loadCenterPoleId:
      btNetworkScenario === "projeto"
        ? (btSectioningImpact.suggestedPoleId ?? null)
        : null,
    accumulatedByPole: btAccumulatedByPole,
    onPolygonChange: handlePolygonChange,
    measurePath: measurePathPoints,
    onMeasurePathChange: handleMeasurePathChange,
    onKmlDrop: handleKmlDrop,
    mapStyle: settings.mapProvider === "satellite" ? "satellite" : "dark",
    mtMarkerTopology: mapRenderSources.mtMarkerTopology,
    mtPopupTopology: mapRenderSources.mtPopupTopology,
    mtEditorMode: settings.mtEditorMode ?? "none",
    onMtMapClick: handleMtMapClick,
    onMtContextAction: handleMtContextAction,
    onMtDeletePole: handleMtDeletePole,
    onMtDeleteEdge: handleMtDeleteEdge,
    onMtRenamePole: handleMtRenamePole,
    onMtSetPoleVerified: handleMtSetPoleVerified,
    onMtDragPole: handleMtDragPole,
    onMtSetPoleChangeFlag: handleMtSetPoleChangeFlag,
    onMtSetEdgeChangeFlag: handleMtSetEdgeChangeFlag,
    onBtSelectPole: handleBtSelectedPoleChange,
    dgScenario: dgActiveScenario,
    locale: settings.locale,
    layerConfig: settings.layers,
  };

  const btModalStackProps: React.ComponentProps<typeof BtModalStack> = {
    normalRamalModal,
    setNormalRamalModal,
    handleConfirmNormalRamalModal,
    clandestinoToNormalModal,
    setClandestinoToNormalModal,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    normalToClandestinoModal,
    setNormalToClandestinoModal,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
    resetConfirmOpen,
    handleConfirmResetBtTopology,
    setResetConfirmOpen,
    criticalConfirmationModal,
    closeCriticalConfirmationModal,
  };

  const sidebarSelectionControlsProps: React.ComponentProps<
    typeof SidebarSelectionControls
  > = {
    locale: settings.locale,
    center,
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearch,
    selectionMode,
    onSelectionModeChange: handleSelectionModeChange,
    radius,
    onRadiusChange: handleRadiusChange,
    saveSnapshot,
    onAnalyze: handleFetchAndAnalyze,
    isProcessing,
    isPolygonValid,
  };

  const sidebarBtEditorSectionProps: React.ComponentProps<
    typeof SidebarBtEditorSection
  > = {
    locale: settings.locale,
    settings,
    setBtNetworkScenario,
    setBtEditorMode,
    btNetworkScenario,
    btEditorMode,
    btTopology,
    dgTopology: dgTopologySource,
    btAccumulatedByPole,
    btSummary,
    btPointDemandKva,
    btTransformerDebugById,
    btPoleCoordinateInput,
    setBtPoleCoordinateInput,
    handleBtInsertPoleByCoordinates,
    clearPendingBtEdge,
    pendingNormalClassificationPoles,
    handleResetBtTopology,
    updateBtTopology,
    updateProjectType,
    updateClandestinoAreaM2,
    handleBtSelectedPoleChange,
    handleBtSelectedTransformerChange,
    handleBtSelectedEdgeChange,
    handleBtRenamePole,
    handleBtRenameTransformer,
    handleBtSetEdgeChangeFlag,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtSetTransformerChangeFlag,
    btClandestinoDisplay,
    btTransformersDerived,
    requestCriticalConfirmation,
    onTriggerTelescopicAnalysis: handleTriggerTelescopicAnalysis,
    isDgOptimizing,
    dgResult,
    dgError,
    dgActiveAltIndex,
    onRunDgOptimization: handleRunDgOptimization,
    onAcceptDgAll: handleAcceptDgAll,
    onAcceptDgTrafoOnly: handleAcceptDgTrafoOnly,
    onClearDgResult: handleDiscardDgResult,
    onSetDgActiveAltIndex: setDgActiveAltIndex,
    // Hoisted selection state
    selectedPoleId,
    selectedEdgeId,
    selectedTransformerId,
    onSetSelectedPoleId: setSelectedPoleId,
    onSetSelectedEdgeId: setSelectedEdgeId,
    onSetSelectedTransformerId: setSelectedTransformerId,
    mtTopology: mtTopology,
  };

  const sidebarAnalysisResultsProps: React.ComponentProps<
    typeof SidebarAnalysisResults
  > = {
    locale: settings.locale,
    osmData,
    stats,
    analysisText,
    terrainData,
    error,
    handleDownloadDxf,
    handleDownloadCoordinatesCsv,
    isDownloading,
    showToast,
  };

  const handleGoToPole = React.useCallback(
    (poleId: string) => {
      setSelectedPoleId(poleId);
      setIsCommandPaletteOpen(false);
    },
    [setSelectedPoleId],
  );

  const handleOpenProjectFromCommandPalette = React.useCallback(() => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".srua,.json";
    fileInput.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        handleLoadProject(file);
      }
    };
    fileInput.click();
  }, [handleLoadProject]);

  const i18nCmd = React.useMemo(() => getCommandPaletteText(settings.locale), [settings.locale]);

  const commandPaletteActions = React.useMemo(() => [
    {
      id: "save",
      label: i18nCmd.saveProject,
      section: i18nCmd.sectionFile,
      shortcut: "Ctrl+S",
      onSelect: handleSaveProject,
    },
    {
      id: "open",
      label: i18nCmd.openProject,
      section: i18nCmd.sectionFile,
      shortcut: "Ctrl+O",
      onSelect: handleOpenProjectFromCommandPalette,
    },
    {
      id: "dxf",
      label: i18nCmd.exportDxf,
      section: i18nCmd.sectionExport,
      shortcut: "Alt+D",
      onSelect: handleDownloadDxf,
    },
    {
      id: "geojson",
      label: i18nCmd.exportGeoJson,
      section: i18nCmd.sectionExport,
      onSelect: handleDownloadGeoJSON,
    },
    {
      id: "csv",
      label: i18nCmd.exportCsv,
      section: i18nCmd.sectionExport,
      onSelect: handleDownloadCoordinatesCsv,
    },
    {
      id: "reset-topology",
      label: i18nCmd.resetTopology,
      section: i18nCmd.sectionMacros,
      onSelect: handleResetBtTopology,
    },
    {
      id: "export-history",
      label: i18nCmd.exportHistoryJson,
      section: i18nCmd.sectionMacros,
      onSelect: exportBtHistoryJson,
    },
    {
      id: "export-history-csv",
      label: i18nCmd.exportHistoryCsv,
      section: i18nCmd.sectionMacros,
      onSelect: exportBtHistoryCsv,
    },
    {
      id: "undo",
      label: i18nCmd.undo,
      section: i18nCmd.sectionEdit,
      shortcut: "Ctrl+Z",
      onSelect: undo,
    },
    {
      id: "redo",
      label: i18nCmd.redo,
      section: i18nCmd.sectionEdit,
      shortcut: "Ctrl+Y",
      onSelect: redo,
    },
    {
      id: "help",
      label: i18nCmd.openHelp,
      section: i18nCmd.sectionGeneral,
      shortcut: "/",
      onSelect: () => setIsHelpOpen(true),
    },
    {
      id: "settings",
      label: i18nCmd.openSettings,
      section: i18nCmd.sectionGeneral,
      shortcut: "S",
      onSelect: openSettings,
    },
    {
      id: "focus-mode",
      label: isFocusModeManual ? i18nCmd.disableFocusMode : i18nCmd.enableFocusMode,
      section: i18nCmd.sectionGeneral,
      shortcut: "Ctrl+F",
      onSelect: () => setIsFocusModeManual(!isFocusModeManual),
    },
    {
      id: "dg",
      label: i18nCmd.runDgOptimization,
      section: i18nCmd.sectionEngineering,
      onSelect: () => handleRunDgOptimization(),
    },
    {
      id: "telescopic",
      label: i18nCmd.telescopicAnalysis,
      section: i18nCmd.sectionEngineering,
      onSelect: handleTriggerTelescopicAnalysis,
    },
    {
      id: "mode-asis",
      label: i18nCmd.scenarioAsIs,
      section: i18nCmd.sectionVisualization,
      onSelect: () => setBtNetworkScenario("asis"),
    },
    {
      id: "mode-proj",
      label: i18nCmd.scenarioProject,
      section: i18nCmd.sectionVisualization,
      onSelect: () => setBtNetworkScenario("projeto"),
    },
    {
      id: "editor-none",
      label: i18nCmd.exitEditorMode,
      section: i18nCmd.sectionEdit,
      onSelect: () => setBtEditorMode("none"),
    },
    {
      id: "editor-pole",
      label: i18nCmd.modeAddPole,
      section: i18nCmd.sectionEdit,
      shortcut: "P",
      onSelect: () => setBtEditorMode("add-pole"),
    },
    {
      id: "editor-edge",
      label: i18nCmd.modeAddEdge,
      section: i18nCmd.sectionEdit,
      shortcut: "L",
      onSelect: () => setBtEditorMode("add-edge"),
    },
    {
      id: "editor-trafo",
      label: i18nCmd.modeAddTransformer,
      section: i18nCmd.sectionEdit,
      shortcut: "T",
      onSelect: () => setBtEditorMode("add-transformer"),
    },
  ], [
    i18nCmd,
    handleSaveProject,
    handleOpenProjectFromCommandPalette,
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    handleResetBtTopology,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    undo,
    redo,
    openSettings,
    isFocusModeManual,
    handleRunDgOptimization,
    handleTriggerTelescopicAnalysis,
    setBtNetworkScenario,
    setBtEditorMode,
  ]);

  // open audit drawer if electricalAudit layer is enabled and an element is selected
  const [isAuditOpen, setIsAuditOpen] = React.useState(false);

  const selectedAuditElement = React.useMemo(() => {
    if (selectedPoleId) {
      const pole = btTopology.poles.find((p) => p.id === selectedPoleId);
      return { type: "pole" as const, id: selectedPoleId, data: pole };
    }
    if (selectedTransformerId) {
      const transformer = btTopology.transformers.find(
        (t) => t.id === selectedTransformerId,
      );
      return {
        type: "transformer" as const,
        id: selectedTransformerId,
        data: transformer,
      };
    }
    if (selectedEdgeId) {
      const edge = btTopology.edges.find((e) => e.id === selectedEdgeId);
      return { type: "edge" as const, id: selectedEdgeId, data: edge };
    }
    return null;
  }, [
    selectedPoleId,
    selectedTransformerId,
    selectedEdgeId,
    btTopology.poles,
    btTopology.transformers,
    btTopology.edges,
  ]);

  React.useEffect(() => {
    if (settings.layers.electricalAudit && selectedAuditElement) {
      setIsAuditOpen(true);
    } else {
      setIsAuditOpen(false);
    }
  }, [settings.layers.electricalAudit, selectedAuditElement]);

  const handleAuditAction = React.useCallback(
    (action: "approve" | "reject", notes: string) => {
      showToast(
        `Auditoria ${action === "approve" ? "aprovada" : "rejeitada"}: ${notes}`,
        action === "approve" ? "success" : "info",
      );
      setIsAuditOpen(false);
    },
    [showToast],
  );

  return (
    <>
      <AppShellLayout
        locale={settings.locale}
        isDark={isDark}
        isFocusMode={isFocusMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        past={appPast}
        future={appFuture}
        onSaveProject={handleSaveProject}
        onOpenProject={handleLoadProject}
        onOpenSettings={openSettings}
        onOpenHelp={() => setIsHelpOpen(true)}
        appStatusStackProps={{
          toasts,
          closeToast,
          sessionDraft,
          handleRestoreSession,
          handleDismissSession,
          isProcessing,
          isDownloading,
          progressValue,
          statusMessage,
          showDxfProgress,
          dxfProgressValue,
          dxfProgressStatus,
          dxfProgressLabel,
          btExportSummaryProps: {
            latestBtExport,
            btExportHistory,
            exportBtHistoryJson,
            exportBtHistoryCsv,
            clearBtExportHistory: handleClearBtExportHistory,
            btHistoryTotal,
            btHistoryLoading,
            btHistoryCanLoadMore,
            onLoadMoreBtHistory: handleLoadMoreBtHistory,
            historyProjectTypeFilter: btHistoryProjectTypeFilter,
            onHistoryProjectTypeFilterChange: setBtHistoryProjectTypeFilter,
            historyCqtScenarioFilter: btHistoryCqtScenarioFilter,
            onHistoryCqtScenarioFilterChange: setBtHistoryCqtScenarioFilter,
          },
        }}
        appSettingsOverlayProps={{
          showSettings,
          closeSettings,
          settings,
          updateSettings,
          selectionMode,
          handleSelectionModeChange,
          radius,
          handleRadiusChange,
          polygon,
          handleClearPolygon,
          hasData: !!osmData,
          isDownloading,
          handleDownloadDxf,
          handleDownloadGeoJSON,
          handleSaveProject,
          handleLoadProject,
        }}
        sidebarWorkspaceProps={{
          locale: settings.locale,
          isSidebarDockedForRamalModal,
          selectionControlsProps: sidebarSelectionControlsProps,
          btEditorSectionProps: sidebarBtEditorSectionProps,
          mtEditorSectionProps: {
            locale: settings.locale,
            mtTopology,
            onMtTopologyChange: updateMtTopology,
            mtEditorMode: settings.mtEditorMode ?? "none",
            hasBtPoles,
            onMtEditorModeChange: (mode: any) =>
              updateSettings({ ...settings, mtEditorMode: mode }),
          },
          analysisResultsProps: sidebarAnalysisResultsProps,
        }}
        mainMapWorkspaceProps={{
          locale: settings.locale,
          mapSelectorProps,
          floatingLayerPanelProps: {
            settings,
            onUpdateSettings: updateSettings,
            isDark,
          },
          elevationProfileData,
          onCloseElevationProfile: () => {
            clearProfile();
            handleSelectionModeChange("circle");
          },
          isDark,
          btModalStackProps,
          hasAreaSelection: !!osmData,
          onStartSearch: () => {
            setIsHelpOpen(false);
            handleSelectionModeChange("circle");
          },
          onMapClickAction: () => {
            setIsHelpOpen(false);
            handleSelectionModeChange("circle");
            showToast(
              "Clique no mapa para definir o centro da analise.",
              "info",
            );
          },
        }}
        hasAreaSelection={!!osmData}
        onStartSearch={() => {
          setIsHelpOpen(false);
          handleSelectionModeChange("circle");
        }}
        onMapClickAction={() => {
          setIsHelpOpen(false);
          handleSelectionModeChange("circle");
          showToast("Clique no mapa para definir o centro da analise.", "info");
        }}
        autoSaveStatus={autoSaveStatus}
        lastAutoSaved={lastAutoSaved}
      />

      <React.Suspense fallback={null}>
        <ElectricalAuditDrawer
          locale={settings.locale}
          isOpen={isAuditOpen}
          onClose={() => setIsAuditOpen(false)}
          selectedElement={selectedAuditElement}
          onAuditAction={handleAuditAction}
        />

        <BtTelescopicSuggestionModal
          output={btTelescopicSuggestions}
          onApply={handleApplyTelescopicSuggestions}
          onCancel={clearBtTelescopicSuggestions}
        />

        <HelpModal
          isOpen={isHelpOpen}
          locale={settings.locale}
          onClose={() => setIsHelpOpen(false)}
        />

        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          actions={commandPaletteActions}
          poles={btTopology.poles}
          onGoToPole={handleGoToPole}
          locale={settings.locale}
        />
      </React.Suspense>

      {/* Guided onboarding checklist — shown only on first meaningful session */}
      <GuidedTaskChecklist
        tasks={[
          { id: "area", label: "Selecionar área no mapa", done: !!osmData },
          { id: "bt", label: "Lançar rede BT (postes)", done: hasBtPoles },
          {
            id: "terrain",
            label: "Carregar terreno 2.5D",
            done: !!terrainData,
          },
          { id: "export", label: "Exportar DXF", done: false },
        ]}
      />
    </>
  );
}

export default App;
