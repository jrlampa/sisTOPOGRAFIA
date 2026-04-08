import React from 'react';
import { GlobalState, BtEditorMode, BtNetworkScenario } from './types';
import { DEFAULT_LOCATION } from './constants';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useElevationProfile } from './hooks/useElevationProfile';
import { useAutoSave } from './hooks/useAutoSave';
import { useMapState } from './hooks/useMapState';
import { useBtNavigationState } from './hooks/useBtNavigationState';
import { useBtCrudHandlers } from './hooks/useBtCrudHandlers';
import { useBtDerivedState } from './hooks/useBtDerivedState';
import { useBtExportHistory } from './hooks/useBtExportHistory';
import { useBtDxfWorkflow } from './hooks/useBtDxfWorkflow';
import { useProjectDataWorkflow } from './hooks/useProjectDataWorkflow';
import { useAppAnalysisWorkflow } from './hooks/useAppAnalysisWorkflow';
import {
  EMPTY_BT_TOPOLOGY,
} from './utils/btNormalization';
import { AppHeader } from './components/AppHeader';
import { SidebarBtEditorSection } from './components/SidebarBtEditorSection';
import { SidebarAnalysisResults } from './components/SidebarAnalysisResults';
import { SidebarSelectionControls } from './components/SidebarSelectionControls';
import { BtModalStack } from './components/BtModalStack';
import { AppSettingsOverlay } from './components/AppSettingsOverlay';
import { AppStatusStack } from './components/AppStatusStack';
import { MainMapWorkspace } from './components/MainMapWorkspace';
import { SidebarWorkspace } from './components/SidebarWorkspace';

function App() {
  const {
    state: appState,
    setState: setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot
  } = useUndoRedo<GlobalState>({
    center: DEFAULT_LOCATION,
    radius: 500,
    selectionMode: 'circle',
    polygon: [],
    measurePath: [],
    settings: {
      enableAI: true,
      simplificationLevel: 'low',
      orthogonalize: true,
      contourRenderMode: 'spline',
      projection: 'utm',
      theme: 'dark',
      mapProvider: 'vector',
      contourInterval: 5,
      projectType: 'ramais',
      btNetworkScenario: 'asis',
      btEditorMode: 'none',
      btTransformerCalculationMode: 'automatic',
      clandestinoAreaM2: 0,
      layers: {
        buildings: true,
        roads: true,
        curbs: true,
        nature: true,
        terrain: true,
        contours: false,
        slopeAnalysis: false,
        furniture: true,
        labels: true,
        dimensions: false,
        grid: false,
        btNetwork: true
      },
      projectMetadata: {
        projectName: 'PROJECT OSM-01',
        companyName: 'ENG CORP',
        engineerName: 'ENG. LEAD',
        date: new Date().toLocaleDateString('en-US'),
        scale: 'N/A',
        revision: 'R00'
      }
    },
    btTopology: EMPTY_BT_TOPOLOGY,
    btExportSummary: null,
    btExportHistory: []
  });

  // Derived state
  const { center, radius, selectionMode, polygon, settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btNetworkScenario: BtNetworkScenario = settings.btNetworkScenario ?? 'asis';
  const isDark = settings.theme === 'dark';
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? 'none';

  const {
    btAccumulatedByPole,
    btTransformerDebugById,
    btCriticalPoleId,
    btSummary,
    btPointDemandKva,
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

  const { profileData: elevationProfileData, loadProfile: loadElevationProfile, clearProfile } = useElevationProfile();

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
    projectType: settings.projectType === 'clandestino' ? 'clandestino' : 'ramais',
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

  const { handleDownloadDxf, handleDownloadGeoJSON, isDownloading, jobId, jobStatus, jobProgress } = useBtDxfWorkflow({
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
    onBtSetEdgeReplacementFromConductors: handleBtSetEdgeReplacementFromConductors,
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
    mapStyle: settings.mapProvider === 'satellite' ? 'satellite' : 'dark',
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

  const sidebarSelectionControlsProps: React.ComponentProps<typeof SidebarSelectionControls> = {
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

  const sidebarBtEditorSectionProps: React.ComponentProps<typeof SidebarBtEditorSection> = {
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
  };

  const sidebarAnalysisResultsProps: React.ComponentProps<typeof SidebarAnalysisResults> = {
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
    <div className={`flex flex-col h-screen w-full font-sans transition-colors duration-500 overflow-hidden ${isDark ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>

      <AppStatusStack
        toast={toast}
        closeToast={closeToast}
        sessionDraft={sessionDraft}
        handleRestoreSession={handleRestoreSession}
        handleDismissSession={handleDismissSession}
        isProcessing={isProcessing}
        isDownloading={isDownloading}
        progressValue={progressValue}
        statusMessage={statusMessage}
        showDxfProgress={showDxfProgress}
        dxfProgressLabel={dxfProgressLabel}
        btExportSummaryProps={{
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
        }}
      />

      <AppSettingsOverlay
        showSettings={showSettings}
        closeSettings={closeSettings}
        settings={settings}
        updateSettings={updateSettings}
        selectionMode={selectionMode}
        handleSelectionModeChange={handleSelectionModeChange}
        radius={radius}
        handleRadiusChange={handleRadiusChange}
        polygon={polygon}
        handleClearPolygon={handleClearPolygon}
        hasData={!!osmData}
        isDownloading={isDownloading}
        handleDownloadDxf={handleDownloadDxf}
        handleDownloadGeoJSON={handleDownloadGeoJSON}
        handleSaveProject={handleSaveProject}
        handleLoadProject={handleLoadProject}
      />

      {/* Premium Header */}
      <AppHeader
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenSettings={openSettings}
        isDark={isDark}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">

        <SidebarWorkspace
          isSidebarDockedForRamalModal={isSidebarDockedForRamalModal}
          isDark={isDark}
          selectionControlsProps={sidebarSelectionControlsProps}
          btEditorSectionProps={sidebarBtEditorSectionProps}
          analysisResultsProps={sidebarAnalysisResultsProps}
        />

        <MainMapWorkspace
          mapSelectorProps={mapSelectorProps}
          floatingLayerPanelProps={{
            settings,
            onUpdateSettings: updateSettings,
            isDark,
          }}
          elevationProfileData={elevationProfileData}
          onCloseElevationProfile={() => {
            clearProfile();
            handleSelectionModeChange('circle');
          }}
          isDark={isDark}
          btModalStackProps={btModalStackProps}
        />
      </main>
    </div>
  );
}

export default App;
