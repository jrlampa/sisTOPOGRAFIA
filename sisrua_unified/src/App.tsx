import React, { useState, useEffect } from 'react';
import { Download, Map as MapIcon, Layers, Search, Loader2, AlertCircle, Settings, Mountain, TrendingUp } from 'lucide-react';
import { AnalysisStats, GlobalState, AppSettings, GeoLocation, SelectionMode, BtTopology, BtPoleNode, BtTransformer, BtEditorMode, BtExportSummary, BtExportHistoryEntry } from './types';
import { DEFAULT_LOCATION, MAX_RADIUS, MIN_RADIUS } from './constants';
import MapSelector from './components/MapSelector';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import HistoryControls from './components/HistoryControls';
import DxfLegend from './components/DxfLegend';
import FloatingLayerPanel from './components/FloatingLayerPanel';
import ElevationProfile from './components/ElevationProfile';
import BatchUpload from './components/BatchUpload';
import BtTopologyPanel from './components/BtTopologyPanel';
import Toast, { ToastType } from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useSearch } from './hooks/useSearch';
import { useDxfExport } from './hooks/useDxfExport';
import { useKmlImport } from './hooks/useKmlImport';
import { useFileOperations } from './hooks/useFileOperations';
import { useElevationProfile } from './hooks/useElevationProfile';
import {
  calculateAccumulatedDemandByPole,
  getClandestinoAreaRange,
  getClandestinoClientsRange,
  getClandestinoDiversificationFactorByClients,
  getClandestinoKvaByArea
} from './utils/btCalculations';
import { motion, AnimatePresence } from 'framer-motion';

const EMPTY_BT_TOPOLOGY: BtTopology = {
  poles: [],
  transformers: [],
  edges: []
};
const MAX_BT_EXPORT_HISTORY = 20;

