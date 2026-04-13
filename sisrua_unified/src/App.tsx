import React from "react";
import { GlobalState, BtEditorMode, BtNetworkScenario } from "./types";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useOsmEngine } from "./hooks/useOsmEngine";
import { useElevationProfile } from "./hooks/useElevationProfile";
import { useAutoSave } from "./hooks/useAutoSave";
import { useMapState } from "./hooks/useMapState";
import { useBtNavigationState } from "./hooks/useBtNavigationState";
import { useBtCrudHandlers } from "./hooks/useBtCrudHandlers";
import { useBtDerivedState } from "./hooks/useBtDerivedState";
import { useBtExportHistory } from "./hooks/useBtExportHistory";
import { useBtDxfWorkflow } from "./hooks/useBtDxfWorkflow";
import { useProjectDataWorkflow } from "./hooks/useProjectDataWorkflow";
import { useAppAnalysisWorkflow } from "./hooks/useAppAnalysisWorkflow";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { EMPTY_BT_TOPOLOGY } from "./utils/btNormalization";
import { SidebarBtEditorSection } from "./components/SidebarBtEditorSection";
import { SidebarAnalysisResults } from "./components/SidebarAnalysisResults";
import { SidebarSelectionControls } from "./components/SidebarSelectionControls";
import { BtModalStack } from "./components/BtModalStack";
import { MainMapWorkspace } from "./components/MainMapWorkspace";
import { SidebarWorkspace } from "./components/SidebarWorkspace";
import { AppShellLayout } from "./components/AppShellLayout";
import { INITIAL_APP_STATE } from "./app/initialState";

function App() {
  const {
    state: appState,
    setState: setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot,
  } = useUndoRedo<GlobalState>(INITIAL_APP_STATE);

  // Derived state
  const { center, radius, selectionMode, polygon, settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btNetworkScenario: BtNetworkScenario =
    settings.btNetworkScenario ?? "asis";
  const isDark = settings.theme === "dark";
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? "none";

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
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

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
    updateProjectType,
    updateClandestinoAreaM2,
    handleBtInsertPoleByCoordinates,
    handleBtMapClick,
    handleBtDeletePole,
    handleBtDeleteEdge,
    handleBtSetEdgeChangeFlag,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtSetTransformerChangeFlag,
    handleBtToggleEdgeRemoval,
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
  } = useBtCrudHandlers({ appState, setAppState, showToast });

  const {
    btEdgeFlyToTarget,
    btPoleFlyToTarget,
    btTransformerFlyToTarget,
    handleBtSelectedEdgeChange,
    handleBtSelectedPoleChange,
    handleBtSelectedTransformerChange,
  } = useBtNavigationState({ btTopology, showToast });

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
      updateSettings({ ...settings, btEditorMode: 'none' });
      handleSelectionModeChange('circle');
    },
    onSetEditorMode: (mode) => updateSettings({ ...settings, btEditorMode: mode }),
    onSetSelectionMode: (mode) => handleSelectionModeChange(mode),
    onUndo: undo,
    onRedo: redo,
    enabled: true,
  });

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
    btTopology,
    onBtMapClick: handleBtMapClick,
    pendingBtEdgeStartPoleId,
    onBtDeletePole: handleBtDeletePole,
    onBtDeleteEdge: handleBtDeleteEdge,
    onBtDeleteTransformer: handleBtDeleteTransformer,
    onBtSetEdgeChangeFlag: handleBtSetEdgeChangeFlag,
    onBtToggleTransformerOnPole: handleBtToggleTransformerOnPole,
    onBtQuickAddPoleRamal: handleBtQuickAddPoleRamal,
    onBtQuickRemovePoleRamal: handleBtQuickRemovePoleRamal,
    onBtQuickAddEdgeConductor: handleBtQuickAddEdgeConductor,
    onBtQuickRemoveEdgeConductor: handleBtQuickRemoveEdgeConductor,
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
    accumulatedByPole: btAccumulatedByPole,
    onPolygonChange: handlePolygonChange,
    measurePath: measurePathPoints,
    onMeasurePathChange: handleMeasurePathChange,
    onKmlDrop: handleKmlDrop,
    mapStyle: settings.mapProvider === "satellite" ? "satellite" : "dark",
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
  };

  const sidebarSelectionControlsProps: React.ComponentProps<
    typeof SidebarSelectionControls
  > = {
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
  };

  const sidebarAnalysisResultsProps: React.ComponentProps<
    typeof SidebarAnalysisResults
  > = {
    osmData,
    stats,
    analysisText,
    terrainData,
    error,
    handleDownloadDxf,
    isDownloading,
    showToast,
  };

  return (
    <AppShellLayout
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
        isSidebarDockedForRamalModal,
        selectionControlsProps: sidebarSelectionControlsProps,
        btEditorSectionProps: sidebarBtEditorSectionProps,
        analysisResultsProps: sidebarAnalysisResultsProps,
      }}
      mainMapWorkspaceProps={{
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
  );
}

export default App;
