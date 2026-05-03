import React, { useMemo } from "react";
import {
  BtEditorMode,
  BtNetworkScenario,
  GeoLocation,
} from "./types";
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
import { useAppSidebarProps } from "./hooks/useAppSidebarProps";
import { useAppBimInspector } from "./hooks/useAppBimInspector";
import { useAppEngineeringWorkflows } from "./hooks/useAppEngineeringWorkflows";
import { useAppElectricalAudit } from "./hooks/useAppElectricalAudit";
import { useAppLifecycleEffects } from "./hooks/useAppLifecycleEffects";
import { useAppMainHandlers } from "./hooks/useAppMainHandlers";
import { useAppTopologySources } from "./hooks/useAppTopologySources";
import { EMPTY_BT_TOPOLOGY } from "./utils/btNormalization";
import { AppWorkspace } from "./components/AppWorkspace";
import type { CriticalConfirmationConfig } from "./components/BtModals";

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

  const { center, radius, selectionMode, settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btNetworkScenario: BtNetworkScenario = settings.btNetworkScenario ?? "asis";
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

  useAppGlobalHotkeys(
    setIsFocusModeManual,
    setIsXRayMode,
    settings.theme,
    (theme) => updateSettings({ ...settings, theme })
  );

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

  const { status: autoSaveStatus, lastSaved: lastAutoSaved } = useAutoSave(appState);

  const {
    profileData: elevationProfileData,
    loadProfile: loadElevationProfile,
    clearProfile,
  } = useElevationProfile();

  const {
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
    toasts,
    showToast,
    closeToast,
  } = useMapState({
    appState,
    setAppState,
    clearData,
    loadElevationProfile,
    clearProfile,
  });

  useAppLifecycleEffects({ settings, isDark, btTopology, btSectioningImpact, showToast, setAppState });
  useMapUrlState({ appState, setAppState });

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
    handleSelectAllInPolygon,
    setSelectedPoleId,
    setSelectedPoleIds,
    setSelectedEdgeId,
    setSelectedTransformerId,
  } = useBtNavigationState({ btTopology, showToast });

  React.useEffect(() => {
    if (isPolygonValid && appState.selectionMode === "polygon") {
      handleSelectAllInPolygon(
        polygonPoints.map((p) => ({ lat: p[0], lng: p[1] })),
      );
    }
  }, [isPolygonValid, polygonPoints, appState.selectionMode, handleSelectAllInPolygon]);

  const {
    btExportHistory,
    btHistoryTotal,
    latestBtExport,
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
    projectType: settings.projectType === "clandestino" ? "clandestino" : "ramais",
  });

  const { isBimInspectorOpen, setIsBimInspectorOpen, inspectedPole, inspectedTransformer, inspectedAccumulatedData } = useAppBimInspector({ selectedPoleId, selectedPoleIds, btTopology, btAccumulatedByPole });

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

  const [criticalConfirmationModal, setCriticalConfirmationModal] = React.useState<CriticalConfirmationConfig | null>(null);

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
    (action: "add-edge" | "add-transformer" | "add-pole", location: GeoLocation) => {
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
    [handleBtMapClickAddEdge, handleBtMapClickAddTransformer, insertBtPoleAtLocation],
  );

  const {
    isOptimizing: isDgOptimizing,
    result: dgResult,
    error: dgError,
    activeAltIndex: dgActiveAltIndex,
    runDgOptimization,
    applyDgAll,
    applyDgTrafoOnly,
    clearDgResult,
    logDgDecision,
    setActiveAltIndex: setDgActiveAltIndex,
    activeScenario: dgActiveScenario,
    isPreviewActive,
    setIsPreviewActive,
  } = useDgOptimization();

  const {
    isAnalyzing: isBtTelescopicAnalyzing,
    suggestions: btTelescopicSuggestions,
    triggerAnalysis: triggerBtTelescopicAnalysis,
    clearSuggestions: clearBtTelescopicSuggestions,
  } = useBtTelescopicAnalysis();

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
    polygon: appState.polygon,
    settings,
    btTopology,
    btNetworkScenario,
    hasOsmData: !!osmData,
    validateBtBeforeExport,
    showToast,
    ingestBtContextHistory,
    dgResults: lastAppliedDgResults || undefined,
  });

  const { handleKmlDrop, handleSaveProject, handleLoadProject } = useProjectDataWorkflow({
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

  useKeyboardShortcuts({
    onCancel: () => {
      updateSettings({ ...settings, btEditorMode: "none" });
      handleSelectionModeChange("circle");
    },
    onSetEditorMode: (mode) => updateSettings({ ...settings, btEditorMode: mode }),
    onSetSelectionMode: (mode) => handleSelectionModeChange(mode),
    onUndo: undo,
    onRedo: redo,
    onToggleHelp: () => setIsHelpOpen((current) => !current),
    enabled: true,
  });

  const { setBtEditorMode, setBtNetworkScenario, handleBoxSelect } = useAppMainHandlers({ setAppState, btTopology, setSelectedPoleIds, setSelectedPoleId, setIsCommandPaletteOpen });

  const mapSelectorProps = useMemo(() => ({
    center,
    btEdgeFlyToTarget,
    btPoleFlyToTarget,
    btTransformerFlyToTarget,
    radius,
    selectionMode,
    polygonPoints,
    handleMapClick,
    btEditorMode,
    mapRenderSources,
    handleBtMapClick,
    handleBtContextAction,
    pendingBtEdgeStartPoleId,
    confirmDeletePole,
    confirmDeleteEdge,
    confirmDeleteTransformer,
    handleBtSetEdgeChangeFlag,
    handleBtToggleTransformerOnPole,
    handleBtQuickAddPoleRamal,
    confirmQuickRemovePoleRamal,
    handleBtQuickAddEdgeConductor,
    confirmQuickRemoveEdgeConductor,
    handleBtSetEdgeLengthMeters,
    handleBtSetEdgeReplacementFromConductors,
    handleBtRenamePole,
    handleBtRenameTransformer,
    handleBtSetPoleVerified,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtSetTransformerChangeFlag,
    handleBtDragPole,
    handleBtDragTransformer,
    btCriticalPoleId,
    btNetworkScenario,
    btSectioningImpact,
    btAccumulatedByPole,
    osmData,
    handlePolygonChange,
    measurePathPoints,
    handleMeasurePathChange,
    handleKmlDrop,
    settings,
    handleMtMapClick,
    handleMtContextAction,
    handleMtDeletePole,
    handleMtDeleteEdge,
    handleMtRenamePole,
    handleMtSetPoleVerified,
    handleMtDragPole,
    handleMtSetPoleChangeFlag,
    handleMtSetEdgeChangeFlag,
    handleBtSelectedPoleChange,
    dgActiveScenario,
    isPreviewActive,
    handleBoxSelect,
    locale: settings.locale,
  }), [
    center, btEdgeFlyToTarget, btPoleFlyToTarget, btTransformerFlyToTarget, radius,
    selectionMode, polygonPoints, handleMapClick, btEditorMode, mapRenderSources,
    handleBtMapClick, handleBtContextAction, pendingBtEdgeStartPoleId, confirmDeletePole,
    confirmDeleteEdge, confirmDeleteTransformer, handleBtSetEdgeChangeFlag,
    handleBtToggleTransformerOnPole, handleBtQuickAddPoleRamal, confirmQuickRemovePoleRamal,
    handleBtQuickAddEdgeConductor, confirmQuickRemoveEdgeConductor, handleBtSetEdgeLengthMeters,
    handleBtSetEdgeReplacementFromConductors, handleBtRenamePole, handleBtRenameTransformer,
    handleBtSetPoleVerified, handleBtSetPoleChangeFlag, handleBtTogglePoleCircuitBreak,
    handleBtSetTransformerChangeFlag, handleBtDragPole, handleBtDragTransformer,
    btCriticalPoleId, btNetworkScenario, btSectioningImpact, btAccumulatedByPole,
    osmData, handlePolygonChange, measurePathPoints, handleMeasurePathChange,
    handleKmlDrop, settings, handleMtMapClick, handleMtContextAction, handleMtDeletePole,
    handleMtDeleteEdge, handleMtRenamePole, handleMtSetPoleVerified, handleMtDragPole,
    handleMtSetPoleChangeFlag, handleMtSetEdgeChangeFlag, handleBtSelectedPoleChange,
    dgActiveScenario, isPreviewActive, handleBoxSelect
  ]);

  const btModalStackProps = useMemo(() => ({
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
    locale: settings.locale,
  }), [
    normalRamalModal, handleConfirmNormalRamalModal, clandestinoToNormalModal,
    handleClandestinoToNormalClassifyLater, handleClandestinoToNormalConvertNow,
    normalToClandestinoModal, handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients, resetConfirmOpen,
    handleConfirmResetBtTopology, criticalConfirmationModal,
    closeCriticalConfirmationModal, settings.locale, setClandestinoToNormalModal,
    setNormalRamalModal, setNormalToClandestinoModal, setResetConfirmOpen
  ]);

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

  const {
    isAuditOpen,
    setIsAuditOpen,
    selectedAuditElement,
    handleAuditAction,
  } = useAppElectricalAudit({ showToast, settings });

  const handleGoToPoleWrapper = React.useCallback((poleId: string) => {
    handleGoToPole(poleId);
  }, [handleGoToPole]);

  return (
    <AppWorkspace
      settings={settings}
      isDark={isDark}
      isFocusMode={isFocusMode}
      isXRayMode={isXRayMode}
      canUndo={canUndo}
      canRedo={canRedo}
      undo={undo}
      redo={redo}
      appPast={appPast}
      appFuture={appFuture}
      handleSaveProject={handleSaveProject}
      handleLoadProject={handleLoadProject}
      openSettings={openSettings}
      setIsHelpOpen={setIsHelpOpen}
      toasts={toasts}
      closeToast={closeToast}
      sessionDraft={sessionDraft}
      handleRestoreSession={handleRestoreSession}
      handleDismissSession={handleDismissSession}
      isProcessing={isProcessing}
      isDownloading={isDownloading}
      progressValue={progressValue}
      statusMessage={statusMessage}
      showDxfProgress={showDxfProgress}
      dxfProgressValue={dxfProgressValue}
      dxfProgressStatus={dxfProgressStatus}
      dxfProgressLabel={dxfProgressLabel}
      latestBtExport={latestBtExport}
      btExportHistory={btExportHistory}
      exportBtHistoryJson={exportBtHistoryJson}
      exportBtHistoryCsv={exportBtHistoryCsv}
      handleClearBtExportHistory={handleClearBtExportHistory}
      btHistoryTotal={btHistoryTotal}
      btHistoryLoading={btHistoryLoading}
      btHistoryCanLoadMore={btHistoryCanLoadMore}
      handleLoadMoreBtHistory={handleLoadMoreBtHistory}
      btHistoryProjectTypeFilter={btHistoryProjectTypeFilter}
      setBtHistoryProjectTypeFilter={setBtHistoryProjectTypeFilter}
      btHistoryCqtScenarioFilter={btHistoryCqtScenarioFilter}
      setBtHistoryCqtScenarioFilter={setBtHistoryCqtScenarioFilter}
      updateSettings={updateSettings}
      selectionMode={selectionMode}
      handleSelectionModeChange={handleSelectionModeChange}
      radius={radius}
      handleRadiusChange={handleRadiusChange}
      polygon={appState.polygon}
      handleClearPolygon={handleClearPolygon}
      osmData={osmData}
      handleDownloadDxf={handleDownloadDxf}
      handleDownloadGeoJSON={handleDownloadGeoJSON}
      isSidebarDockedForRamalModal={isSidebarDockedForRamalModal}
      sidebarSelectionControlsProps={sidebarSelectionControlsProps}
      sidebarBtEditorSectionProps={sidebarBtEditorSectionProps}
      mtTopology={mtTopology}
      updateMtTopology={updateMtTopology}
      hasBtPoles={hasBtPoles}
      sidebarAnalysisResultsProps={sidebarAnalysisResultsProps}
      mapSelectorProps={mapSelectorProps}
      elevationProfileData={elevationProfileData}
      clearProfile={clearProfile}
      btModalStackProps={btModalStackProps}
      showToast={showToast}
      isBimInspectorOpen={isBimInspectorOpen}
      setIsBimInspectorOpen={setIsBimInspectorOpen}
      inspectedPole={inspectedPole}
      inspectedTransformer={inspectedTransformer}
      inspectedAccumulatedData={inspectedAccumulatedData}
      btTopology={btTopology}
      handleBtRenamePole={handleBtRenamePole}
      handleBtSetPoleChangeFlag={handleBtSetPoleChangeFlag}
      autoSaveStatus={autoSaveStatus}
      lastAutoSaved={lastAutoSaved}
      isAuditOpen={isAuditOpen}
      setIsAuditOpen={setIsAuditOpen}
      selectedAuditElement={selectedAuditElement}
      handleAuditAction={handleAuditAction}
      btTelescopicSuggestions={btTelescopicSuggestions}
      handleApplyTelescopicSuggestions={handleApplyTelescopicSuggestions}
      clearBtTelescopicSuggestions={clearBtTelescopicSuggestions}
      isHelpOpen={isHelpOpen}
      isCommandPaletteOpen={isCommandPaletteOpen}
      setIsCommandPaletteOpen={setIsCommandPaletteOpen}
      commandPaletteActions={commandPaletteActions}
      handleGoToPole={handleGoToPoleWrapper}
      terrainData={terrainData}
      showSettings={showSettings}
      closeSettings={closeSettings}
    />
  );
}

export default App;