const distanceMeters = (a: GeoLocation, b: GeoLocation) => {
  const earthRadius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

function App() {
  // Global State with Undo/Redo
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
      btEditorMode: 'none',
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
  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btExportSummary = appState.btExportSummary ?? null;
  const btExportHistory = appState.btExportHistory ?? [];
  const latestBtExport = btExportSummary ?? btExportHistory[0] ?? null;
  const isDark = settings.theme === 'dark';
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? 'none';
  const [pendingBtEdgeStartPoleId, setPendingBtEdgeStartPoleId] = useState<string | null>(null);

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

  // Toast notifications
  const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

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
      const criticalPoleRaw = btContext.criticalPole;
      if (!criticalPoleRaw || typeof criticalPoleRaw !== 'object') {
        return;
      }

      const criticalPole = criticalPoleRaw as Record<string, unknown>;
      const poleId = typeof criticalPole.poleId === 'string' ? criticalPole.poleId : '';
      const accumulatedClients = typeof criticalPole.accumulatedClients === 'number' ? criticalPole.accumulatedClients : 0;
      const accumulatedDemandKva = typeof criticalPole.accumulatedDemandKva === 'number' ? criticalPole.accumulatedDemandKva : 0;

      if (!poleId) {
        return;
      }

      const nextBtExportSummary: BtExportSummary = {
        btContextUrl,
        criticalPoleId: poleId,
        criticalAccumulatedClients: accumulatedClients,
        criticalAccumulatedDemandKva: accumulatedDemandKva
      };

      const historyEntry: BtExportHistoryEntry = {
        ...nextBtExportSummary,
        exportedAt: new Date().toISOString(),
        projectType: settings.projectType ?? 'ramais'
      };

      const nextHistory = [historyEntry, ...(appState.btExportHistory ?? [])].slice(0, MAX_BT_EXPORT_HISTORY);

      setAppState({ ...appState, btExportSummary: nextBtExportSummary, btExportHistory: nextHistory }, false);
      showToast(`Resumo BT: ponto crítico ${poleId} (${accumulatedDemandKva.toFixed(2)}).`, 'info');
    }
  });

  const { importKml } = useKmlImport({
    onImportSuccess: (geoPoints, filename) => {
      setAppState({
        ...appState,
        selectionMode: 'polygon',
        polygon: geoPoints,
        center: { ...geoPoints[0], label: filename }
      }, true);
      clearData();
      showToast('KML Imported', 'success');
    },
    onError: (message) => showToast(message, 'error')
  });

  const { saveProject, loadProject } = useFileOperations({
    appState,
    setAppState,
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const { profileData: elevationProfileData, loadProfile: loadElevationProfile, clearProfile } = useElevationProfile();

  const updateSettings = (newSettings: AppSettings) => {
    setAppState({ ...appState, settings: newSettings }, true);
  };

  const updateBtTopology = (nextTopology: BtTopology) => {
    setAppState({ ...appState, btTopology: nextTopology }, true);
  };

  const clearBtExportHistory = () => {
    setAppState({ ...appState, btExportSummary: null, btExportHistory: [] }, true);
    showToast('Histórico BT limpo.', 'info');
  };

  const exportBtHistory = () => {
    if (btExportHistory.length === 0) {
      showToast('Não há histórico BT para exportar.', 'info');
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      projectName: settings.projectMetadata.projectName,
      projectType: settings.projectType ?? 'ramais',
      totalEntries: btExportHistory.length,
      latest: btExportHistory[0],
      entries: btExportHistory
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${settings.projectMetadata.projectName}_bt_history.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast('Histórico BT exportado.', 'success');
  };

  const validateBtBeforeExport = (): boolean => {
    if (!settings.layers.btNetwork) {
      return true;
    }

    if (settings.projectType === 'clandestino') {
      const area = settings.clandestinoAreaM2 ?? 0;
      const areaRange = getClandestinoAreaRange();
      const clientsRange = getClandestinoClientsRange();

      if (!Number.isInteger(area)) {
        showToast('A área clandestina deve ser inteira para casar com a tabela da planilha.', 'error');
        return false;
      }

      if (getClandestinoKvaByArea(area) === null) {
        showToast(`Área clandestina fora da tabela (${areaRange.min}-${areaRange.max} m²).`, 'error');
        return false;
      }

      const totalClandestinoClients = btTopology.edges.reduce(
        (acc, edge) => acc + edge.conductors.reduce((sum, ramal) => sum + ramal.quantity, 0),
        0
      );

      if (getClandestinoDiversificationFactorByClients(totalClandestinoClients) === null) {
        showToast(
          `Total de clientes/ramais fora da tabela (${clientsRange.min}-${clientsRange.max}). Atual: ${totalClandestinoClients}.`,
          'error'
        );
        return false;
      }
    }

    const edgeWithoutConductors = btTopology.edges.find((edge) => edge.conductors.length === 0);
    if (edgeWithoutConductors) {
      showToast(`Aresta ${edgeWithoutConductors.id} sem condutores definidos.`, 'error');
      return false;
    }

    if (settings.projectType !== 'clandestino') {
      if (btTopology.transformers.length === 0) {
        showToast('Adicione ao menos um transformador com leituras para calcular demanda de clientes normais.', 'error');
        return false;
      }

      const transformerWithoutReadings = btTopology.transformers.find((transformer) => transformer.readings.length === 0);
      if (transformerWithoutReadings) {
        showToast(`Transformador ${transformerWithoutReadings.id} sem leituras.`, 'error');
        return false;
      }
    }

    return true;
  };

  const findNearestPole = (location: GeoLocation, maxDistanceMeters = 80): BtPoleNode | null => {
    if (btTopology.poles.length === 0) {
      return null;
    }

    let nearest = btTopology.poles[0];
    let nearestDistance = distanceMeters(location, { lat: nearest.lat, lng: nearest.lng });

    for (const pole of btTopology.poles.slice(1)) {
      const poleDistance = distanceMeters(location, { lat: pole.lat, lng: pole.lng });
      if (poleDistance < nearestDistance) {
        nearest = pole;
        nearestDistance = poleDistance;
      }
    }

    return nearestDistance <= maxDistanceMeters ? nearest : null;
  };

  const handleBtMapClick = (location: GeoLocation) => {
    if (btEditorMode === 'none') {
      return;
    }

    if (btEditorMode === 'add-pole') {
      const nextId = `P${btTopology.poles.length + 1}`;
      const nextPole: BtPoleNode = {
        id: nextId,
        lat: location.lat,
        lng: location.lng,
        title: `Poste ${nextId}`
      };

      setAppState({
        ...appState,
        btTopology: {
          ...btTopology,
          poles: [...btTopology.poles, nextPole]
        }
      }, true);
      showToast(`${nextPole.title} inserido`, 'success');
      return;
    }

    if (btEditorMode === 'add-transformer') {
      const nextId = `TR${btTopology.transformers.length + 1}`;
      const nextTransformer: BtTransformer = {
        id: nextId,
        lat: location.lat,
        lng: location.lng,
        title: `Transformador ${nextId}`,
        monthlyBillBrl: 0,
        demandKw: 0,
        readings: []
      };

      setAppState({
        ...appState,
        btTopology: {
          ...btTopology,
          transformers: [...btTopology.transformers, nextTransformer]
        }
      }, true);
      showToast(`${nextTransformer.title} inserido`, 'success');
      return;
    }

    if (btEditorMode === 'add-edge') {
      const nearestPole = findNearestPole(location);
      if (!nearestPole) {
        showToast('Nenhum poste próximo (raio de captura: 80m)', 'error');
        return;
      }

      if (!pendingBtEdgeStartPoleId) {
        setPendingBtEdgeStartPoleId(nearestPole.id);
        showToast(`Origem selecionada: ${nearestPole.title}`, 'info');
        return;
      }

      if (pendingBtEdgeStartPoleId === nearestPole.id) {
        showToast('Selecione um segundo poste para concluir a aresta', 'info');
        return;
      }

      const fromPole = btTopology.poles.find((pole) => pole.id === pendingBtEdgeStartPoleId);
      if (!fromPole) {
        setPendingBtEdgeStartPoleId(null);
        showToast('Poste de origem não encontrado', 'error');
        return;
      }

      const edgeId = `E${btTopology.edges.length + 1}`;
      const lengthMeters = Math.round(distanceMeters(
        { lat: fromPole.lat, lng: fromPole.lng },
        { lat: nearestPole.lat, lng: nearestPole.lng }
      ));

      setAppState({
        ...appState,
        btTopology: {
          ...btTopology,
          edges: [
            ...btTopology.edges,
            {
              id: edgeId,
              fromPoleId: fromPole.id,
              toPoleId: nearestPole.id,
              lengthMeters,
              conductors: []
            }
          ]
        }
      }, true);

      setPendingBtEdgeStartPoleId(null);
      showToast(`Aresta ${edgeId} criada (${lengthMeters}m)`, 'success');
    }
  };

  const handleMapClick = (newCenter: GeoLocation) => {
    setAppState({ ...appState, center: newCenter }, true);
    clearData();
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    setPendingBtEdgeStartPoleId(null);
    setAppState({ ...appState, selectionMode: mode, polygon: [], measurePath: [] }, true);
  };

  const handleMeasurePathChange = async (path: [number, number][]) => {
    const geoPath = path.map(p => ({ lat: p[0], lng: p[1] }));
    setAppState({ ...appState, measurePath: geoPath }, false);

    if (geoPath.length === 2) {
      await loadElevationProfile(geoPath[0], geoPath[1]);
    } else {
      clearProfile();
    }
  };

  const handleFetchAndAnalyze = async () => {
    const success = await runAnalysis(center, radius, settings.enableAI);
    if (success) showToast("Analysis Complete!", 'success');
    else showToast("Audit failed. Check backend logs.", 'error');
  };

  const handleDownloadDxf = async () => {
    if (!osmData) return;
    if (!validateBtBeforeExport()) return;

    const btAccumulated = calculateAccumulatedDemandByPole(
      btTopology,
      settings.projectType ?? 'ramais',
      settings.clandestinoAreaM2 ?? 0
    );

    const btContext = {
      projectType: settings.projectType ?? 'ramais',
      clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
      totalTransformers: btTopology.transformers.length,
      totalPoles: btTopology.poles.length,
      totalEdges: btTopology.edges.length,
      accumulatedByPole: btAccumulated,
      criticalPole: btAccumulated[0] ?? null
    };

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
    setPendingBtEdgeStartPoleId(null);
    loadProject(file);
  };

  // Get current location on mount (only if center is default)
  useEffect(() => {
    if (center.lat === DEFAULT_LOCATION.lat && center.lng === DEFAULT_LOCATION.lng) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          setAppState({
            ...appState,
            center: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              label: "Current Location"
            }
          }, false);
        }, (_err) => {
          // Geolocation permission denied, using default
        });
      }
    }
  }, []);

  // Helpers
  const isPolygonValid = (selectionMode === 'polygon' && polygon.length >= 3);

  // Memoized points to prevent unnecessary re-renders of the map
  const polygonPoints = React.useMemo(() =>
    polygon.map(p => [p.lat, p.lng] as [number, number]),
    [polygon]);

  const measurePathPoints = React.useMemo(() =>
    measurePath.map(p => [p.lat, p.lng] as [number, number]),
    [measurePath]);

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
            onClose={() => setToast(null)}
            duration={toast.type === 'error' ? 8000 : 4000}
          />
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

      {(latestBtExport || btExportHistory.length > 0) && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-500/30 bg-slate-950/95 px-4 py-3 text-xs text-cyan-100 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="font-semibold uppercase tracking-wide text-cyan-300">Resumo BT Exportado</div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportBtHistory}
                className="inline-flex items-center gap-1 rounded border border-cyan-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/10"
              >
                <Download size={10} /> Exportar
              </button>
              <button
                onClick={clearBtExportHistory}
                className="rounded border border-cyan-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/10"
              >
                Limpar
              </button>
            </div>
          </div>

          {latestBtExport && (
            <>
              <div className="mt-1">
                Ponto crítico: {latestBtExport.criticalPoleId} | CLT acum.: {latestBtExport.criticalAccumulatedClients} | Demanda acum.: {latestBtExport.criticalAccumulatedDemandKva.toFixed(2)}
              </div>
              <a
                href={latestBtExport.btContextUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
              >
                Abrir metadata BT (JSON)
              </a>
            </>
          )}

          {btExportHistory.length > 0 && (
            <div className="mt-3 border-t border-cyan-500/20 pt-2">
              <div className="mb-1 font-semibold uppercase tracking-wide text-cyan-300">Histórico (últimas 5 de {btExportHistory.length})</div>
              {btExportHistory.slice(0, 5).map((entry, index) => (
                <div key={`${entry.exportedAt}-${entry.criticalPoleId}-${index}`} className="text-[11px] text-cyan-100/90">
                  {new Date(entry.exportedAt).toLocaleString('pt-BR')} | {entry.projectType.toUpperCase()} | {entry.criticalPoleId} | {entry.criticalAccumulatedDemandKva.toFixed(2)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            onExportGeoJSON={handleDownloadGeoJSON}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
          />
        )}
      </AnimatePresence>

      {/* Premium Header */}
      <header className={`h-20 border-b flex items-center justify-between px-8 shrink-0 z-30 transition-all ${isDark ? 'border-white/5 bg-[#020617]/80 backdrop-blur-md' : 'border-slate-200 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ rotate: 180 }}
            className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"
          >
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
          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSettings(true)}
            className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg"
          >
            <Settings size={20} />
          </motion.button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* Animated Sidebar */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`w-[400px] border-r flex flex-col p-8 gap-8 overflow-y-auto z-20 shadow-2xl transition-all scrollbar-hide ${isDark ? 'bg-[#020617] border-white/5' : 'bg-white border-slate-200'}`}
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

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Editor BT</label>
              <span className="text-[9px] text-slate-500 uppercase">{(settings.projectType ?? 'ramais').toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ ...settings, btEditorMode: 'none' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'none' ? 'bg-slate-800 text-slate-100 border-white/10' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                NAVEGAR
              </button>
              <button
                onClick={() => updateSettings({ ...settings, btEditorMode: 'add-pole' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-pole' ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                + POSTE
              </button>
              <button
                onClick={() => {
                  setPendingBtEdgeStartPoleId(null);
                  updateSettings({ ...settings, btEditorMode: 'add-edge' });
                }}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-edge' ? 'bg-emerald-600 text-white border-emerald-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                + ARESTA
              </button>
              <button
                onClick={() => updateSettings({ ...settings, btEditorMode: 'add-transformer' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-transformer' ? 'bg-violet-600 text-white border-violet-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                + TRAFO
              </button>
            </div>
            {settings.projectType === 'clandestino' && (
              <div className="text-[10px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-lg p-2">
                Área clandestina: {settings.clandestinoAreaM2 ?? 0} m²
              </div>
            )}
          </div>

          <div className="h-px bg-white/5 mx-2"></div>

          <BtTopologyPanel
            btTopology={btTopology}
            projectType={settings.projectType ?? 'ramais'}
            clandestinoAreaM2={settings.clandestinoAreaM2 ?? 0}
            onTopologyChange={updateBtTopology}
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
                    min={MIN_RADIUS}
                    max={MAX_RADIUS}
                    step={10}
                    value={radius}
                    onMouseDown={saveSnapshot}
                    onTouchStart={saveSnapshot}
                    onChange={(e) => setAppState({ ...appState, radius: parseInt(e.target.value) }, false)}
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
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3 text-rose-400 text-sm overflow-hidden"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p className="font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analysis Results */}
          <AnimatePresence>
            {osmData && stats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-6 mt-auto overflow-visible"
              >
                <div className="h-px bg-white/5 mx-2"></div>
                <Dashboard stats={stats} analysisText={analysisText} />

                <DxfLegend />

                <BatchUpload
                  onError={(message) => showToast(message, 'error')}
                  onInfo={(message) => showToast(message, 'info')}
                />

                <div className="flex items-center gap-3 p-4 glass rounded-2xl">
                  <div className={`p-2 rounded-lg ${terrainData ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                    <Mountain size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">MOTOR DE TERRENO</span>
                    <span className="text-xs font-bold text-slate-200">{terrainData ? 'Grade de Alta Resolução Carregada' : 'Grade Pendente...'}</span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownloadDxf}
                  disabled={isDownloading}
                  className="group w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest uppercase shadow-xl shadow-emerald-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? <Loader2 className="animate-spin" size={18} /> : (
                    <div className="p-1 rounded bg-white/10 group-hover:animate-bounce">
                      <Download size={18} />
                    </div>
                  )}
                  {isDownloading ? 'GERANDO...' : 'BAIXAR DXF'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>

        {/* Map Viewport */}
        <div className="flex-1 relative z-10">
          <MapSelector
            center={center}
            radius={radius}
            selectionMode={selectionMode}
            polygonPoints={polygonPoints}
            onLocationChange={handleMapClick}
            btEditorMode={btEditorMode}
            btTopology={btTopology}
            onBtMapClick={handleBtMapClick}
            pendingBtEdgeStartPoleId={pendingBtEdgeStartPoleId}
            onPolygonChange={(points) => {
              const geoPoints = points.map(p => ({ lat: p[0], lng: p[1] }));
              setAppState({ ...appState, polygon: geoPoints }, true);
            }}
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

          <AnimatePresence>
            {elevationProfileData.length > 0 && (
              <ElevationProfile
                data={elevationProfileData}
                onClose={() => { 
                  clearProfile(); 
                  handleSelectionModeChange('circle'); 
                }}
                isDark={isDark}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;