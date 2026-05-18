import React from 'react';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ProjectService } from './services/projectService';
import { useAppHooks } from './hooks/useAppHooks';
import { useAppCommandPalette } from './hooks/useAppCommandPalette';
import { useAppElectricalAudit } from './hooks/useAppElectricalAudit';
import { useAppSidebarProps } from './hooks/useAppSidebarProps';
import { useAppAnalysisWorkflow } from './hooks/useAppAnalysisWorkflow';
import { useAppGlobalHotkeys } from './hooks/useAppGlobalHotkeys';
import { AppWorkspace } from './components/AppWorkspace';
import { SnapshotModal } from './components/SnapshotModal';
import { HelpModal } from './components/HelpModal';
import { CommandPalette } from './components/CommandPalette';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import type {
  BtTopology,
  GlobalState,
  BtNetworkScenarioPayload,
  BtEditorModePayload,
} from './types';
import { ToastProvider } from './hooks/useToast';

/** Topologia BT vazia — fallback quando o estado ainda não foi carregado. */
const EMPTY_BT_TOPOLOGY: BtTopology = { poles: [], transformers: [], edges: [] };

/**
 * Componente Raiz da Aplicação (Tier 3 — sisrua_unified).
 * Orquestra os fluxos de engenharia, mapa e dados via hooks de domínio.
 *
 * Arquitetura: Smart Backend / Thin Frontend.
 * Cada responsabilidade é delegada a um hook dedicado.
 */
