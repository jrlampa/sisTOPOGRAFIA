import React, { Suspense, useEffect, useRef } from 'react';
import { useState } from 'react';
import { Map as MapIcon, Search, Loader2, TrendingUp } from 'lucide-react';
import { AnalysisStats, GlobalState, BtTopology, BtPoleNode, BtEditorMode, BtExportSummary, BtExportHistoryEntry, BtNetworkScenario } from './types';
import { DEFAULT_LOCATION, MAX_RADIUS, MIN_RADIUS } from './constants';
import Toast from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useSearch } from './hooks/useSearch';
import { useDxfExport } from './hooks/useDxfExport';
import { useKmlImport } from './hooks/useKmlImport';
import { useFileOperations } from './hooks/useFileOperations';
import { useElevationProfile } from './hooks/useElevationProfile';
import { useAutoSave } from './hooks/useAutoSave';
import { useMapState } from './hooks/useMapState';
import { useBtNavigationState } from './hooks/useBtNavigationState';
import { useBtCrudHandlers } from './hooks/useBtCrudHandlers';
import { useBtDerivedState } from './hooks/useBtDerivedState';
import {
  MAX_BT_EXPORT_HISTORY,
  nextSequentialId,
  EMPTY_BT_TOPOLOGY,
} from './utils/btNormalization';
import { buildBtDxfContext } from './utils/btDxfContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AppHeader } from './components/AppHeader';
import { SidebarBtEditorSection } from './components/SidebarBtEditorSection';
import { SidebarAnalysisResults } from './components/SidebarAnalysisResults';
import { BtExportSummaryBanner } from './components/BtExportSummaryBanner';
import { NormalRamalModal, ClandestinoToNormalModal, NormalToClandestinoModal, ResetBtTopologyModal } from './components/BtModals';
import { clearBtExportHistoryRemote, ingestBtExportHistory, listBtExportHistory } from './services/btExportHistoryService';

