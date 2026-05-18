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
import { useBtDxfWorkflow } from './hooks/useBtDxfWorkflow';
import { useBtExportHistory } from './hooks/useBtExportHistory';
import { useDgOptimization } from './hooks/useDgOptimization';
import { useBtTelescopicAnalysis } from './hooks/useBtTelescopicAnalysis';
import { useAppEngineeringWorkflows } from './hooks/useAppEngineeringWorkflows';
import { useProjectDataWorkflow } from './hooks/useProjectDataWorkflow';
import { useBtPoleOperations } from './hooks/useBtPoleOperations';
import { useAppBimInspector } from './hooks/useAppBimInspector';
import { useBtEdgeOperations } from './hooks/useBtEdgeOperations';
import { useBtTransformerOperations } from './hooks/useBtTransformerOperations';
import { AppWorkspace } from './components/AppWorkspace';
import { SnapshotModal } from './components/SnapshotModal';
import { CommandPalette } from './components/CommandPalette';
import { HelpModal } from './components/HelpModal';
import SettingsModal from './components/SettingsModal';
import { downloadCsv, downloadJson } from './utils/downloads';
import { haversineDistanceMeters } from '../shared/geodesic';
import type { CriticalConfirmationConfig } from './components/BtModals';
import type {
  BtTopology,
  GlobalState,
  BtNetworkScenario,
  BtNetworkScenarioPayload,
  BtEditorModePayload,
  AppSettings,
} from './types';
import { ToastProvider } from './hooks/useToast';

/** Topologia BT vazia — fallback quando o estado ainda não foi carregado. */
const EMPTY_BT_TOPOLOGY: BtTopology = { poles: [], transformers: [], edges: [] };

