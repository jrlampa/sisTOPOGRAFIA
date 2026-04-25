import React from "react";
import {
  GlobalState,
  BtEditorMode,
  BtNetworkScenario,
  GeoLocation,
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
import { EMPTY_BT_TOPOLOGY } from "./utils/btNormalization";
import { SidebarBtEditorSection } from "./components/SidebarBtEditorSection";
import { SidebarAnalysisResults } from "./components/SidebarAnalysisResults";
import { SidebarSelectionControls } from "./components/SidebarSelectionControls";
import { BtModalStack } from "./components/BtModalStack";
import { BtTelescopicSuggestionModal } from "./components/BtTelescopicSuggestionModal";
import { AppShellLayout } from "./components/AppShellLayout";
import { INITIAL_APP_STATE } from "./app/initialState";
import { persistAppSettings } from "./utils/preferencesPersistence";
import { mergeMtTopologyWithBtPoles } from "./utils/mtTopologyBridge";
import { synchronizeGlobalTopologyState } from "./utils/synchronizeGlobalTopologyState";
import { selectMapTopologyRenderSources } from "./utils/selectMapTopologyRenderSources";
import type { CriticalConfirmationConfig } from "./components/BtModals";

function App() {
  const {
    state: appState,
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
    ) => {
      setAppStateBase((prev) => {
        const resolvedNext =
          typeof nextState === "function" ? nextState(prev) : nextState;
        return synchronizeGlobalTopologyState(resolvedNext);
      }, addToHistory);
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
  const hasBtPoles = btTopology.poles.length > 0;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    handleResetBtTopology,
    resetConfirmOpen,
    setResetConfirmOpen,
    handleConfirmResetBtTopology,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    validateBtBeforeExport,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
  } = useBtCrudHandlers({ 
    appState, 
    setAppState, 
    showToast,
    onSelectedPoleChange: handleBtSelectedPoleChange,
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
  } = useMtCrudHandlers({ appState, setAppState, showToast });

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
    applyDgAll,
    applyDgTrafoOnly,
  } = useDgOptimization();

  const handleRunDgOptimization = React.useCallback(() => {
    void runDgOptimization(btTopology);
  }, [runDgOptimization, btTopology]);

  const handleAcceptDgAll = React.useCallback(
    (scenario: DgScenario) => {
      updateBtTopology(applyDgAll(btTopology, scenario));
      clearDgResult();
      showToast(
        "Solução DG aplicada: trafo + condutores atualizados.",
        "success",
      );
    },
    [applyDgAll, btTopology, updateBtTopology, clearDgResult, showToast],
  );

  const handleAcceptDgTrafoOnly = React.useCallback(
    (scenario: DgScenario) => {
      updateBtTopology(applyDgTrafoOnly(btTopology, scenario));
      clearDgResult();
      showToast("Posição do trafo atualizada pelo DG.", "success");
    },
    [applyDgTrafoOnly, btTopology, updateBtTopology, clearDgResult, showToast],
  );

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
    enabled: true,
  });

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
    updateSettings,
    btNetworkScenario,
    btEditorMode,
    btTopology,
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
    onClearDgResult: clearDgResult,
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

  return (
    <>
      <AppShellLayout
        locale={settings.locale}
        isDark={isDark}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onSaveProject={handleSaveProject}
        onOpenProject={handleLoadProject}
        onOpenSettings={openSettings}
        appStatusStackProps={{
          toast,
          closeToast,
          sessionDraft,
          handleRestoreSession,
          handleDismissSession,
          isProcessing,
          isDownloading,
          progressValue,
          statusMessage,
          showDxfProgress,
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
            onMtEditorModeChange: (mode) =>
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
        }}
      />

      <BtTelescopicSuggestionModal
        output={btTelescopicSuggestions}
        onApply={handleApplyTelescopicSuggestions}
        onCancel={clearBtTelescopicSuggestions}
      />
    </>
  );
}

export default App;
