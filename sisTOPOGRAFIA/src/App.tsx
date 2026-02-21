import { AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import HydrologicalProfilePanel from './components/analytics/HydrologicalProfilePanel';
import { GlobalState, AppSettings, GeoLocation, SelectionMode } from './types';
import { DEFAULT_LOCATION } from './constants';
import { osmToGeoJSON } from './utils/geo';
import MapSelector from './components/gis/MapSelector';
import SettingsModal from './components/SettingsModal';
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';
import MapOverlayControls from './components/layout/MapOverlayControls';
import ElevationProfile from './components/analytics/ElevationProfile';
import BimInspector from './components/analytics/BimInspector';
import AiDesignPanel from './components/analytics/AiDesignPanel';
import EnterpriseDashboard from './components/dashboard/EnterpriseDashboard';
import FloatingLayerPanel from './components/gis/FloatingLayerPanel';
import EarthworkPanel from './components/analytics/EarthworkPanel';
import Toast, { ToastType } from './components/ui/Toast';
import ProgressIndicator from './components/ui/ProgressIndicator';
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

  const {
    state: appState,
    setState: setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveSnapshot,
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
        satellite: false,
        generate_tin: true,
      },
      projectMetadata: {
        projectName: 'PROJECT OSM-01',
        companyName: 'ENG CORP',
        engineerName: 'ENG. LEAD',
        date: new Date().toLocaleDateString('pt-BR'),
        scale: 'N/A',
        revision: 'R00',
      },
    },
  });

  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const isDark = settings.theme === 'dark';

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

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  const { searchQuery, setSearchQuery, isSearching, handleSearch } = useSearch({
    onLocationFound: (location) => {
      setAppState({ ...appState, center: location }, true);
      clearData();
      showToast(`Localidade encontrada: ${location.label}`, 'success');
    },
    onError: (message) => showToast(message, 'error'),
  });

  const {
    downloadDxf,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
    heatmapData,
    aiSuggestion,
    economicData,
    longitudinalProfile,
  } = useDxfExport({
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error'),
  });

  const { importKml } = useKmlImport({
    onImportSuccess: (geoPoints, filename) => {
      setAppState({ ...appState, selectionMode: 'polygon', polygon: geoPoints, center: { ...geoPoints[0], label: filename } }, true);
      clearData();
      showToast('KML Importado', 'success');
    },
    onError: (message) => showToast(message, 'error'),
  });

  const { saveProject, loadProject, saveToCloud } = useFileOperations({
    appState,
    setAppState,
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error'),
  });

  const { profileData: elevationProfileData, loadProfile: loadElevationProfile, clearProfile } = useElevationProfile();
  const { calculateEarthwork } = useEarthwork();

  const updateSettings = (newSettings: AppSettings) => setAppState({ ...appState, settings: newSettings }, true);

  useEffect(() => {
    const handleUC = (e: Event) => {
      const ev = e as CustomEvent;
      showToast(`Área Protegida (${ev.detail.type}): ${ev.detail.name}`, 'success');
    };
    window.addEventListener('uc-detected', handleUC);
    return () => window.removeEventListener('uc-detected', handleUC);
  }, []);

  const handleMapClick = (newCenter: GeoLocation) => { setAppState({ ...appState, center: newCenter }, true); clearData(); };

  const [selectedFeature, setSelectedFeature] = useState<unknown>(null);
  const [isInspectorVisible, setInspectorVisible] = useState(false);
  const [isAiPanelVisible, setAiPanelVisible] = useState(false);
  const [isDashboardVisible, setDashboardVisible] = useState(false);
  const [isProfilePanelVisible, setProfilePanelVisible] = useState(false);
  const [activeHeatmap, setActiveHeatmap] = useState<'none' | 'slope' | 'solar'>('none');

  const handleSelectionModeChange = (mode: SelectionMode) =>
    setAppState({ ...appState, selectionMode: mode, polygon: [], measurePath: [] }, true);

  const handleMeasurePathChange = async (path: [number, number][]) => {
    const geoPath = path.map(p => ({ lat: p[0], lng: p[1] }));
    setAppState({ ...appState, measurePath: geoPath }, false);
    if (geoPath.length === 2) await loadElevationProfile(geoPath[0], geoPath[1]);
    else clearProfile();
  };

  const handleFetchAndAnalyze = async () => {
    const success = await runAnalysis(center, radius, settings.enableAI);
    if (success) showToast('Análise Concluída!', 'success');
    else showToast('Falha na auditoria. Verifique os logs do backend.', 'error');
  };

  const handleDownloadDxf = async () => {
    if (!osmData) return;
    await downloadDxf(center, radius, selectionMode, polygon, settings.layers, settings.projection, settings.enableAI);
  };

  useEffect(() => {
    if (center.lat === DEFAULT_LOCATION.lat && center.lng === DEFAULT_LOCATION.lng) {
      navigator.geolocation?.getCurrentPosition(pos => {
        setAppState({ ...appState, center: { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Localização Atual' } }, false);
      });
    }
  }, []);

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

      <ProgressIndicator isVisible={isProcessing || isDownloading} progress={progressValue} message={statusMessage} />

      {showDxfProgress && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {dxfProgressLabel}
        </div>
      )}

      <AnimatePresence>
        {showSettings && (
          <SettingsModal key="settings" isOpen={showSettings} onClose={() => setShowSettings(false)}
            settings={settings} onUpdateSettings={updateSettings} selectionMode={selectionMode}
            onSelectionModeChange={handleSelectionModeChange} radius={radius}
            onRadiusChange={r => setAppState({ ...appState, radius: r }, false)}
            polygon={polygon} onClearPolygon={() => setAppState({ ...appState, polygon: [] }, true)}
            hasData={!!osmData} isDownloading={isDownloading} onExportDxf={handleDownloadDxf}
            onExportGeoJSON={() => showToast('Exportação GeoJSON ainda não disponível.', 'info')}
            onSaveProject={saveProject} onLoadProject={loadProject} onSaveCloudProject={saveToCloud}
          />
        )}
      </AnimatePresence>

      <AppHeader
        isDark={isDark} canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
        aiSuggestion={aiSuggestion} onAiPanelOpen={() => setAiPanelVisible(true)}
        user={user} onLogin={loginWithGoogle} onLogout={logout} onSettingsOpen={() => setShowSettings(true)}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <AppSidebar
          isDark={isDark} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery}
          isSearching={isSearching} onSearch={handleSearch} center={center}
          selectionMode={selectionMode} onSelectionModeChange={handleSelectionModeChange}
          radius={radius} onRadiusChange={r => setAppState({ ...appState, radius: r }, false)}
          onSaveSnapshot={saveSnapshot} isProcessing={isProcessing} polygon={polygon}
          onFetchAndAnalyze={handleFetchAndAnalyze} error={error} osmData={osmData}
          stats={stats} analysisText={analysisText} terrainData={terrainData}
          isDownloading={isDownloading} onDownloadDxf={handleDownloadDxf}
          onToastError={msg => showToast(msg, 'error')} onToastInfo={msg => showToast(msg, 'info')}
        />

        <div className="flex-1 relative z-10">
          <MapSelector
            center={center} radius={radius} selectionMode={selectionMode} polygonPoints={polygonPoints}
            onLocationChange={handleMapClick}
            onPolygonChange={points => setAppState({ ...appState, polygon: points.map(p => ({ lat: p[0], lng: p[1] })) }, true)}
            measurePath={measurePathPoints} onMeasurePathChange={handleMeasurePathChange}
            onKmlDrop={async file => await importKml(file)}
            mapStyle={settings.mapProvider === 'satellite' ? 'satellite' : 'dark'}
            geojson={osmToGeoJSON(osmData)}
            onFeatureSelect={feature => { setSelectedFeature(feature); setInspectorVisible(true); }}
            activeHeatmap={activeHeatmap} heatmapData={heatmapData}
          />

          <MapOverlayControls
            activeHeatmap={activeHeatmap} onHeatmapChange={setActiveHeatmap}
            economicData={economicData} isDashboardVisible={isDashboardVisible}
            onDashboardToggle={() => setDashboardVisible(v => !v)}
            longitudinalProfile={longitudinalProfile} isProfilePanelVisible={isProfilePanelVisible}
            onProfilePanelToggle={() => setProfilePanelVisible(v => !v)}
            aiSuggestion={aiSuggestion} isAiPanelVisible={isAiPanelVisible}
            onAiPanelToggle={() => setAiPanelVisible(v => !v)}
          />

          <BimInspector isVisible={isInspectorVisible} onClose={() => setInspectorVisible(false)} selectedFeature={selectedFeature} />
          <AiDesignPanel isVisible={isAiPanelVisible} onClose={() => setAiPanelVisible(false)} suggestion={aiSuggestion} />
          <HydrologicalProfilePanel isVisible={isProfilePanelVisible} onClose={() => setProfilePanelVisible(false)} data={longitudinalProfile} />
          <EnterpriseDashboard isVisible={isDashboardVisible} onClose={() => setDashboardVisible(false)} stats={stats} economics={economicData} />
          <FloatingLayerPanel settings={settings} onUpdateSettings={updateSettings} isDark={isDark} />

          <AnimatePresence>
            {elevationProfileData.length > 0 && (
              <ElevationProfile data={elevationProfileData} onClose={() => { clearProfile(); handleSelectionModeChange('circle'); }} isDark={isDark} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectionMode === 'pad' && polygon.length > 2 && (
              <EarthworkPanel
                polygonPoints={polygon.map(p => [p.lat, p.lng] as [number, number])}
                onClose={() => handleSelectionModeChange('pad')}
                isDark={isDark}
                onCalculate={targetZ => calculateEarthwork(polygon, targetZ)}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
