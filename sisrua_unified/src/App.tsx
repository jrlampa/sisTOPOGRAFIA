import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { AppHeader } from './components/AppHeader';
import { SidebarBtEditorSection } from './components/SidebarBtEditorSection';
import { SidebarAnalysisResults } from './components/SidebarAnalysisResults';
import { SidebarSelectionControls } from './components/SidebarSelectionControls';
import { BtModalStack } from './components/BtModalStack';
import { AppSettingsOverlay } from './components/AppSettingsOverlay';
import { AppStatusStack } from './components/AppStatusStack';

const MapSelector = React.lazy(() => import('./components/MapSelector'));
const FloatingLayerPanel = React.lazy(() => import('./components/FloatingLayerPanel'));
const ElevationProfile = React.lazy(() => import('./components/ElevationProfile'));



const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

const MapSuspenseFallback = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-300">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 text-sm font-semibold">
      <Loader2 size={18} className="animate-spin" />
      Carregando mapa 2.5D...
    </div>
  </div>
);

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

        {/* Animated Sidebar */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`border-r flex flex-col gap-8 overflow-y-auto z-20 shadow-2xl transition-all duration-300 scrollbar-hide ${isSidebarDockedForRamalModal ? 'w-0 p-0 opacity-0 pointer-events-none border-r-0' : 'w-[400px] p-8 opacity-100'} ${isDark ? 'bg-[#020617] border-white/5' : 'bg-white border-slate-200'}`}
          aria-hidden={isSidebarDockedForRamalModal}
        >
          <SidebarSelectionControls
            center={center}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSearching={isSearching}
            handleSearch={handleSearch}
            selectionMode={selectionMode}
            onSelectionModeChange={handleSelectionModeChange}
            radius={radius}
            onRadiusChange={handleRadiusChange}
            saveSnapshot={saveSnapshot}
            onAnalyze={handleFetchAndAnalyze}
            isProcessing={isProcessing}
            isPolygonValid={isPolygonValid}
          />

          <SidebarBtEditorSection
            settings={settings}
            updateSettings={updateSettings}
            btNetworkScenario={btNetworkScenario}
            btEditorMode={btEditorMode}
            btTopology={btTopology}
            btTransformerDebugById={btTransformerDebugById}
            btPoleCoordinateInput={btPoleCoordinateInput}
            setBtPoleCoordinateInput={setBtPoleCoordinateInput}
            handleBtInsertPoleByCoordinates={handleBtInsertPoleByCoordinates}
            clearPendingBtEdge={clearPendingBtEdge}
            pendingNormalClassificationPoles={pendingNormalClassificationPoles}
            handleResetBtTopology={handleResetBtTopology}
            updateBtTopology={updateBtTopology}
            updateProjectType={updateProjectType}
            updateClandestinoAreaM2={updateClandestinoAreaM2}
            handleBtSelectedPoleChange={handleBtSelectedPoleChange}
            handleBtSelectedTransformerChange={handleBtSelectedTransformerChange}
            handleBtSelectedEdgeChange={handleBtSelectedEdgeChange}
            handleBtRenamePole={handleBtRenamePole}
            handleBtRenameTransformer={handleBtRenameTransformer}
            handleBtSetEdgeChangeFlag={handleBtSetEdgeChangeFlag}
            handleBtSetPoleChangeFlag={handleBtSetPoleChangeFlag}
            handleBtTogglePoleCircuitBreak={handleBtTogglePoleCircuitBreak}
            handleBtSetTransformerChangeFlag={handleBtSetTransformerChangeFlag}
          />

          {/* Error Display */}
          <SidebarAnalysisResults
            osmData={osmData}
            stats={stats}
            analysisText={analysisText}
            terrainData={terrainData}
            error={error}
            handleDownloadDxf={handleDownloadDxf}
            isDownloading={isDownloading}
            showToast={showToast}
          />
        </motion.aside>

        {/* Map Viewport */}
        <div className="flex-1 relative z-10">
          <Suspense fallback={<MapSuspenseFallback />}>
            <MapSelector
              center={center}
              flyToEdgeTarget={btEdgeFlyToTarget}
              flyToPoleTarget={btPoleFlyToTarget}
              flyToTransformerTarget={btTransformerFlyToTarget}
              radius={radius}
              selectionMode={selectionMode}
              polygonPoints={polygonPoints}
              onLocationChange={handleMapClick}
              btEditorMode={btEditorMode}
              btTopology={btTopology}
              onBtMapClick={handleBtMapClick}
              pendingBtEdgeStartPoleId={pendingBtEdgeStartPoleId}
              onBtDeletePole={handleBtDeletePole}
              onBtDeleteEdge={handleBtDeleteEdge}
              onBtDeleteTransformer={handleBtDeleteTransformer}
              onBtSetEdgeChangeFlag={handleBtSetEdgeChangeFlag}
              onBtToggleTransformerOnPole={handleBtToggleTransformerOnPole}
              onBtQuickAddPoleRamal={handleBtQuickAddPoleRamal}
              onBtQuickRemovePoleRamal={handleBtQuickRemovePoleRamal}
              onBtQuickAddEdgeConductor={handleBtQuickAddEdgeConductor}
              onBtQuickRemoveEdgeConductor={handleBtQuickRemoveEdgeConductor}
              onBtSetEdgeReplacementFromConductors={handleBtSetEdgeReplacementFromConductors}
              onBtRenamePole={handleBtRenamePole}
              onBtRenameTransformer={handleBtRenameTransformer}
              onBtSetPoleVerified={handleBtSetPoleVerified}
              onBtSetPoleChangeFlag={handleBtSetPoleChangeFlag}
              onBtTogglePoleCircuitBreak={handleBtTogglePoleCircuitBreak}
              onBtSetTransformerChangeFlag={handleBtSetTransformerChangeFlag}
              onBtDragPole={handleBtDragPole}
              onBtDragTransformer={handleBtDragTransformer}
              criticalPoleId={btCriticalPoleId}
              accumulatedByPole={btAccumulatedByPole}
              onPolygonChange={handlePolygonChange}
              measurePath={measurePathPoints}
              onMeasurePathChange={handleMeasurePathChange}
              onKmlDrop={handleKmlDrop}
              mapStyle={settings.mapProvider === 'satellite' ? 'satellite' : 'dark'}
            />

            <FloatingLayerPanel
              settings={settings}
              onUpdateSettings={updateSettings}
              isDark={isDark}
            />
          </Suspense>

          <AnimatePresence>
            {elevationProfileData.length > 0 && (
              <Suspense fallback={<InlineSuspenseFallback label="Carregando perfil altimétrico" />}>
                <ElevationProfile
                  data={elevationProfileData}
                  onClose={() => { 
                    clearProfile(); 
                    handleSelectionModeChange('circle'); 
                  }}
                  isDark={isDark}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <BtModalStack
            normalRamalModal={normalRamalModal}
            setNormalRamalModal={setNormalRamalModal}
            handleConfirmNormalRamalModal={handleConfirmNormalRamalModal}
            clandestinoToNormalModal={clandestinoToNormalModal}
            setClandestinoToNormalModal={setClandestinoToNormalModal}
            handleClandestinoToNormalClassifyLater={handleClandestinoToNormalClassifyLater}
            handleClandestinoToNormalConvertNow={handleClandestinoToNormalConvertNow}
            normalToClandestinoModal={normalToClandestinoModal}
            setNormalToClandestinoModal={setNormalToClandestinoModal}
            handleNormalToClandestinoKeepClients={handleNormalToClandestinoKeepClients}
            handleNormalToClandestinoZeroNormalClients={handleNormalToClandestinoZeroNormalClients}
            resetConfirmOpen={resetConfirmOpen}
            handleConfirmResetBtTopology={handleConfirmResetBtTopology}
            setResetConfirmOpen={setResetConfirmOpen}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