const MapSelector = React.lazy(() => import('./components/MapSelector'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
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
  const btHistoryHydratedRef = useRef(false);
  const [btHistoryTotal, setBtHistoryTotal] = useState(0);
  const [btHistoryLoading, setBtHistoryLoading] = useState(false);
  const [btHistoryProjectTypeFilter, setBtHistoryProjectTypeFilter] = useState<'all' | 'ramais' | 'clandestino'>('all');
  const [btHistoryCqtScenarioFilter, setBtHistoryCqtScenarioFilter] = useState<'all' | 'atual' | 'proj1' | 'proj2'>('all');

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
  const btExportSummary = appState.btExportSummary ?? null;
  const btExportHistory = appState.btExportHistory ?? [];
  const latestBtExport = btExportSummary ?? btExportHistory[0] ?? null;
  const btNetworkScenario: BtNetworkScenario = settings.btNetworkScenario ?? 'asis';
  const isDark = settings.theme === 'dark';
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? 'none';

  const btHistoryCanLoadMore = btExportHistory.length < btHistoryTotal;

  const resolveBtHistoryFilters = () => ({
    projectType: btHistoryProjectTypeFilter === 'all' ? undefined : btHistoryProjectTypeFilter,
    cqtScenario: btHistoryCqtScenarioFilter === 'all' ? undefined : btHistoryCqtScenarioFilter,
  });

  const loadBtHistoryPage = async (offset: number, append: boolean) => {
    setBtHistoryLoading(true);
    try {
      const page = await listBtExportHistory(MAX_BT_EXPORT_HISTORY, offset, resolveBtHistoryFilters());
      setBtHistoryTotal(page.total);

      const nextEntries = append
        ? [...(appState.btExportHistory ?? []), ...page.entries]
        : page.entries;

      const latestFromDb = nextEntries[0] ?? null;
      setAppState(
        {
          ...appState,
          btExportSummary: appState.btExportSummary ?? latestFromDb,
          btExportHistory: nextEntries,
        },
        false,
      );
    } catch {
      // Falha de hidratação/paginação não bloqueia fluxo local.
    } finally {
      setBtHistoryLoading(false);
    }
  };

  const handleLoadMoreBtHistory = () => {
    if (btHistoryLoading || !btHistoryCanLoadMore) {
      return;
    }

    void loadBtHistoryPage(btExportHistory.length, true);
  };

  const appendBtHistoryEntry = (entry: BtExportHistoryEntry) => {
    const nextBtExportSummary: BtExportSummary = {
      btContextUrl: entry.btContextUrl,
      criticalPoleId: entry.criticalPoleId,
      criticalAccumulatedClients: entry.criticalAccumulatedClients,
      criticalAccumulatedDemandKva: entry.criticalAccumulatedDemandKva,
      cqt: entry.cqt,
      verifiedPoles: entry.verifiedPoles,
      totalPoles: entry.totalPoles,
      verifiedEdges: entry.verifiedEdges,
      totalEdges: entry.totalEdges,
      verifiedTransformers: entry.verifiedTransformers,
      totalTransformers: entry.totalTransformers,
    };

    const nextHistory = [entry, ...(appState.btExportHistory ?? [])].slice(0, MAX_BT_EXPORT_HISTORY);
    setAppState({ ...appState, btExportSummary: nextBtExportSummary, btExportHistory: nextHistory }, false);

    const cqtScenarioLabel = entry.cqt?.scenario ? ` | CQT ${entry.cqt.scenario.toUpperCase()}` : '';
    showToast(`Resumo BT: ponto crítico ${entry.criticalPoleId} (${entry.criticalAccumulatedDemandKva.toFixed(2)})${cqtScenarioLabel}.`, 'info');
  };

  const handleClearBtExportHistory = async () => {
    try {
      const result = await clearBtExportHistoryRemote(resolveBtHistoryFilters());
      await loadBtHistoryPage(0, false);

      if (result.deletedCount > 0) {
        showToast(`Histórico BT limpo no servidor (${result.deletedCount} registro(s)).`, 'success');
      } else {
        showToast('Nenhum registro BT correspondente ao filtro para limpar.', 'info');
      }
    } catch {
      showToast('Falha ao limpar histórico BT no servidor.', 'error');
    }
  };

  const {
    btAccumulatedByPole,
    btEstimatedByTransformer,
    btTransformerDebugById,
    btCriticalPoleId,
  } = useBtDerivedState({ appState, setAppState });

  useEffect(() => {
    if (btHistoryHydratedRef.current) {
      return;
    }

    if ((appState.btExportHistory ?? []).length > 0) {
      btHistoryHydratedRef.current = true;
      return;
    }

    btHistoryHydratedRef.current = true;

    const hydrateBtHistory = async () => {
      await loadBtHistoryPage(0, false);
    };

    void hydrateBtHistory();
  }, [appState, setAppState]);

  useEffect(() => {
    if (!btHistoryHydratedRef.current) {
      return;
    }

    void loadBtHistoryPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btHistoryProjectTypeFilter, btHistoryCqtScenarioFilter]);

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
    setOsmData
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

  // Custom hooks for feature modules
  const { searchQuery, setSearchQuery, isSearching, handleSearch } = useSearch({
    onLocationFound: (location) => {
      setAppState({ ...appState, center: location }, true);
      clearData();
      showToast(`Locality found: ${location.label}`, 'success');
    },
    onError: (message) => showToast(message, 'error')
  });

  const { downloadDxf, isDownloading, jobId, jobStatus, jobProgress } = useDxfExport({
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error'),
    onBtContextLoaded: ({ btContextUrl, btContext }) => {
      void (async () => {
        try {
          const result = await ingestBtExportHistory({
            btContextUrl,
            btContext,
            projectType: settings.projectType === 'clandestino' ? 'clandestino' : 'ramais',
          });

          if (!result.entry) {
            return;
          }

          appendBtHistoryEntry(result.entry);
        } catch {
          showToast('Falha ao consolidar resumo BT no backend.', 'error');
        }
      })();
    }
  });

  const { importKml } = useKmlImport({
    onImportSuccess: (result, filename) => {
      if (result.type === 'polygon') {
        // Area boundary → set as polygon selection (existing behavior)
        setAppState({
          ...appState,
          selectionMode: 'polygon' as const,
          polygon: result.points,
          center: { ...result.points[0], label: filename }
        }, true);
        clearData();
        showToast('KML/KMZ importado com sucesso', 'success');
      } else {
        // Point placemarks → bulk insert as BT poles
        let runningIds = btTopology.poles.map((p) => p.id);
        const newPoles: BtPoleNode[] = result.points.map((pt, i) => {
          const id = nextSequentialId(runningIds, 'P');
          runningIds = [...runningIds, id];
          const name = result.names?.[i];
          return {
            id,
            lat: pt.lat,
            lng: pt.lng,
            title: name ?? `Poste ${id}`,
            ramais: []
          };
        });

        setAppState({
          ...appState,
          center: { ...result.points[0], label: filename },
          btTopology: {
            ...btTopology,
            poles: [...btTopology.poles, ...newPoles]
          }
        }, true);
        showToast(`${newPoles.length} poste(s) importado(s) do KMZ`, 'success');
      }
    },
    onError: (message) => showToast(message, 'error')
  });

  const { saveProject, loadProject } = useFileOperations({
    appState,
    setAppState,
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const handleSelectionModeChange = (mode: typeof selectionMode) => {
    clearPendingBtEdge();
    handleBaseSelectionModeChange(mode);
  };

  const handleFetchAndAnalyze = async () => {
    const success = await runAnalysis(center, radius, settings.enableAI);
    if (success) showToast("Analysis Complete!", 'success');
    else showToast("Audit failed. Check backend logs.", 'error');
  };

  const handleDownloadDxf = async () => {
    if (!osmData) return;
    if (!validateBtBeforeExport()) return;

    const btContext = buildBtDxfContext({
      btTopology,
      settings,
      btNetworkScenario,
      includeTopology: settings.layers.btNetwork,
    });

    await downloadDxf(
      center,
      radius,
      selectionMode,
      polygon,
      settings.layers,
      settings.projection,
      settings.contourRenderMode,
      btContext
    );
  };

  const handleDownloadGeoJSON = async () => {
    if (!osmData) return;
    showToast("GeoJSON export not implemented in client yet.", 'info');
  };

  const handleKmlDrop = async (file: File) => {
    await importKml(file);
  };

  const handleSaveProject = () => {
    saveProject();
  };

  const handleLoadProject = (file: File) => {
    clearPendingBtEdge();
    loadProject(file);
  };

  const showDxfProgress = isDownloading || !!jobId;
  const dxfProgressValue = Math.max(0, Math.min(100, Math.round(jobProgress)));
  const dxfProgressLabel = jobStatus === 'queued' || jobStatus === 'waiting'
    ? 'A gerar DXF: na fila...'
    : `A gerar DXF: ${dxfProgressValue}%...`;

  return (
    <div className={`flex flex-col h-screen w-full font-sans transition-colors duration-500 overflow-hidden ${isDark ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>

      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            message={toast.message}
            type={toast.type}
            onClose={closeToast}
            duration={toast.type === 'error' ? 8000 : 4000}
          />
        )}
      </AnimatePresence>

      {/* Session recovery banner — shown only when a previous BT session is found */}
      <AnimatePresence>
        {sessionDraft && (
          <motion.div
            key="session-recovery"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-4 left-1/2 z-[990] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-slate-900/95 px-4 py-3 text-xs text-slate-100 shadow-2xl backdrop-blur-sm"
          >
            <span className="text-blue-300 font-semibold">Sessão anterior encontrada ({(sessionDraft.btTopology?.poles.length ?? 0)} postes).</span>
            <button
              onClick={handleRestoreSession}
              className="rounded border border-blue-500/40 px-2 py-1 text-blue-200 hover:bg-blue-500/20 transition-colors"
            >
              Restaurar
            </button>
            <button
              onClick={handleDismissSession}
              className="rounded border border-slate-600/60 px-2 py-1 text-slate-400 hover:bg-slate-700/40 transition-colors"
            >
              Descartar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ProgressIndicator
        isVisible={isProcessing || isDownloading}
        progress={progressValue}
        message={statusMessage}
      />

      {showDxfProgress && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {dxfProgressLabel}
        </div>
      )}

      <BtExportSummaryBanner
        latestBtExport={latestBtExport}
        btExportHistory={btExportHistory}
        exportBtHistoryJson={exportBtHistoryJson}
        exportBtHistoryCsv={exportBtHistoryCsv}
        clearBtExportHistory={handleClearBtExportHistory}
        btHistoryTotal={btHistoryTotal}
        btHistoryLoading={btHistoryLoading}
        btHistoryCanLoadMore={btHistoryCanLoadMore}
        onLoadMoreBtHistory={handleLoadMoreBtHistory}
        historyProjectTypeFilter={btHistoryProjectTypeFilter}
        onHistoryProjectTypeFilterChange={setBtHistoryProjectTypeFilter}
        historyCqtScenarioFilter={btHistoryCqtScenarioFilter}
        onHistoryCqtScenarioFilterChange={setBtHistoryCqtScenarioFilter}
      />

      <AnimatePresence>
        {showSettings && (
          <Suspense fallback={<InlineSuspenseFallback label="Carregando configurações" />}>
            <SettingsModal
              key="settings"
              isOpen={showSettings}
              onClose={closeSettings}
              settings={settings}
              onUpdateSettings={updateSettings}
              selectionMode={selectionMode}
              onSelectionModeChange={handleSelectionModeChange}
              radius={radius}
              onRadiusChange={handleRadiusChange}
              polygon={polygon}
              onClearPolygon={handleClearPolygon}
              hasData={!!osmData}
              isDownloading={isDownloading}
              onExportDxf={handleDownloadDxf}
              onExportGeoJSON={handleDownloadGeoJSON}
              onSaveProject={handleSaveProject}
              onLoadProject={handleLoadProject}
            />
          </Suspense>
        )}
      </AnimatePresence>

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
          {/* Search Card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Área Alvo</label>
            </div>
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                placeholder='Cidade, Endereço ou Coordenadas (UTM)'
                aria-label="Search area"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white placeholder-slate-600 shadow-inner group-hover:border-white/10"
              />
              <Search className="absolute left-4 top-3.5 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
              <AnimatePresence>
                {searchQuery && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    type="submit"
                    disabled={isSearching}
                    className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                  >
                    {isSearching ? <Loader2 className="animate-spin" size={12} /> : "BUSCAR"}
                  </motion.button>
                )}
              </AnimatePresence>
            </form>

            {center.label && (
              <motion.div
                layoutId="location-badge"
                className="flex items-center gap-3 text-xs text-blue-400 bg-blue-500/5 p-3 rounded-xl border border-blue-500/10"
              >
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                  <MapIcon size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold truncate">{center.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono italic">{center.lat.toPrecision(7)}, {center.lng.toPrecision(7)}</span>
                </div>
              </motion.div>
            )}
          </div>

          <div className="h-px bg-white/5 mx-2"></div>

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

          {/* Control Section */}
          <div className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Modo de Seleção</label>
              </div>
              <div className="flex p-1 bg-slate-900 rounded-xl border border-white/5">
                <button
                  onClick={() => handleSelectionModeChange('circle')}
                  className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'circle' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  RAIO
                </button>
                <button
                  onClick={() => handleSelectionModeChange('polygon')}
                  className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${selectionMode === 'polygon' ? 'bg-slate-800 text-blue-400 shadow-xl border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  POLÍGONO
                </button>
                <button
                  onClick={() => handleSelectionModeChange('measure')}
                  className={`flex-none px-3 py-2 rounded-lg transition-all ${selectionMode === 'measure' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Modo Perfil"
                >
                  <TrendingUp size={14} />
                </button>
              </div>
            </div>

            {selectionMode === 'circle' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Raio da Região</label>
                  <div className="bg-slate-900 border border-white/5 px-2.5 py-1 rounded-lg">
                    <span className="text-xs font-mono font-bold text-blue-400">{radius}</span>
                    <span className="text-[10px] text-slate-600 ml-1">METROS</span>
                  </div>
                </div>
                <div className="relative pt-1">
                  <input
                    type="range"
                    aria-label="Raio da região"
                    min={MIN_RADIUS}
                    max={MAX_RADIUS}
                    step={10}
                    value={radius}
                    onMouseDown={saveSnapshot}
                    onTouchStart={saveSnapshot}
                    onChange={(e) => handleRadiusChange(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                  />
                  <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-600 uppercase">
                    <span>{MIN_RADIUS}m</span>
                    <span>{MAX_RADIUS}m</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="h-px bg-white/5 mx-2"></div>

          {/* Action Button */}
          <div>
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleFetchAndAnalyze}
              disabled={isProcessing || (selectionMode === 'polygon' && !isPolygonValid)}
              className={`group w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase transition-all shadow-2xl ${isProcessing || (selectionMode === 'polygon' && !isPolygonValid)
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30'
                }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  PROCESSANDO...
                </>
              ) : (
                <>
                  <div className="p-1 rounded bg-white/10 group-hover:rotate-12 transition-transform">
                    <TrendingUp size={16} />
                  </div>
                  ANALISAR REGIÃO
                </>
              )}
            </motion.button>
          </div>

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

          <NormalRamalModal
            modal={normalRamalModal}
            setModal={setNormalRamalModal}
            onConfirm={handleConfirmNormalRamalModal}
          />
          <ClandestinoToNormalModal
            modal={clandestinoToNormalModal}
            setModal={setClandestinoToNormalModal}
            onClassifyLater={handleClandestinoToNormalClassifyLater}
            onConvertNow={handleClandestinoToNormalConvertNow}
          />
          <NormalToClandestinoModal
            modal={normalToClandestinoModal}
            setModal={setNormalToClandestinoModal}
            onKeepClients={handleNormalToClandestinoKeepClients}
            onZeroNormalClients={handleNormalToClandestinoZeroNormalClients}
          />
          <ResetBtTopologyModal
            open={resetConfirmOpen}
            onConfirm={handleConfirmResetBtTopology}
            onCancel={() => setResetConfirmOpen(false)}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
