import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import {
  Download,
  Map as MapIcon,
  Layers,
  Search,
  Loader2,
  AlertCircle,
  Settings,
  Mountain,
  TrendingUp,
  Sparkles,
  LayoutDashboard,
  Sun,
  ShieldAlert,
  Droplets,
  Square
} from 'lucide-react';
import HydrologicalProfilePanel from './components/analytics/HydrologicalProfilePanel'; // Added import
import { AnalysisStats, GlobalState, AppSettings, GeoLocation, SelectionMode } from './types';
import { DEFAULT_LOCATION, MAX_RADIUS, MIN_RADIUS } from './constants';
import { parseUtmQuery, osmToGeoJSON } from './utils/geo';
import MapSelector from './components/gis/MapSelector';
import Dashboard from './components/analytics/Dashboard';
import SettingsModal from './components/SettingsModal';
import HistoryControls from './components/layout/HistoryControls';
import DxfLegend from './components/gis/DxfLegend';
import ElevationProfile from './components/analytics/ElevationProfile';
import BatchUpload from './components/ui/BatchUpload';
import Toast, { ToastType } from './components/ui/Toast';
import ProgressIndicator from './components/ui/ProgressIndicator';
import BimInspector from './components/analytics/BimInspector';
import AiDesignPanel from './components/analytics/AiDesignPanel';
import EnterpriseDashboard from './components/dashboard/EnterpriseDashboard';
import FloatingLayerPanel from './components/gis/FloatingLayerPanel';
import EarthworkPanel from './components/analytics/EarthworkPanel';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useSearch } from './hooks/useSearch';
import { useAuth } from './contexts/AuthContext';
import { useDxfExport } from './hooks/useDxfExport';
import { useKmlImport } from './hooks/useKmlImport';
import { useFileOperations } from './hooks/useFileOperations';
import { useElevationProfile } from './hooks/useElevationProfile';
import { useEarthwork } from './hooks/useEarthwork';

