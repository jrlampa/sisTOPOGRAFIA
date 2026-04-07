import React, { useState, useEffect } from 'react';
import { Layers, Settings } from 'lucide-react';
import { GlobalState, GeoLocation, SelectionMode, BtPoleNode } from './types';
import { DEFAULT_LOCATION } from './constants';
import MapSelector from './components/MapSelector';
import SettingsModal from './components/SettingsModal';
import HistoryControls from './components/HistoryControls';
import FloatingLayerPanel from './components/FloatingLayerPanel';
import ElevationProfile from './components/ElevationProfile';
import Toast, { ToastType } from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import AppSidebar from './components/AppSidebar';
import BtExportSummaryPanel from './components/BtExportSummaryPanel';
import BtModals from './components/BtModals';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useSearch } from './hooks/useSearch';
import { useDxfExport } from './hooks/useDxfExport';
import { useKmlImport } from './hooks/useKmlImport';
import { useFileOperations } from './hooks/useFileOperations';
import { useElevationProfile } from './hooks/useElevationProfile';
import { useAutoSave, loadSessionDraft, clearSessionDraft } from './hooks/useAutoSave';
import { useBtTopology } from './hooks/useBtTopology';
import { EMPTY_BT_TOPOLOGY } from './constants/btConstants';
import { nextSequentialId } from './utils/appUtils';
import { motion, AnimatePresence } from 'framer-motion';