const escapeCsvCell = (value: string | number | boolean) => {
  const normalized = String(value).replace(/\r?\n/g, ' ');
  if (normalized.includes(';') || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

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
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);
  const [criticalConfirmationModal, setCriticalConfirmationModal] =
    React.useState<CriticalConfirmationConfig | null>(null);
  const [selectedPoleId, setSelectedPoleId] = React.useState('');
  const [selectedPoleIds, setSelectedPoleIds] = React.useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState('');
  const [selectedTransformerId, setSelectedTransformerId] = React.useState('');

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
    handleMapClick,
    handlePolygonChange,
    handleRadiusChange,
    handleClearPolygon,
    polygonPoints,
    isPolygonValid,
    handleRestoreSession,
    handleDismissSession,
    sessionDraft,
  } = mapState;

  const { settings, btTopology = EMPTY_BT_TOPOLOGY, btNetworkScenario, btEditorMode } = appState;
  const resolvedBtEditorMode: BtEditorModePayload = btEditorMode ?? { mode: 'none' };

  // ─── Handlers ─────────────────────────────────────────────────────────────
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

  const handleBtRenamePole = React.useCallback(
    (poleId: string, title: string) => {
      setAppState(
        prev => ({
          ...prev,
          btTopology: {
            ...prev.btTopology,
            poles: prev.btTopology.poles.map(pole =>
              pole.id === poleId ? { ...pole, title } : pole
            ),
          },
        }),
        true,
        'Renomear Poste BT'
      );
    },
    [setAppState]
  );

  const handleBtRenameTransformer = React.useCallback(
    (transformerId: string, title: string) => {
      setAppState(
        prev => ({
          ...prev,
          btTopology: {
            ...prev.btTopology,
            transformers: prev.btTopology.transformers.map(transformer =>
              transformer.id === transformerId ? { ...transformer, title } : transformer
            ),
          },
        }),
        true,
        'Renomear Transformador BT'
      );
    },
    [setAppState]
  );

  const handleBtSetEdgeChangeFlag = React.useCallback(
    (edgeId: string, edgeChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => {
      setAppState(
        prev => ({
          ...prev,
          btTopology: {
            ...prev.btTopology,
            edges: prev.btTopology.edges.map(edge =>
              edge.id === edgeId ? { ...edge, edgeChangeFlag } : edge
            ),
          },
        }),
        true,
        'Atualizar Flag de Trecho BT'
      );
    },
    [setAppState]
  );

  const handleBtSetPoleChangeFlag = React.useCallback(
    (poleId: string, nodeChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => {
      setAppState(
        prev => ({
          ...prev,
          btTopology: {
            ...prev.btTopology,
            poles: prev.btTopology.poles.map(pole =>
              pole.id === poleId ? { ...pole, nodeChangeFlag } : pole
            ),
          },
        }),
        true,
        'Atualizar Flag de Poste BT'
      );
    },
    [setAppState]
  );

  const handleBtTogglePoleCircuitBreak = React.useCallback(
    (poleId: string, circuitBreakPoint: boolean) => {
      setAppState(
        prev => ({
          ...prev,
          btTopology: {
            ...prev.btTopology,
            poles: prev.btTopology.poles.map(pole =>
              pole.id === poleId ? { ...pole, circuitBreakPoint } : pole
            ),
          },
        }),
        true,
        'Atualizar Disjuntor do Poste BT'
      );
    },
    [setAppState]
  );

  const handleBtSetTransformerChangeFlag = React.useCallback(
    (transformerId: string, transformerChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => {
      setAppState(
        prev => ({
          ...prev,
          btTopology: {
            ...prev.btTopology,
            transformers: prev.btTopology.transformers.map(transformer =>
              transformer.id === transformerId
                ? { ...transformer, transformerChangeFlag }
                : transformer
            ),
          },
        }),
        true,
        'Atualizar Flag de Transformador BT'
      );
    },
    [setAppState]
  );

  const handleBtSelectedPoleChange = React.useCallback((poleId: string) => {
    setSelectedPoleId(poleId);
    setSelectedPoleIds(poleId ? [poleId] : []);
  }, []);

  const handleBtSelectedTransformerChange = React.useCallback((transformerId: string) => {
    setSelectedTransformerId(transformerId);
  }, []);

  const handleBtSelectedEdgeChange = React.useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
  }, []);

  const btPoleOperations = useBtPoleOperations({
    appState,
    setAppState,
    showToast,
    onSelectedPoleChange: handleBtSelectedPoleChange,
    undo,
  });

  const btEdgeOperations = useBtEdgeOperations({
    appState,
    setAppState,
    showToast,
    findNearestPole: btPoleOperations.findNearestPole,
    undo,
  });

  const btTransformerOperations = useBtTransformerOperations({
    appState,
    setAppState,
    showToast,
    findNearestPole: btPoleOperations.findNearestPole,
    undo,
  });

  const projectDataWorkflow = useProjectDataWorkflow({
    appState,
    setAppState,
    clearData: osmEngine.clearData,
    clearPendingBtEdge: btEdgeOperations.clearPendingBtEdge,
    showToast,
  });

  const handleBtSelectPoleFromMap = React.useCallback((poleId: string, isShiftSelect?: boolean) => {
    if (!isShiftSelect) {
      setSelectedPoleId(poleId);
      setSelectedPoleIds(poleId ? [poleId] : []);
      return;
    }

    setSelectedPoleIds(prev => {
      const next = prev.includes(poleId) ? prev.filter(id => id !== poleId) : [...prev, poleId];

      setSelectedPoleId(next.length === 1 ? next[0] : poleId);
      return next;
    });
  }, []);

  const requestCriticalConfirmation = React.useCallback((config: CriticalConfirmationConfig) => {
    if (typeof window === 'undefined') {
      config.onConfirm();
      return;
    }

    setCriticalConfirmationModal(config);
  }, []);

  const closeCriticalConfirmationModal = React.useCallback(() => {
    setCriticalConfirmationModal(null);
  }, []);

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

  const dgWorkflow = useDgOptimization();
  const btTelescopicWorkflow = useBtTelescopicAnalysis();

  const findNearestMtPole = React.useCallback(
    (location: { lat: number; lng: number }, maxDistanceMeters = 15) => {
      const mtPoles = topologySources.mtTopology?.poles ?? [];
      let nearest: (typeof mtPoles)[number] | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const pole of mtPoles) {
        const distance = haversineDistanceMeters(
          { lat: location.lat, lng: location.lng },
          { lat: pole.lat, lng: pole.lng }
        );

        if (distance < nearestDistance) {
          nearest = pole;
          nearestDistance = distance;
        }
      }

      if (!nearest || nearestDistance > maxDistanceMeters) {
        return null;
      }

      return nearest;
    },
    [topologySources.mtTopology]
  );

  const engineeringWorkflows = useAppEngineeringWorkflows({
    dgTopologySource: topologySources.dgTopologySource,
    runDgOptimization: dgWorkflow.runDgOptimization,
    dgResult: dgWorkflow.result,
    logDgDecision: dgWorkflow.logDgDecision,
    dgActiveScenario: dgWorkflow.activeScenario,
    setAppState,
    applyDgAll: dgWorkflow.applyDgAll,
    applyDgTrafoOnly: dgWorkflow.applyDgTrafoOnly,
    clearDgResult: dgWorkflow.clearDgResult,
    showToast,
    findNearestMtPole,
    updateBtTopology,
    isBtTelescopicAnalyzing: btTelescopicWorkflow.isAnalyzing,
    triggerBtTelescopicAnalysis: btTelescopicWorkflow.triggerAnalysis,
    btTopology,
    btAccumulatedByPole: derivedState.btAccumulatedByPole ?? [],
    btTransformerDebugById: derivedState.btTransformerDebugById ?? {},
    requestCriticalConfirmation,
    settings,
    clearBtTelescopicSuggestions: btTelescopicWorkflow.clearSuggestions,
  });

  const btHistoryProjectType = settings.projectType === 'clandestino' ? 'clandestino' : 'ramais';

  const bimInspector = useAppBimInspector({
    selectedPoleId: selectedPoleId || null,
    selectedPoleIds,
    btTopology,
    btAccumulatedByPole: derivedState.btAccumulatedByPole ?? [],
  });

  const btExportHistoryState = useBtExportHistory({
    appState,
    setAppState: (state, addToHistory) =>
      setAppState(state, addToHistory, 'Atualizar Histórico BT'),
    showToast,
    projectType: btHistoryProjectType,
  });

  const validateBtBeforeExport = React.useCallback(() => {
    if (!settings.layers.btNetwork) {
      return true;
    }

    const edgeWithoutConductors = btTopology.edges.find(edge => edge.conductors.length === 0);
    if (edgeWithoutConductors) {
      showToast(`Trecho ${edgeWithoutConductors.id} sem condutores definidos.`, 'error');
      return false;
    }

    return true;
  }, [settings.layers.btNetwork, btTopology.edges, showToast]);

  const btScenarioForDxf: BtNetworkScenario =
    btNetworkScenario?.mode === 'clandestino' ? 'projeto' : 'asis';

  const {
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    isDownloading: isDxfDownloading,
    jobId: dxfJobId,
    jobStatus: dxfJobStatus,
    jobProgress: dxfJobProgress,
  } = useBtDxfWorkflow({
    center: appState.center,
    radius: appState.radius,
    selectionMode: appState.selectionMode,
    polygon: appState.polygon,
    settings,
    btTopology,
    btNetworkScenario: btScenarioForDxf,
    hasOsmData: Boolean(osmEngine.osmData),
    validateBtBeforeExport,
    showToast,
    ingestBtContextHistory: btExportHistoryState.ingestBtContextHistory,
    dgResults: engineeringWorkflows.lastAppliedDgResults ?? undefined,
  });

  const analysisWorkflow = useAppAnalysisWorkflow({
    appState,
    setAppState,
    clearData: osmEngine.clearData,
    showToast,
    clearPendingBtEdge: btEdgeOperations.clearPendingBtEdge,
    handleBaseSelectionModeChange: handleSelectionModeChange,
    runAnalysis: osmEngine.runAnalysis,
    isDownloading: isDxfDownloading,
    jobId: dxfJobId,
    jobStatus: dxfJobStatus,
    jobProgress: dxfJobProgress,
  });

  const exportBtHistoryJson = React.useCallback(() => {
    const history = btExportHistoryState.btExportHistory;
    if (history.length === 0) {
      showToast('Não há histórico BT para exportar.', 'info');
      return;
    }

    const projectName = settings.projectMetadata?.projectName || 'sisRUA';

    const payload = {
      exportedAt: new Date().toISOString(),
      projectName,
      projectType: settings.projectType ?? 'ramais',
      totalEntries: history.length,
      latest: history[0],
      entries: history,
    };

    downloadJson(payload, `${projectName}_bt_history.json`, settings.locale, true);
    showToast('Histórico BT exportado em JSON.', 'success');
  }, [btExportHistoryState.btExportHistory, settings, showToast]);

  const exportBtHistoryCsv = React.useCallback(() => {
    const history = btExportHistoryState.btExportHistory;
    if (history.length === 0) {
      showToast('Não há histórico BT para exportar.', 'info');
      return;
    }

    const projectName = settings.projectMetadata?.projectName || 'sisRUA';

    const header = [
      'exportedAt',
      'projectType',
      'criticalPoleId',
      'criticalAccumulatedClients',
      'criticalAccumulatedDemandKva',
      'cqtScenario',
      'cqtDmdi',
      'cqtP31',
      'cqtP32',
      'cqtK10QtMttr',
      'cqtParityStatus',
      'cqtParityPassed',
      'cqtParityFailed',
      'btContextUrl',
      'verifiedPoles',
      'totalPoles',
      'verifiedEdges',
      'totalEdges',
      'verifiedTransformers',
      'totalTransformers',
    ];

    const rows = history.map(entry => [
      entry.exportedAt,
      entry.projectType,
      entry.criticalPoleId,
      entry.criticalAccumulatedClients,
      entry.criticalAccumulatedDemandKva.toFixed(2),
      entry.cqt?.scenario ?? '',
      entry.cqt?.dmdi?.toFixed(6) ?? '',
      entry.cqt?.p31?.toFixed(6) ?? '',
      entry.cqt?.p32?.toFixed(6) ?? '',
      entry.cqt?.k10QtMttr?.toFixed(9) ?? '',
      entry.cqt?.parityStatus ?? '',
      entry.cqt?.parityPassed ?? '',
      entry.cqt?.parityFailed ?? '',
      entry.btContextUrl,
      entry.verifiedPoles ?? 0,
      entry.totalPoles ?? 0,
      entry.verifiedEdges ?? 0,
      entry.totalEdges ?? 0,
      entry.verifiedTransformers ?? 0,
      entry.totalTransformers ?? 0,
    ]);

    const csv = [header, ...rows]
      .map(row => row.map(value => escapeCsvCell(value)).join(';'))
      .join('\n');

    downloadCsv(csv, `${projectName}_bt_history.csv`);
    showToast('Histórico BT exportado em CSV.', 'success');
  }, [btExportHistoryState.btExportHistory, settings, showToast]);

  // ─── Fallbacks para hooks pendentes de refatoração (T3-138) ──────────────
  const handleResetBtTopology = React.useCallback(() => {
    setResetConfirmOpen(true);
  }, []);

  const handleConfirmResetBtTopology = React.useCallback(() => {
    setResetConfirmOpen(false);
    setAppState(
      prev => ({ ...prev, btTopology: { poles: [], transformers: [], edges: [] } }),
      true,
      'Reset Topologia BT'
    );
  }, [setAppState]);

  // ─── Command Palette ─────────────────────────────────────────────────────
  const { commandPaletteActions } = useAppCommandPalette({
    locale: settings.locale,
    handleSaveProject: projectDataWorkflow.handleSaveProject,
    handleLoadProject: projectDataWorkflow.handleLoadProject,
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
    handleRunDgOptimization: () => {
      engineeringWorkflows.handleRunDgOptimization();
    },
    handleTriggerTelescopicAnalysis: () => {
      engineeringWorkflows.handleTriggerTelescopicAnalysis();
    },
    setBtNetworkScenario,
    setBtEditorMode,
    setIsCommandPaletteOpen,
    setSelectedPoleId,
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
    btEditorMode: resolvedBtEditorMode,
    btTopology,
    dgTopologySource: topologySources.dgTopologySource,
    btAccumulatedByPole: derivedState.btAccumulatedByPole ?? [],
    btSummary: derivedState.btSummary,
    btPointDemandKva: derivedState.btPointDemandKva ?? 0,
    btTransformerDebugById: derivedState.btTransformerDebugById ?? {},
    btPoleCoordinateInput: btPoleOperations.btPoleCoordinateInput,
    setBtPoleCoordinateInput: btPoleOperations.setBtPoleCoordinateInput,
    handleBtInsertPoleByCoordinates: btPoleOperations.handleBtInsertPoleByCoordinates,
    clearPendingBtEdge: btEdgeOperations.clearPendingBtEdge,
    pendingNormalClassificationPoles: btPoleOperations.pendingNormalClassificationPoles,
    handleResetBtTopology,
    updateBtTopology,
    updateProjectType: (p: any) =>
      setAppState(prev => ({ ...prev, settings: { ...prev.settings, projectType: p } }), true),
    updateClandestinoAreaM2: (a: number) =>
      setAppState(p => ({ ...p, settings: { ...p.settings, clandestinoAreaM2: a } }), true),
    handleBtSelectedPoleChange,
    handleBtSelectedTransformerChange,
    handleBtSelectedEdgeChange,
    handleBtRenamePole,
    handleBtRenameTransformer,
    handleBtSetEdgeChangeFlag,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtSetTransformerChangeFlag,
    btClandestinoDisplay: derivedState.btClandestinoDisplay,
    btTransformersDerived: derivedState.btTransformersDerived ?? [],
    requestCriticalConfirmation,
    handleTriggerTelescopicAnalysis: engineeringWorkflows.handleTriggerTelescopicAnalysis,
    isDgOptimizing: dgWorkflow.isOptimizing,
    dgResult: dgWorkflow.result,
    dgError: dgWorkflow.error,
    dgActiveAltIndex: dgWorkflow.activeAltIndex,
    handleRunDgOptimization: engineeringWorkflows.handleRunDgOptimization,
    handleAcceptDgAll: engineeringWorkflows.handleAcceptDgAll,
    handleAcceptDgTrafoOnly: engineeringWorkflows.handleAcceptDgTrafoOnly,
    handleDiscardDgResult: engineeringWorkflows.handleDiscardDgResult,
    setDgActiveAltIndex: dgWorkflow.setActiveAltIndex,
    isPreviewActive: dgWorkflow.isPreviewActive,
    setIsPreviewActive: dgWorkflow.setIsPreviewActive,
    selectedPoleId,
    selectedPoleIds,
    selectedEdgeId,
    selectedTransformerId,
    setSelectedPoleId,
    setSelectedPoleIds,
    setSelectedEdgeId,
    setSelectedTransformerId,
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
    isFocusModeManual || (!!settings.enableFocusMode && resolvedBtEditorMode.mode !== 'none');

  useAppGlobalHotkeys(setIsFocusModeManual, setIsXRayMode, settings.theme, theme =>
    updateSettings({ ...settings, theme })
  );

  const mapSelectorProps = React.useMemo(
    () => ({
      center: appState.center,
      radius: appState.radius,
      selectionMode: appState.selectionMode,
      polygonPoints,
      onLocationChange: handleMapClick,
      onPolygonChange: handlePolygonChange,
      btMarkerTopology: btTopology,
      btPopupTopology: btTopology,
      btEditorMode: resolvedBtEditorMode.mode,
      pendingBtEdgeStartPoleId: btEdgeOperations.pendingBtEdgeStartPoleId,
      onBtMapClick: (location: { lat: number; lng: number; label?: string }) => {
        if (resolvedBtEditorMode.mode === 'add-edge') {
          btEdgeOperations.handleBtMapClickAddEdge(location);
          return;
        }

        if (resolvedBtEditorMode.mode === 'add-pole') {
          btPoleOperations.insertBtPoleAtLocation(location);
          return;
        }

        if (resolvedBtEditorMode.mode === 'add-transformer') {
          btTransformerOperations.handleBtMapClickAddTransformer(location);
        }
      },
      onBtDeleteTransformer: btTransformerOperations.handleBtDeleteTransformer,
      onBtToggleTransformerOnPole: btTransformerOperations.handleBtToggleTransformerOnPole,
      onBtDragTransformer: btTransformerOperations.handleBtDragTransformer,
      onBtSelectPole: handleBtSelectPoleFromMap,
      dgScenario: dgWorkflow.isPreviewActive ? dgWorkflow.activeScenario : null,
      dgGhostMode: dgWorkflow.isPreviewActive && dgWorkflow.activeScenario != null,
      mtMarkerTopology: appState.mtTopology,
      mtPopupTopology: appState.mtTopology,
      mtEditorMode: 'none' as const,
    }),
    [
      appState.center,
      appState.radius,
      appState.selectionMode,
      appState.mtTopology,
      polygonPoints,
      handleMapClick,
      handlePolygonChange,
      btTopology,
      resolvedBtEditorMode.mode,
      btEdgeOperations.pendingBtEdgeStartPoleId,
      handleBtSelectPoleFromMap,
      btEdgeOperations.handleBtMapClickAddEdge,
      btPoleOperations.insertBtPoleAtLocation,
      btTransformerOperations.handleBtMapClickAddTransformer,
      btTransformerOperations.handleBtDeleteTransformer,
      btTransformerOperations.handleBtToggleTransformerOnPole,
      btTransformerOperations.handleBtDragTransformer,
      dgWorkflow.isPreviewActive,
      dgWorkflow.activeScenario,
    ]
  );

  const latestBtExportUi = React.useMemo(() => {
    const latest = btExportHistoryState.latestBtExport;
    if (!latest) {
      return null;
    }

    const latestHistoryEntry = btExportHistoryState.btExportHistory[0];

    return {
      timestamp: latestHistoryEntry?.exportedAt ?? new Date().toISOString(),
      filename: latest.btContextUrl,
    };
  }, [btExportHistoryState.latestBtExport, btExportHistoryState.btExportHistory]);

  const btExportHistoryUi = React.useMemo(
    () =>
      btExportHistoryState.btExportHistory.map(entry => ({
        timestamp: entry.exportedAt,
        filename: entry.btContextUrl,
      })),
    [btExportHistoryState.btExportHistory]
  );

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={clsx(
        'h-screen w-screen flex flex-col overflow-hidden',
        settings.theme === 'dark' ? 'dark' : ''
      )}
    >
      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          actions={commandPaletteActions}
          locale={settings.locale}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      )}

      {isHelpOpen && (
        <HelpModal
          isOpen={isHelpOpen}
          locale={settings.locale}
          onClose={() => setIsHelpOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          settings={settings}
          onUpdateSettings={(updated: AppSettings) => {
            updateSettings(updated);
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <AppWorkspace
        settings={settings}
        isDark={settings.theme === 'dark'}
        isFocusMode={isFocusMode}
        isXRayMode={isXRayMode}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        appPast={appPast}
        appFuture={appFuture}
        handleSaveProject={projectDataWorkflow.handleSaveProject}
        handleLoadProject={projectDataWorkflow.handleLoadProject}
        openSettings={openSettings}
        setIsHelpOpen={setIsHelpOpen}
        toasts={toasts}
        closeToast={closeToast}
        sessionDraft={sessionDraft}
        handleRestoreSession={handleRestoreSession}
        handleDismissSession={handleDismissSession}
        isProcessing={osmEngine.isProcessing}
        isDownloading={isDxfDownloading}
        progressValue={osmEngine.progressValue}
        statusMessage={osmEngine.statusMessage}
        showDxfProgress={analysisWorkflow.showDxfProgress}
        dxfProgressValue={analysisWorkflow.dxfProgressValue}
        dxfProgressStatus={analysisWorkflow.dxfProgressStatus ?? ''}
        dxfProgressLabel={analysisWorkflow.dxfProgressLabel}
        latestBtExport={latestBtExportUi}
        btExportHistory={btExportHistoryUi}
        exportBtHistoryJson={exportBtHistoryJson}
        exportBtHistoryCsv={exportBtHistoryCsv}
        handleClearBtExportHistory={btExportHistoryState.handleClearBtExportHistory}
        btHistoryTotal={btExportHistoryState.btHistoryTotal}
        btHistoryLoading={btExportHistoryState.btHistoryLoading}
        btHistoryCanLoadMore={btExportHistoryState.btHistoryCanLoadMore}
        handleLoadMoreBtHistory={btExportHistoryState.handleLoadMoreBtHistory}
        btHistoryProjectTypeFilter={btExportHistoryState.btHistoryProjectTypeFilter}
        setBtHistoryProjectTypeFilter={(v: string) => {
          btExportHistoryState.setBtHistoryProjectTypeFilter(
            v === 'ramais' || v === 'clandestino' || v === 'all' ? v : 'all'
          );
        }}
        btHistoryCqtScenarioFilter={btExportHistoryState.btHistoryCqtScenarioFilter}
        setBtHistoryCqtScenarioFilter={(v: string) => {
          btExportHistoryState.setBtHistoryCqtScenarioFilter(
            v === 'atual' || v === 'proj1' || v === 'proj2' || v === 'all' ? v : 'all'
          );
        }}
        updateSettings={updateSettings}
        selectionMode={appState.selectionMode}
        handleSelectionModeChange={analysisWorkflow.handleSelectionModeChange}
        radius={appState.radius}
        handleRadiusChange={handleRadiusChange}
        polygon={appState.polygon}
        handleClearPolygon={handleClearPolygon}
        osmData={osmEngine.osmData}
        handleDownloadDxf={handleDownloadDxf}
        handleDownloadGeoJSON={handleDownloadGeoJSON}
        isSidebarDockedForRamalModal={btPoleOperations.isSidebarDockedForRamalModal}
        sidebarSelectionControlsProps={sidebarProps.sidebarSelectionControlsProps}
        sidebarBtEditorSectionProps={sidebarProps.sidebarBtEditorSectionProps}
        mtTopology={appState.mtTopology}
        updateMtTopology={topology => {
          setAppState(prev => ({ ...prev, mtTopology: topology }), true, 'Atualizar Topologia MT');
        }}
        hasBtPoles={btTopology.poles.length > 0}
        sidebarAnalysisResultsProps={sidebarProps.sidebarAnalysisResultsProps}
        mapSelectorProps={mapSelectorProps}
        elevationProfileData={elevationProfile.profileData}
        clearProfile={elevationProfile.clearProfile}
        btModalStackProps={{
          normalRamalModal: btPoleOperations.normalRamalModal,
          setNormalRamalModal: btPoleOperations.setNormalRamalModal,
          handleConfirmNormalRamalModal: btPoleOperations.handleConfirmNormalRamalModal,
          clandestinoToNormalModal: btPoleOperations.clandestinoToNormalModal,
          setClandestinoToNormalModal: btPoleOperations.setClandestinoToNormalModal,
          handleClandestinoToNormalClassifyLater:
            btPoleOperations.handleClandestinoToNormalClassifyLater,
          handleClandestinoToNormalConvertNow: btPoleOperations.handleClandestinoToNormalConvertNow,
          normalToClandestinoModal: btPoleOperations.normalToClandestinoModal,
          setNormalToClandestinoModal: btPoleOperations.setNormalToClandestinoModal,
          handleNormalToClandestinoKeepClients:
            btPoleOperations.handleNormalToClandestinoKeepClients,
          handleNormalToClandestinoZeroNormalClients:
            btPoleOperations.handleNormalToClandestinoZeroNormalClients,
          resetConfirmOpen,
          handleConfirmResetBtTopology,
          setResetConfirmOpen,
          criticalConfirmationModal,
          closeCriticalConfirmationModal,
        }}
        showToast={showToast}
        isBimInspectorOpen={bimInspector.isBimInspectorOpen}
        setIsBimInspectorOpen={bimInspector.setIsBimInspectorOpen}
        inspectedPole={bimInspector.inspectedPole}
        inspectedTransformer={bimInspector.inspectedTransformer}
        inspectedAccumulatedData={bimInspector.inspectedAccumulatedData}
        btTopology={btTopology}
        canonicalTopology={appState.canonicalTopology}
        updateBtTopology={updateBtTopology}
        btNetworkScenario={btNetworkScenario}
        btEditorMode={resolvedBtEditorMode}
        setBtNetworkScenario={setBtNetworkScenario}
        setBtEditorMode={setBtEditorMode}
        handleBtRenamePole={handleBtRenamePole}
        handleBtSetPoleChangeFlag={handleBtSetPoleChangeFlag}
        autoSaveStatus={autoSave.status}
        lastAutoSaved={autoSave.lastSaved}
        isAuditOpen={electricalAudit.isAuditOpen}
        setIsAuditOpen={electricalAudit.setIsAuditOpen}
        selectedAuditElement={electricalAudit.selectedAuditElement}
        handleAuditAction={electricalAudit.handleAuditAction}
        btTelescopicSuggestions={btTelescopicWorkflow.suggestions?.suggestions ?? []}
        handleApplyTelescopicSuggestions={engineeringWorkflows.handleApplyTelescopicSuggestions}
        clearBtTelescopicSuggestions={btTelescopicWorkflow.clearSuggestions}
        isHelpOpen={isHelpOpen}
        onOpenSnapshots={() => setIsSnapshotModalOpen(true)}
        isCommandPaletteOpen={isCommandPaletteOpen}
        setIsCommandPaletteOpen={setIsCommandPaletteOpen}
        commandPaletteActions={commandPaletteActions}
        handleGoToPole={setSelectedPoleId}
        terrainData={osmEngine.terrainData}
        showSettings={showSettings}
        closeSettings={closeSettings}
        complianceResults={compliance.result}
        isCalculating={derivedState.isCalculating}
      />

      <SnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        projetoId={projeto_id ?? ''}
        currentState={appState}
        onRestore={(state: GlobalState) => {
          setAppState(state, false, 'Restaurar Snapshot');
          setIsSnapshotModalOpen(false);
          showToast('Snapshot restaurado com sucesso.', 'success');
        }}
      />
    </div>
  );
}

export default App;