function App() {
  const { user, loginWithGoogle, logout } = useAuth();

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
      projection: 'utm',
      theme: 'dark',
      mapProvider: 'vector',
      contourInterval: 5,
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
        hydrology: false,
        satellite: false
      },
      projectMetadata: {
        projectName: 'PROJECT OSM-01',
        companyName: 'ENG CORP',
        engineerName: 'ENG. LEAD',
        date: new Date().toLocaleDateString('en-US'),
        scale: 'N/A',
        revision: 'R00'
      }
    }
  });

  // Derived state
  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const isDark = settings.theme === 'dark';

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

  const {
    downloadDxf,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
    heatmapData,
    setHeatmapData,
    aiSuggestion,
    economicData,
    longitudinalProfile
  } = useDxfExport({
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
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

  const { saveProject, loadProject, saveToCloud } = useFileOperations({
    appState,
    setAppState,
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const { profileData: elevationProfileData, loadProfile: loadElevationProfile, clearProfile } = useElevationProfile();
  const { calculateEarthwork, isCalculating: isCalculatingEarthwork } = useEarthwork();

  const updateSettings = (newSettings: AppSettings) => {
    setAppState({ ...appState, settings: newSettings }, true);
  };

  // Phase 10: Listener for Environmental Meta
  useEffect(() => {
    const handleUC = (e: Event) => {
      const customE = e as CustomEvent;
      const msg = `Área Protegida (${customE.detail.type}): ${customE.detail.name}`;
      showToast(msg, 'success'); // Employs success toast class but signals attention
    };
    window.addEventListener('uc-detected', handleUC);
    return () => window.removeEventListener('uc-detected', handleUC);
  }, []);

  const handleMapClick = (newCenter: GeoLocation) => {
    setAppState({ ...appState, center: newCenter }, true);
    clearData();
  };

  // Inspection states
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [isInspectorVisible, setInspectorVisible] = useState(false);
  const [isAiPanelVisible, setAiPanelVisible] = useState(false);
  const [isDashboardVisible, setDashboardVisible] = useState(false);
  const [isProfilePanelVisible, setProfilePanelVisible] = useState(false);
  const [activeHeatmap, setActiveHeatmap] = useState<'none' | 'slope' | 'solar'>('none');


  const handleSelectionModeChange = (mode: SelectionMode) => {
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
    await downloadDxf(center, radius, selectionMode, polygon, settings.layers, settings.projection, settings.enableAI);
  };

  const handleDownloadGeoJSON = async () => {
    if (!osmData) return;
    showToast("GeoJSON export not implemented in client yet.", 'info');
  };

  const handleKmlDrop = async (file: File) => {
    await importKml(file);
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
            onSaveProject={saveProject}
            onLoadProject={loadProject}
            onSaveCloudProject={saveToCloud}
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
              sisTOPOGRAFIA <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20">ENGENHARIA</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Análise Geográfica Avançada</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          {aiSuggestion && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAiPanelVisible(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Sparkles size={16} />
              Analista IA
            </motion.button>
          )}

          {user ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl flex items-center gap-2 transition-all shadow-lg"
              title={user.email || 'Conta Corporativa'}
            >
              <img src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'} alt="Avatar" className="w-5 h-5 rounded-full border border-white/20" />
              <span className="text-[10px] font-bold text-slate-300">SAIR</span>
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={loginWithGoogle}
              className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl flex items-center gap-2 transition-all shadow-lg"
            >
              <span className="text-[10px] font-bold">LOGIN</span>
            </motion.button>
          )}

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
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Área de Interesse</label>
            </div>
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                placeholder='Cidade, Endereço ou Coordenadas (UTM)'
                aria-label="Pesquisar área"
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
                <button
                  onClick={() => handleSelectionModeChange('pad')}
                  className={`flex-none px-3 py-2 rounded-lg transition-all ml-1 ${selectionMode === 'pad' ? 'bg-orange-600 text-white shadow-xl shadow-orange-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Platô 2.5D (Corte/Aterro)"
                >
                  <Square size={14} />
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
                    title="Ajustar Raio de Extração"
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
                    <span className="text-xs font-bold text-slate-200">{terrainData ? 'Grade de Alta Resolução Carregada' : 'Aguardando Grade...'}</span>
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
            onPolygonChange={(points) => {
              const geoPoints = points.map(p => ({ lat: p[0], lng: p[1] }));
              setAppState({ ...appState, polygon: geoPoints }, true);
            }}
            measurePath={measurePathPoints}
            onMeasurePathChange={handleMeasurePathChange}
            onKmlDrop={handleKmlDrop}
            mapStyle={settings.mapProvider === 'satellite' ? 'satellite' : 'dark'}
            geojson={osmToGeoJSON(osmData)}
            onFeatureSelect={(feature) => {
              setSelectedFeature(feature);
              setInspectorVisible(true);
            }}
            activeHeatmap={activeHeatmap}
            heatmapData={heatmapData}
          />

          {/* Heatmap Toggles Overlay */}
          <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
            <button
              onClick={() => setActiveHeatmap(activeHeatmap === 'slope' ? 'none' : 'slope')}
              className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${activeHeatmap === 'slope' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'}`}
            >
              <ShieldAlert size={16} />
              {activeHeatmap === 'slope' ? 'Declividade Ativa' : 'Mapa de Declividade'}
            </button>
            <button
              onClick={() => setActiveHeatmap(activeHeatmap === 'solar' ? 'none' : 'solar')}
              className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${activeHeatmap === 'solar' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'}`}
            >
              <Sun size={16} />
              {activeHeatmap === 'solar' ? 'Insolacão Ativa' : 'Mapa Solar'}
            </button>

            {economicData && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setDashboardVisible(!isDashboardVisible)}
                className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${isDashboardVisible ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'}`}
              >
                <LayoutDashboard size={16} />
                Dashboard ROI
              </motion.button>
            )}

            {longitudinalProfile && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setProfilePanelVisible(!isProfilePanelVisible)}
                className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${isProfilePanelVisible ? 'bg-sparkle border-blue-400 text-white' : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'}`}
              >
                <Droplets size={16} className={`${isProfilePanelVisible ? "text-white" : "text-blue-400"}`} />
                Perfil Longitudinal
              </motion.button>
            )}

            {aiSuggestion && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setAiPanelVisible(!isAiPanelVisible)}
                className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${isAiPanelVisible ? 'bg-sparkle border-indigo-400 text-white' : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'}`}
              >
                <Sparkles size={16} />
                Analista IA
              </motion.button>
            )}
          </div>

          <BimInspector
            isVisible={isInspectorVisible}
            onClose={() => setInspectorVisible(false)}
            selectedFeature={selectedFeature}
          />

          <AiDesignPanel
            isVisible={isAiPanelVisible}
            onClose={() => setAiPanelVisible(false)}
            suggestion={aiSuggestion}
          />

          <HydrologicalProfilePanel
            isVisible={isProfilePanelVisible}
            onClose={() => setProfilePanelVisible(false)}
            data={longitudinalProfile}
          />

          <EnterpriseDashboard
            isVisible={isDashboardVisible}
            onClose={() => setDashboardVisible(false)}
            stats={stats}
            economics={economicData}
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

          <AnimatePresence>
            {selectionMode === 'pad' && polygon.length > 2 && (
              <EarthworkPanel
                polygonPoints={polygon.map(p => [p.lat, p.lng] as [number, number])}
                onClose={() => handleSelectionModeChange('pad')}
                isDark={isDark}
                onCalculate={(targetZ) => calculateEarthwork(polygon, targetZ)}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;