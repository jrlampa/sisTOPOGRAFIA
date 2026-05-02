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
import { useAppOrchestrator } from "./hooks/useAppOrchestrator";
import { useAppGlobalHotkeys } from "./hooks/useAppGlobalHotkeys";
import { useAppCommandPalette } from "./hooks/useAppCommandPalette";
import { useAppMapSelectorProps } from "./hooks/useAppMapSelectorProps";
import { useAppSidebarProps } from "./hooks/useAppSidebarProps";
import { useAppInspectedElement } from "./hooks/useAppInspectedElement";
import { useAppBimInspector } from "./hooks/useAppBimInspector";
import { useAppEngineeringWorkflows } from "./hooks/useAppEngineeringWorkflows";
import { useAppElectricalAudit } from "./hooks/useAppElectricalAudit";
import { useAppLifecycleEffects } from "./hooks/useAppLifecycleEffects";
import { useAppMainHandlers } from "./hooks/useAppMainHandlers";
import { useAppTopologySources } from "./hooks/useAppTopologySources";
import type { DgScenario } from "./hooks/useDgOptimization";
import type { DgWizardParams } from "./components/DgWizardModal";
import { EMPTY_BT_TOPOLOGY } from "./utils/btNormalization";
import { AppShellLayout } from "./components/AppShellLayout";
import { AppWorkspace } from "./components/AppWorkspace";
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
const BimInspectorDrawer = React.lazy(() =>
  import("./components/BimInspectorDrawer").then((m) => ({
    default: m.BimInspectorDrawer,
  })),
);