function App() {
  const { projeto_id } = useParams<{ projeto_id: string }>();
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isFocusModeManual, setIsFocusModeManual] = React.useState(false);
  const [isXRayMode, setIsXRayMode] = React.useState(false);
  const [selectedPoleId, setSelectedPoleId] = React.useState('');

  // ─── Core Hooks ──────────────────────────────────────────────────────────
  const {
    orchestrator,
    osmEngine,
    autoSave,
    elevationProfile,
    mapState,
    topologySources,
    derivedState,
    compliance,
  } = useAppHooks(projeto_id);

  const { appState, setAppState, undo, redo, canUndo, canRedo, appPast, appFuture, saveSnapshot } =
    orchestrator;

  const {
    updateSettings,
    showToast,
    toasts,
    closeToast,
    showSettings,
    openSettings,
    closeSettings,
    handleSelectionModeChange,
    handleRadiusChange,
    handleClearPolygon,
    isPolygonValid,
    handleRestoreSession,
    handleDismissSession,
    sessionDraft,
  } = mapState;

  const { settings, btTopology = EMPTY_BT_TOPOLOGY, btNetworkScenario, btEditorMode } = appState;

  const currentToast = toasts[0] ?? null;
  const dismissToast = closeToast;
  const isSettingsOpen = showSettings;

  const setBtNetworkScenario = React.useCallback(
    (s: BtNetworkScenarioPayload | null) => {
      setAppState((p: GlobalState) => ({ ...p, btNetworkScenario: s }), true, 'Alterar Cenário BT');
    },
    [setAppState]
  );

  const setBtEditorMode = React.useCallback(
    (m: BtEditorModePayload) => {
      setAppState((p: GlobalState) => ({ ...p, btEditorMode: m }), true, `Modo: ${m.mode}`);
    },
    [setAppState]
  );

  const updateBtTopology = React.useCallback(
    (topology: BtTopology) => {
      setAppState(
        (p: GlobalState) => ({ ...p, btTopology: topology }),
        true,
        'Atualizar Topologia BT'
      );
    },
    [setAppState]
  );

  // ─── Carregar projeto da URL ──────────────────────────────────────────────

  React.useEffect(() => {
    if (projeto_id) {
      ProjectService.getProjectState(projeto_id).then(state => {
        if (state) {
          setAppState(state, false, 'Carregamento de Projeto');
          showToast('Projeto carregado com sucesso.', 'success');
        } else {
          showToast('Falha ao carregar projeto.', 'error');
        }
      });
    }
  }, [projeto_id, setAppState, showToast]);

  // ─── Domain Hooks ────────────────────────────────────────────────────────
  const electricalAudit = useAppElectricalAudit({ settings, showToast });

  const analysisWorkflow = useAppAnalysisWorkflow({
    appState,
    setAppState,
    clearData: osmEngine.clearData,
    showToast,
    clearPendingBtEdge: () => {},
    handleBaseSelectionModeChange: handleSelectionModeChange,
    runAnalysis: osmEngine.runAnalysis,
    isDownloading: osmEngine.isProcessing,
    jobId: null,
    jobStatus: null,
    jobProgress: 0,
  });

  // ─── Fallbacks para hooks pendentes de refatoração (T3-138) ──────────────
  const handleDownloadGeoJSON = React.useCallback(async () => {
    showToast('Exportação GeoJSON em desenvolvimento.', 'info');
  }, [showToast]);

  const handleDownloadDxf = React.useCallback(async () => {
    showToast('Exportação DXF em desenvolvimento.', 'info');
  }, [showToast]);

  const handleDownloadCoordinatesCsv = React.useCallback(() => {
    showToast('Exportação CSV em desenvolvimento.', 'info');
  }, [showToast]);

  const handleResetBtTopology = React.useCallback(() => {
    setAppState(
      prev => ({ ...prev, btTopology: { poles: [], transformers: [], edges: [] } }),
      true,
      'Reset Topologia BT'
    );
  }, [setAppState]);

  // ─── Command Palette ─────────────────────────────────────────────────────
  const { commandPaletteActions } = useAppCommandPalette({
    locale: settings.locale,
    handleSaveProject: saveSnapshot,
    handleLoadProject: () => { showToast('Carregamento de projeto não disponível.', 'info'); },
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    handleResetBtTopology,
    exportBtHistoryJson: () => { showToast('Exportação de histórico não disponível.', 'info'); },
    exportBtHistoryCsv: () => { showToast('Exportação de histórico não disponível.', 'info'); },
    undo,
    redo,
    setIsHelpOpen,
    openSettings,
    isFocusModeManual,
    setIsFocusModeManual,
    handleRunDgOptimization: () => { showToast('Otimização DG não disponível.', 'info'); },
    handleTriggerTelescopicAnalysis: () => { showToast('Análise telescópica não disponível.', 'info'); },
    setBtNetworkScenario,
    setBtEditorMode,
    setIsCommandPaletteOpen,
  });

  // ─── Sidebar Props ───────────────────────────────────────────────────────
  const sidebarProps = useAppSidebarProps({
    settings,
    center: appState.center,
    searchQuery: analysisWorkflow.searchQuery,
    setSearchQuery: analysisWorkflow.setSearchQuery,
    isSearching: analysisWorkflow.isSearching,
    handleSearch: analysisWorkflow.handleSearch,
    selectionMode: appState.selectionMode,
    handleSelectionModeChange: analysisWorkflow.handleSelectionModeChange,
    radius: appState.radius,
    handleRadiusChange,
    saveSnapshot,
    handleFetchAndAnalyze: analysisWorkflow.handleFetchAndAnalyze,
    isProcessing: osmEngine.isProcessing,
    isPolygonValid,
    setBtNetworkScenario,
    setBtEditorMode,
    btNetworkScenario,
    btEditorMode,
    btTopology,
    dgTopologySource: topologySources.dgTopologySource,
    btAccumulatedByPole: derivedState.btAccumulatedByPole ?? [],
    btSummary: derivedState.btSummary,
    btPointDemandKva: derivedState.btPointDemandKva ?? 0,
    btTransformerDebugById: derivedState.btTransformerDebugById ?? {},
    btPoleCoordinateInput: '',
    setBtPoleCoordinateInput: () => {},
    handleBtInsertPoleByCoordinates: () => { showToast('Inserção por coordenadas não disponível.', 'info'); },
    pendingNormalClassificationPoles: [],
    handleResetBtTopology,
    updateBtTopology,
    updateProjectType: (p: any) =>
      setAppState(prev => ({ ...prev, settings: { ...prev.settings, projectType: p } }), true),
    updateClandestinoAreaM2: (a: number) =>
      setAppState(p => ({ ...p, settings: { ...p.settings, clandestinoAreaM2: a } }), true),
    handleBtSelectedPoleChange: () => {},
    handleBtSelectedTransformerChange: () => {},
    handleBtSelectedEdgeChange: () => {},
    handleBtRenamePole: () => { showToast('Renomeação de poste não disponível.', 'info'); },
    handleBtRenameTransformer: () => { showToast('Renomeação de transformador não disponível.', 'info'); },
    handleBtSetEdgeChangeFlag: () => {},
    handleBtSetPoleChangeFlag: () => {},
    handleBtTogglePoleCircuitBreak: () => {},
    handleBtSetTransformerChangeFlag: () => {},
    btClandestinoDisplay: derivedState.btClandestinoDisplay,
    btTransformersDerived: derivedState.btTransformersDerived ?? [],
    requestCriticalConfirmation: () => {},
    handleTriggerTelescopicAnalysis: () => { showToast('Análise telescópica não disponível.', 'info'); },
    isDgOptimizing: false,
    dgResult: null,
    dgError: null,
    dgActiveAltIndex: 0,
    handleRunDgOptimization: () => { showToast('Otimização DG não disponível.', 'info'); },
    handleAcceptDgAll: () => { showToast('Aceitação de resultados DG não disponível.', 'info'); },
    handleAcceptDgTrafoOnly: () => { showToast('Aceitação de resultados DG não disponível.', 'info'); },
    handleDiscardDgResult: () => { showToast('Descarte de resultados DG não disponível.', 'info'); },
    setDgActiveAltIndex: () => {},
    isPreviewActive: false,
    setIsPreviewActive: () => {},
    selectedPoleId,
    selectedPoleIds: [],
    selectedEdgeId: '',
    selectedTransformerId: '',
    setSelectedPoleId,
    setSelectedPoleIds: () => {},
    setSelectedEdgeId: () => {},
    setSelectedTransformerId: () => {},
    mtTopology: topologySources.mtTopology,
    osmData: osmEngine.osmData,
    stats: osmEngine.stats,
    analysisText: osmEngine.analysisText ?? '',
    terrainData: osmEngine.terrainData,
    error: osmEngine.error,
    handleDownloadDxf,
    handleDownloadCoordinatesCsv,
    isDownloading: osmEngine.isProcessing,
    showToast,
    isCalculating: derivedState.isCalculating,
  });

  // ─── UI State ─────────────────────────────────────────────────────────────
  const isFocusMode =
    isFocusModeManual || (!!settings.enableFocusMode && btEditorMode.mode !== 'none');

  useAppGlobalHotkeys(setIsFocusModeManual, setIsXRayMode, settings.theme, theme =>
    updateSettings({ ...settings, theme })
  );

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={clsx(
        'h-screen w-screen flex flex-col overflow-hidden',
        settings.theme === 'dark' ? 'dark' : ''
      )}
    >
      <Toast
        toast={currentToast}
        onClose={dismissToast}
      />

      {isCommandPaletteOpen && (
        <CommandPalette
          actions={commandPaletteActions}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      )}

      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={(updated) => {
            updateSettings(updated);
            closeSettings();
          }}
          onClose={closeSettings}
        />
      )}

      <AppWorkspace
        settings={settings}
        appState={appState}
        setAppState={setAppState}
        sidebarProps={sidebarProps}
        isFocusMode={isFocusMode}
        isXRayMode={isXRayMode}
        selectedPoleId={selectedPoleId}
        setSelectedPoleId={setSelectedPoleId}
        osmEngine={osmEngine}
        btTopology={btTopology}
        updateBtTopology={updateBtTopology}
        btNetworkScenario={btNetworkScenario}
        btEditorMode={btEditorMode}
        setBtNetworkScenario={setBtNetworkScenario}
        setBtEditorMode={setBtEditorMode}
        topologySources={topologySources}
        derivedState={derivedState}
        openCommandPalette={() => setIsCommandPaletteOpen(true)}
        showToast={showToast}
      />
    </div>
  );
}

export default App;