function App() {
  const {
    state: appState,
    setState: setAppState,
    undo, redo, canUndo, canRedo, saveSnapshot
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
      clandestinoAreaM2: 0,
      layers: {
        buildings: true, roads: true, curbs: true, nature: true,
        terrain: true, contours: false, slopeAnalysis: false,
        furniture: true, labels: true, dimensions: false, grid: false, btNetwork: true
      },
      projectMetadata: {
        projectName: 'PROJECT OSM-01', companyName: 'ENG CORP',
        engineerName: 'ENG. LEAD', date: new Date().toLocaleDateString('en-US'),
        scale: 'N/A', revision: 'R00'
      }
    },
    btTopology: EMPTY_BT_TOPOLOGY,
    btExportSummary: null,
    btExportHistory: []
  });

  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const isDark = settings.theme === 'dark';

  const { isProcessing, progressValue, statusMessage, osmData, terrainData, stats, analysisText, error, runAnalysis, clearData, setOsmData } = useOsmEngine();
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<GlobalState | null>(null);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  const bt = useBtTopology({ appState, setAppState, showToast });

  useAutoSave(appState);

  useEffect(() => {
    const draft = loadSessionDraft();
    if (draft && (draft.state.btTopology?.poles.length ?? 0) > 0) {
      setSessionDraft(draft.state);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestoreSession = () => {
    if (sessionDraft) {
      setAppState(sessionDraft, false);
      setSessionDraft(null);
      clearSessionDraft();
      showToast('Sessão anterior restaurada.', 'success');
    }
  };

  const handleDismissSession = () => {
    setSessionDraft(null);
    clearSessionDraft();
  };

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
    onBtContextLoaded: ({ btContextUrl, btContext, cqtSummary }) => {
      bt.handleBtContextLoaded({ btContextUrl, btContext, cqtSummary });
    }
  });

  const { importKml } = useKmlImport({
    onImportSuccess: (result, filename) => {
      if (result.type === 'polygon') {
        setAppState({ ...appState, selectionMode: 'polygon' as const, polygon: result.points, center: { ...result.points[0], label: filename } }, true);
        clearData();
        showToast('KML/KMZ importado com sucesso', 'success');
      } else {
        let runningIds = bt.btTopology.poles.map((p) => p.id);
        const newPoles: BtPoleNode[] = result.points.map((pt, i) => {
          const id = nextSequentialId(runningIds, 'P');
          runningIds = [...runningIds, id];
          const name = result.names?.[i];
          return { id, lat: pt.lat, lng: pt.lng, title: name ?? `Poste ${id}`, ramais: [] };
        });
        setAppState({
          ...appState,
          center: { ...result.points[0], label: filename },
          btTopology: { ...bt.btTopology, poles: [...bt.btTopology.poles, ...newPoles] }
        }, true);
        showToast(`${newPoles.length} poste(s) importado(s) do KMZ`, 'success');
      }
    },
    onError: (message) => showToast(message, 'error')
  });

  const { saveProject, loadProject } = useFileOperations({
    appState, setAppState,
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const { profileData: elevationProfileData, loadProfile: loadElevationProfile, clearProfile } = useElevationProfile();

  const updateSettings = (newSettings: typeof settings) => {
    setAppState({ ...appState, settings: newSettings }, true);
  };

  const handleMapClick = (newCenter: GeoLocation) => {
    setAppState({ ...appState, center: newCenter }, true);
    clearData();
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    bt.setPendingBtEdgeStartPoleId(null);
    setAppState({ ...appState, selectionMode: mode, polygon: [], measurePath: [] }, true);
  };

  const handleMeasurePathChange = async (path: [number, number][]) => {
    const geoPath = path.map(p => ({ lat: p[0], lng: p[1] }));
    setAppState({ ...appState, measurePath: geoPath }, false);
    if (geoPath.length === 2) await loadElevationProfile(geoPath[0], geoPath[1]);
    else clearProfile();
  };

  const handleFetchAndAnalyze = async () => {
    const success = await runAnalysis(center, radius, settings.enableAI);
    if (success) showToast("Analysis Complete!", 'success');
    else showToast("Audit failed. Check backend logs.", 'error');
  };

  const handleDownloadDxf = async () => {
    if (!osmData) return;
    if (!bt.validateBtBeforeExport()) return;
    const btContext = bt.buildBtContext();
    await downloadDxf(center, radius, selectionMode, polygon, settings.layers, settings.projection, settings.contourRenderMode, btContext);
  };

  const handleKmlDrop = async (file: File) => { await importKml(file); };
  const handleSaveProject = () => { saveProject(); };
  const handleLoadProject = (file: File) => { bt.setPendingBtEdgeStartPoleId(null); loadProject(file); };

  useEffect(() => {
    if (center.lat === DEFAULT_LOCATION.lat && center.lng === DEFAULT_LOCATION.lng) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          setAppState({ ...appState, center: { lat: position.coords.latitude, lng: position.coords.longitude, label: "Current Location" } }, false);
        }, () => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPolygonValid = selectionMode === 'polygon' && polygon.length >= 3;
  const polygonPoints = React.useMemo(() => polygon.map(p => [p.lat, p.lng] as [number, number]), [polygon]);
  const measurePathPoints = React.useMemo(() => measurePath.map(p => [p.lat, p.lng] as [number, number]), [measurePath]);

  const showDxfProgress = isDownloading || !!jobId;
  const dxfProgressValue = Math.max(0, Math.min(100, Math.round(jobProgress)));
  const dxfProgressLabel = jobStatus === 'queued' || jobStatus === 'waiting'
    ? 'A gerar DXF: na fila...'
    : `A gerar DXF: ${dxfProgressValue}%...`;

  return (
    <div className={`flex flex-col h-screen w-full font-sans transition-colors duration-500 overflow-hidden ${isDark ? 'bg-[#020617] text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={toast.type === 'error' ? 8000 : 4000} />}
      </AnimatePresence>

      <AnimatePresence>
        {sessionDraft && (
          <motion.div key="session-recovery" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="fixed top-4 left-1/2 z-[990] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-slate-900/95 px-4 py-3 text-xs text-slate-100 shadow-2xl backdrop-blur-sm"
          >
            <span className="text-blue-300 font-semibold">Sessão anterior encontrada ({(sessionDraft.btTopology?.poles.length ?? 0)} postes).</span>
            <button onClick={handleRestoreSession} className="rounded border border-blue-500/40 px-2 py-1 text-blue-200 hover:bg-blue-500/20 transition-colors">Restaurar</button>
            <button onClick={handleDismissSession} className="rounded border border-slate-600/60 px-2 py-1 text-slate-400 hover:bg-slate-700/40 transition-colors">Descartar</button>
          </motion.div>
        )}
      </AnimatePresence>

      <ProgressIndicator isVisible={isProcessing || isDownloading} progress={progressValue} message={statusMessage} />

      {showDxfProgress && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {dxfProgressLabel}
        </div>
      )}

      <BtExportSummaryPanel
        latestBtExport={bt.latestBtExport}
        btExportHistory={bt.btExportHistory}
        onExportJson={bt.exportBtHistoryJson}
        onExportCsv={bt.exportBtHistoryCsv}
        onClearHistory={bt.clearBtExportHistory}
      />

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            key="settings"
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            settings={settings}
            onUpdateSettings={updateSettings}
            selectionMode={selectionMode}
            onSelectionModeChange={handleSelectionModeChange}
            radius={radius}
            onRadiusChange={(r) => setAppState({ ...appState, radius: r }, false)}
            polygon={polygon}
            onClearPolygon={() => setAppState({ ...appState, polygon: [] }, true)}
            hasData={!!osmData}
            isDownloading={isDownloading}
            onExportDxf={handleDownloadDxf}
            onExportGeoJSON={async () => showToast("GeoJSON export not implemented in client yet.", 'info')}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
          />
        )}
      </AnimatePresence>

      <header className={`h-20 border-b flex items-center justify-between px-8 shrink-0 z-30 transition-all ${isDark ? 'border-white/5 bg-[#020617]/80 backdrop-blur-md' : 'border-slate-200 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-4">
          <motion.div whileHover={{ rotate: 180 }} className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Layers size={22} className="text-white" />
          </motion.div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
              SIS RUA <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20">UNIFIED</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Análise Geo Avançada</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <HistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowSettings(true)} className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg">
            <Settings size={20} />
          </motion.button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <AppSidebar
          isDark={isDark}
          isSidebarDockedForRamalModal={bt.isSidebarDockedForRamalModal}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearching={isSearching} handleSearch={handleSearch}
          center={center}
          settings={settings}
          btNetworkScenario={bt.btNetworkScenario}
          btEditorMode={bt.btEditorMode}
          pendingBtEdgeStartPoleId={bt.pendingBtEdgeStartPoleId}
          setPendingBtEdgeStartPoleId={bt.setPendingBtEdgeStartPoleId}
          btPoleCoordinateInput={bt.btPoleCoordinateInput}
          setBtPoleCoordinateInput={bt.setBtPoleCoordinateInput}
          handleBtInsertPoleByCoordinates={bt.handleBtInsertPoleByCoordinates}
          pendingNormalClassificationPoles={bt.pendingNormalClassificationPoles}
          handleResetBtTopology={bt.handleResetBtTopology}
          btTopology={bt.btTopology}
          updateBtTopology={bt.updateBtTopology}
          updateProjectType={bt.updateProjectType}
          updateClandestinoAreaM2={bt.updateClandestinoAreaM2}
          handleBtRenamePole={bt.handleBtRenamePole}
          handleBtRenameTransformer={bt.handleBtRenameTransformer}
          updateSettings={updateSettings}
          selectionMode={selectionMode}
          handleSelectionModeChange={handleSelectionModeChange}
          radius={radius}
          setAppStateRadius={(r) => setAppState({ ...appState, radius: r }, false)}
          saveSnapshot={saveSnapshot}
          isProcessing={isProcessing}
          isPolygonValid={isPolygonValid}
          handleFetchAndAnalyze={handleFetchAndAnalyze}
          osmData={osmData}
          stats={stats}
          analysisText={analysisText}
          terrainData={terrainData}
          isDownloading={isDownloading}
          handleDownloadDxf={handleDownloadDxf}
          showToast={showToast}
          error={error}
        />

        <div className="flex-1 relative z-10">
          <MapSelector
            center={center}
            radius={radius}
            selectionMode={selectionMode}
            polygonPoints={polygonPoints}
            onLocationChange={handleMapClick}
            btEditorMode={bt.btEditorMode}
            btTopology={bt.btTopology}
            onBtMapClick={bt.handleBtMapClick}
            pendingBtEdgeStartPoleId={bt.pendingBtEdgeStartPoleId}
            onBtDeletePole={bt.handleBtDeletePole}
            onBtDeleteEdge={bt.handleBtDeleteEdge}
            onBtDeleteTransformer={bt.handleBtDeleteTransformer}
            onBtToggleTransformerOnPole={bt.handleBtToggleTransformerOnPole}
            onBtQuickAddPoleRamal={bt.handleBtQuickAddPoleRamal}
            onBtQuickRemovePoleRamal={bt.handleBtQuickRemovePoleRamal}
            onBtQuickAddEdgeConductor={bt.handleBtQuickAddEdgeConductor}
            onBtQuickRemoveEdgeConductor={bt.handleBtQuickRemoveEdgeConductor}
            onBtRenamePole={bt.handleBtRenamePole}
            onBtRenameTransformer={bt.handleBtRenameTransformer}
            onBtSetPoleVerified={bt.handleBtSetPoleVerified}
            onBtDragPole={bt.handleBtDragPole}
            onBtDragTransformer={bt.handleBtDragTransformer}
            criticalPoleId={bt.btCriticalPoleId}
            accumulatedByPole={bt.btAccumulatedByPole}
            onPolygonChange={(points) => {
              const geoPoints = points.map(p => ({ lat: p[0], lng: p[1] }));
              setAppState({ ...appState, polygon: geoPoints }, true);
            }}
            measurePath={measurePathPoints}
            onMeasurePathChange={handleMeasurePathChange}
            onKmlDrop={handleKmlDrop}
            mapStyle={settings.mapProvider === 'satellite' ? 'satellite' : 'dark'}
          />

          <FloatingLayerPanel settings={settings} onUpdateSettings={updateSettings} isDark={isDark} />

          <AnimatePresence>
            {elevationProfileData.length > 0 && (
              <ElevationProfile
                data={elevationProfileData}
                onClose={() => { clearProfile(); handleSelectionModeChange('circle'); }}
                isDark={isDark}
              />
            )}
          </AnimatePresence>

          <BtModals
            normalRamalModal={bt.normalRamalModal}
            setNormalRamalModal={bt.setNormalRamalModal}
            onConfirmNormalRamalModal={bt.handleConfirmNormalRamalModal}
            clandestinoToNormalModal={bt.clandestinoToNormalModal}
            setClandestinoToNormalModal={bt.setClandestinoToNormalModal}
            onClandestinoToNormalClassifyLater={bt.handleClandestinoToNormalClassifyLater}
            onClandestinoToNormalConvertNow={bt.handleClandestinoToNormalConvertNow}
            normalToClandestinoModal={bt.normalToClandestinoModal}
            setNormalToClandestinoModal={bt.setNormalToClandestinoModal}
            onNormalToClandestinoKeepClients={bt.handleNormalToClandestinoKeepClients}
            onNormalToClandestinoZeroNormalClients={bt.handleNormalToClandestinoZeroNormalClients}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