function App() {
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isFocusModeManual, setIsFocusModeManual] = React.useState(false);

  const {
    appState,
    appPast,
    appFuture,
    setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot,
  } = useAppOrchestrator();

  // Derived state
  const { center, radius, selectionMode, polygon, settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btNetworkScenario: BtNetworkScenario =
    settings.btNetworkScenario ?? "asis";
  const isDark = settings.theme === "dark";
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? "none";
    const { mtTopology, mapRenderSources, dgTopologySource } = useAppTopologySources({ appState, btTopology });
  const hasBtPoles = btTopology.poles.length > 0;

  const [isXRayMode, setIsXRayMode] = React.useState(false);

  const isFocusMode =
    isFocusModeManual ||
    (settings.enableFocusMode &&
      btEditorMode !== "none" &&
      btEditorMode !== undefined);

  useAppGlobalHotkeys(setIsFocusModeManual, setIsXRayMode);

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

  useAppLifecycleEffects({ settings, isDark, btTopology, btSectioningImpact, showToast, setAppState });

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


  const { isBimInspectorOpen, setIsBimInspectorOpen, inspectedPole, inspectedTransformer, inspectedAccumulatedData } = useAppBimInspector({ selectedPoleId, selectedPoleIds, btTopology, btAccumulatedByPole });
  const {
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
    selectedPoleIds,
    selectedEdgeId,
    selectedTransformerId,
    handleBtSelectedEdgeChange,
    handleBtSelectedPoleChange,
    handleBtSelectedTransformerChange,
    setSelectedPoleId,
    setSelectedPoleIds,
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
    lastAppliedDgResults,
    handleRunDgOptimization,
    handleAcceptDgAll,
    handleAcceptDgTrafoOnly,
    handleDiscardDgResult,
    handleTriggerTelescopicAnalysis,
    handleApplyTelescopicSuggestions,
  } = useAppEngineeringWorkflows({
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
  });


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

  const { setBtEditorMode, setBtNetworkScenario, handleBoxSelect } = useAppMainHandlers({ setAppState, btTopology, setSelectedPoleIds, setSelectedPoleId, setIsCommandPaletteOpen });

  const mapSelectorProps = useAppMapSelectorProps({ center, btEdgeFlyToTarget, btPoleFlyToTarget, btTransformerFlyToTarget, radius, selectionMode, polygonPoints, handleMapClick, btEditorMode, mapRenderSources, handleBtMapClick, handleBtContextAction, pendingBtEdgeStartPoleId, confirmDeletePole, confirmDeleteEdge, confirmDeleteTransformer, handleBtSetEdgeChangeFlag, handleBtToggleTransformerOnPole, handleBtQuickAddPoleRamal, confirmQuickRemovePoleRamal, handleBtQuickAddEdgeConductor, confirmQuickRemoveEdgeConductor, handleBtSetEdgeLengthMeters, handleBtSetEdgeReplacementFromConductors, handleBtRenamePole, handleBtRenameTransformer, handleBtSetPoleVerified, handleBtSetPoleChangeFlag, handleBtTogglePoleCircuitBreak, handleBtSetTransformerChangeFlag, handleBtDragPole, handleBtDragTransformer, btCriticalPoleId, btNetworkScenario, btSectioningImpact, btAccumulatedByPole, osmData, handlePolygonChange, measurePathPoints, handleMeasurePathChange, handleKmlDrop, settings, handleMtMapClick, handleMtContextAction, handleMtDeletePole, handleMtDeleteEdge, handleMtRenamePole, handleMtSetPoleVerified, handleMtDragPole, handleMtSetPoleChangeFlag, handleMtSetEdgeChangeFlag, handleBtSelectedPoleChange, dgActiveScenario, isPreviewActive, handleBoxSelect });

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

  const { sidebarSelectionControlsProps, sidebarBtEditorSectionProps, sidebarAnalysisResultsProps } = useAppSidebarProps({ settings, center, searchQuery, setSearchQuery, isSearching, handleSearch, selectionMode, handleSelectionModeChange, radius, handleRadiusChange, saveSnapshot, handleFetchAndAnalyze, isProcessing, isPolygonValid, setBtNetworkScenario, setBtEditorMode, btNetworkScenario, btEditorMode, btTopology, dgTopologySource, btAccumulatedByPole, btSummary, btPointDemandKva, btTransformerDebugById, btPoleCoordinateInput, setBtPoleCoordinateInput, handleBtInsertPoleByCoordinates, pendingNormalClassificationPoles, handleResetBtTopology, updateBtTopology, updateProjectType, updateClandestinoAreaM2, handleBtSelectedPoleChange, handleBtSelectedTransformerChange, handleBtSelectedEdgeChange, handleBtRenamePole, handleBtRenameTransformer, handleBtSetEdgeChangeFlag, handleBtSetPoleChangeFlag, handleBtTogglePoleCircuitBreak, handleBtSetTransformerChangeFlag, btClandestinoDisplay, btTransformersDerived, requestCriticalConfirmation, handleTriggerTelescopicAnalysis, isDgOptimizing, dgResult, dgError, dgActiveAltIndex, handleRunDgOptimization, handleAcceptDgAll, handleAcceptDgTrafoOnly, handleDiscardDgResult, setDgActiveAltIndex, isPreviewActive, setIsPreviewActive, selectedPoleId, selectedPoleIds, selectedEdgeId, selectedTransformerId, setSelectedPoleId, setSelectedPoleIds, setSelectedEdgeId, setSelectedTransformerId, mtTopology, osmData, stats, analysisText, terrainData, error, handleDownloadDxf, handleDownloadCoordinatesCsv, isDownloading, showToast });

  const { commandPaletteActions, handleGoToPole } = useAppCommandPalette({
    locale: settings.locale,
    handleSaveProject,
    handleLoadProject,
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    handleResetBtTopology,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    undo,
    redo,
    setIsHelpOpen,
    openSettings,
    isFocusModeManual,
    setIsFocusModeManual,
    handleRunDgOptimization,
    handleTriggerTelescopicAnalysis,
    setBtNetworkScenario,
    setBtEditorMode,
    setSelectedPoleId,
    setIsCommandPaletteOpen,
  });

  const inspectedElement = useAppInspectedElement({ selectedPoleId, selectedTransformerId, selectedEdgeId, btTopology, btAccumulatedByPole });
  const {
    isAuditOpen,
    setIsAuditOpen,
    selectedAuditElement,
    handleAuditAction,
  } = useAppElectricalAudit({ showToast, settings });

    return (
    <AppWorkspace
      {...{
        settings,
        isDark,
        isFocusMode,
        isXRayMode,
        canUndo,
        canRedo,
        undo,
        redo,
        appPast,
        appFuture,
        handleSaveProject,
        handleLoadProject,
        openSettings,
        setIsHelpOpen,
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
        latestBtExport,
        btExportHistory,
        exportBtHistoryJson,
        exportBtHistoryCsv,
        handleClearBtExportHistory,
        btHistoryTotal,
        btHistoryLoading,
        btHistoryCanLoadMore,
        handleLoadMoreBtHistory,
        btHistoryProjectTypeFilter,
        setBtHistoryProjectTypeFilter,
        btHistoryCqtScenarioFilter,
        setBtHistoryCqtScenarioFilter,
        updateSettings,
        selectionMode,
        handleSelectionModeChange,
        radius,
        handleRadiusChange,
        polygon,
        handleClearPolygon,
        osmData,
        handleDownloadDxf,
        handleDownloadGeoJSON,
        isSidebarDockedForRamalModal,
        sidebarSelectionControlsProps,
        sidebarBtEditorSectionProps,
        mtTopology,
        updateMtTopology,
        hasBtPoles,
        sidebarAnalysisResultsProps,
        mapSelectorProps,
        elevationProfileData,
        clearProfile,
        btModalStackProps,
        showToast,
        isBimInspectorOpen,
        setIsBimInspectorOpen,
        inspectedPole,
        inspectedTransformer,
        inspectedAccumulatedData,
        btTopology,
        handleBtRenamePole,
        handleBtSetPoleChangeFlag,
        autoSaveStatus,
        lastAutoSaved,
        isAuditOpen,
        setIsAuditOpen,
        selectedAuditElement,
        handleAuditAction,
        btTelescopicSuggestions,
        handleApplyTelescopicSuggestions,
        clearBtTelescopicSuggestions,
        isHelpOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        commandPaletteActions,
        handleGoToPole,
        terrainData,
        showSettings,
        closeSettings,
      }}
    />
  );
}

export default App;
