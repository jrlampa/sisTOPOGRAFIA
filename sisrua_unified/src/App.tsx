import React, { Suspense, useState, useEffect } from 'react';
import { Download, Map as MapIcon, Layers, Search, Loader2, AlertCircle, Settings, Mountain, TrendingUp } from 'lucide-react';
import { AnalysisStats, GlobalState, AppSettings, GeoLocation, SelectionMode, BtTopology, BtPoleNode, BtTransformer, BtEditorMode, BtExportSummary, BtExportHistoryEntry, BtNetworkScenario, BtCqtComputationInputs, BtEdge } from './types';
import { DEFAULT_LOCATION, MAX_RADIUS, MIN_RADIUS } from './constants';
import Toast, { ToastType } from './components/Toast';
import ProgressIndicator from './components/ProgressIndicator';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useOsmEngine } from './hooks/useOsmEngine';
import { useSearch } from './hooks/useSearch';
import { useDxfExport } from './hooks/useDxfExport';
import { useKmlImport } from './hooks/useKmlImport';
import { useFileOperations } from './hooks/useFileOperations';
import { useElevationProfile } from './hooks/useElevationProfile';
import { useAutoSave, loadSessionDraft, clearSessionDraft } from './hooks/useAutoSave';
import { useBtNavigationState } from './hooks/useBtNavigationState';
import {
  calculateAccumulatedDemandByPole,
  calculateEstimatedDemandByTransformer,
  calculateClandestinoDemandKvaByAreaAndClients,
  loadClandestinoWorkbookRules
} from './utils/btCalculations';
import { useBtCrudHandlers } from './hooks/useBtCrudHandlers';
import {
  getEdgeChangeFlag,
  getPoleChangeFlag,
  getTransformerChangeFlag,
  CLANDESTINO_RAMAL_TYPE,
  NORMAL_CLIENT_RAMAL_TYPES,
  MAX_BT_EXPORT_HISTORY,
  nextSequentialId,
  EMPTY_BT_TOPOLOGY,
  CURRENT_TO_DEMAND_CONVERSION,
  DEFAULT_TEMPERATURE_FACTOR
} from './utils/btNormalization';
import { motion, AnimatePresence } from 'framer-motion';

const MapSelector = React.lazy(() => import('./components/MapSelector'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const HistoryControls = React.lazy(() => import('./components/HistoryControls'));
const DxfLegend = React.lazy(() => import('./components/DxfLegend'));
const FloatingLayerPanel = React.lazy(() => import('./components/FloatingLayerPanel'));
const ElevationProfile = React.lazy(() => import('./components/ElevationProfile'));
const BatchUpload = React.lazy(() => import('./components/BatchUpload'));
const BtTopologyPanel = React.lazy(() => import('./components/BtTopologyPanel'));



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

const inferBranchSide = (rawLabel: string): 'ESQUERDO' | 'DIREITO' | undefined => {
  const label = rawLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (label.includes('ESQ') || label.includes('ESQUER')) {
    return 'ESQUERDO';
  }

  if (label.includes('DIR') || label.includes('DIREIT')) {
    return 'DIREITO';
  }

  return undefined;
};

function App() {
  const [, setClandestinoRulesVersion] = useState(0);
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
  const { center, radius, selectionMode, polygon, measurePath, settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btExportSummary = appState.btExportSummary ?? null;
  const btExportHistory = appState.btExportHistory ?? [];
  const latestBtExport = btExportSummary ?? btExportHistory[0] ?? null;
  const btNetworkScenario: BtNetworkScenario = settings.btNetworkScenario ?? 'asis';
  const isDark = settings.theme === 'dark';
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? 'none';

  useEffect(() => {
    let active = true;

    loadClandestinoWorkbookRules().then((loaded) => {
      if (active && loaded) {
        setClandestinoRulesVersion((version) => version + 1);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const btAccumulatedByPole = React.useMemo(
    () => calculateAccumulatedDemandByPole(btTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0),
    [btTopology, settings.projectType, settings.clandestinoAreaM2]
  );
  const btEstimatedByTransformer = React.useMemo(
    () => calculateEstimatedDemandByTransformer(btTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0),
    [btTopology, settings.projectType, settings.clandestinoAreaM2]
  );
  const btTransformerDebugById = React.useMemo(
    () => Object.fromEntries(
      btEstimatedByTransformer.map((entry) => [
        entry.transformerId,
        {
          assignedClients: entry.assignedClients,
          estimatedDemandKw: entry.estimatedDemandKw
        }
      ])
    ) as Record<string, { assignedClients: number; estimatedDemandKw: number }>,
    [btEstimatedByTransformer]
  );
  const btCriticalPoleId = btAccumulatedByPole[0]?.poleId ?? null;

  useEffect(() => {
    if ((settings.btTransformerCalculationMode ?? 'automatic') !== 'automatic') {
      return;
    }

    if (btTopology.transformers.length === 0) {
      return;
    }

    const estimatedByTransformerId = new Map(
      btEstimatedByTransformer.map((entry) => [entry.transformerId, entry.estimatedDemandKw])
    );

    let hasChanges = false;
    const nextTransformers = btTopology.transformers.map((transformer) => {
      const estimatedDemandKw = Number((estimatedByTransformerId.get(transformer.id) ?? 0).toFixed(2));
      const hasReadings = transformer.readings.length > 0;
      const isAutoReading = hasReadings && transformer.readings.every((reading) => reading.autoCalculated === true);

      if (hasReadings && !isAutoReading) {
        return transformer;
      }

      if (!isAutoReading) {
        if (Math.abs((transformer.demandKw ?? 0) - estimatedDemandKw) < 0.01) {
          return transformer;
        }

        hasChanges = true;
        return {
          ...transformer,
          demandKw: estimatedDemandKw
        };
      }

      const baseReading = transformer.readings[0] ?? {
        id: `R${Date.now()}${Math.floor(Math.random() * 1000)}`,
        currentMaxA: 0,
        temperatureFactor: DEFAULT_TEMPERATURE_FACTOR,
        autoCalculated: true
      };
      const temperatureFactor = (baseReading.temperatureFactor ?? DEFAULT_TEMPERATURE_FACTOR) > 0
        ? (baseReading.temperatureFactor ?? DEFAULT_TEMPERATURE_FACTOR)
        : DEFAULT_TEMPERATURE_FACTOR;
      const inferredCurrent = Math.round((estimatedDemandKw / (CURRENT_TO_DEMAND_CONVERSION * temperatureFactor)) * 100) / 100;

      const previousCurrent = baseReading.currentMaxA ?? 0;
      const previousDemand = transformer.demandKw ?? 0;
      if (
        Math.abs(previousCurrent - inferredCurrent) < 0.01 &&
        Math.abs(previousDemand - estimatedDemandKw) < 0.01
      ) {
        return transformer;
      }

      hasChanges = true;
      return {
        ...transformer,
        demandKw: estimatedDemandKw,
        readings: [{
          ...baseReading,
          currentMaxA: inferredCurrent,
          temperatureFactor,
          autoCalculated: true
        }]
      };
    });

    if (!hasChanges) {
      return;
    }

    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        transformers: nextTransformers
      }
    }, false);
  }, [appState, btEstimatedByTransformer, btTopology, setAppState, settings.btTransformerCalculationMode]);

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
  const [sessionDraft, setSessionDraft] = useState<GlobalState | null>(null);

  // Auto-save: persist appState to localStorage with debounce
  useAutoSave(appState);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

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
    clearBtExportHistory,
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

  // On mount: check for a recoverable session (only if there's BT topology work)
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
      const verifiedPoles = typeof btContext.verifiedPoles === 'number' ? btContext.verifiedPoles : 0;
      const totalPoles = typeof btContext.totalPoles === 'number' ? btContext.totalPoles : 0;
      const verifiedEdges = typeof btContext.verifiedEdges === 'number' ? btContext.verifiedEdges : 0;
      const totalEdges = typeof btContext.totalEdges === 'number' ? btContext.totalEdges : 0;
      const verifiedTransformers = typeof btContext.verifiedTransformers === 'number' ? btContext.verifiedTransformers : 0;
      const totalTransformers = typeof btContext.totalTransformers === 'number' ? btContext.totalTransformers : 0;

      const cqtSnapshotRaw = btContext.cqtSnapshot;
      const cqtSnapshot = cqtSnapshotRaw && typeof cqtSnapshotRaw === 'object'
        ? cqtSnapshotRaw as Record<string, unknown>
        : null;
      const cqtGeral = cqtSnapshot?.geral && typeof cqtSnapshot.geral === 'object'
        ? cqtSnapshot.geral as Record<string, unknown>
        : null;
      const cqtDb = cqtSnapshot?.db && typeof cqtSnapshot.db === 'object'
        ? cqtSnapshot.db as Record<string, unknown>
        : null;
      const cqtDmdi = cqtSnapshot?.dmdi && typeof cqtSnapshot.dmdi === 'object'
        ? cqtSnapshot.dmdi as Record<string, unknown>
        : null;
      const cqtParity = cqtSnapshot?.parity && typeof cqtSnapshot.parity === 'object'
        ? cqtSnapshot.parity as Record<string, unknown>
        : null;

      const cqtSummary = cqtSnapshot
        ? {
            scenario: typeof cqtSnapshot.scenario === 'string'
              ? cqtSnapshot.scenario as 'atual' | 'proj1' | 'proj2'
              : undefined,
            dmdi: typeof cqtDmdi?.dmdi === 'number' ? cqtDmdi.dmdi : undefined,
            p31: typeof cqtGeral?.p31CqtNoPonto === 'number' ? cqtGeral.p31CqtNoPonto : undefined,
            p32: typeof cqtGeral?.p32CqtNoPonto === 'number' ? cqtGeral.p32CqtNoPonto : undefined,
            k10QtMttr: typeof cqtDb?.k10QtMttr === 'number' ? cqtDb.k10QtMttr : undefined,
            parityStatus: typeof cqtParity?.referenceStatus === 'string'
              ? cqtParity.referenceStatus as 'complete' | 'partial' | 'missing'
              : undefined,
            parityPassed: typeof cqtParity?.passed === 'number' ? cqtParity.passed : undefined,
            parityFailed: typeof cqtParity?.failed === 'number' ? cqtParity.failed : undefined
          }
        : undefined;

      if (!poleId) {
        return;
      }

      const nextBtExportSummary: BtExportSummary = {
        btContextUrl,
        criticalPoleId: poleId,
        criticalAccumulatedClients: accumulatedClients,
        criticalAccumulatedDemandKva: accumulatedDemandKva,
        cqt: cqtSummary,
        verifiedPoles,
        totalPoles,
        verifiedEdges,
        totalEdges,
        verifiedTransformers,
        totalTransformers
      };

      const historyEntry: BtExportHistoryEntry = {
        ...nextBtExportSummary,
        exportedAt: new Date().toISOString(),
        projectType: settings.projectType ?? 'ramais'
      };

      const nextHistory = [historyEntry, ...(appState.btExportHistory ?? [])].slice(0, MAX_BT_EXPORT_HISTORY);

      setAppState({ ...appState, btExportSummary: nextBtExportSummary, btExportHistory: nextHistory }, false);
      const cqtScenarioLabel = cqtSummary?.scenario ? ` | CQT ${cqtSummary.scenario.toUpperCase()}` : '';
      showToast(`Resumo BT: ponto crítico ${poleId} (${accumulatedDemandKva.toFixed(2)})${cqtScenarioLabel}.`, 'info');
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

  const { profileData: elevationProfileData, loadProfile: loadElevationProfile, clearProfile } = useElevationProfile();

  const updateSettings = (newSettings: AppSettings) => {
    setAppState({ ...appState, settings: newSettings }, true);
  };

  const handleMapClick = (newCenter: GeoLocation) => {
    setAppState({ ...appState, center: newCenter }, true);
    clearData();
  };

  const handleSelectionModeChange = (mode: SelectionMode) => {
    clearPendingBtEdge();
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

    const totalClientsX = btTopology.poles.reduce((sum, pole) => {
      const poleClients = (pole.ramais ?? []).reduce((poleSum, ramal) => {
        const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
        if ((settings.projectType ?? 'ramais') === 'clandestino') {
          return isClandestino ? poleSum + ramal.quantity : poleSum;
        }

        return isClandestino ? poleSum : poleSum + ramal.quantity;
      }, 0);

      return sum + poleClients;
    }, 0);

    const aa24DemandBase = btTopology.transformers.reduce((sum, transformer) => sum + (transformer.demandKw ?? 0), 0);
    const ab35LookupDmdi = calculateClandestinoDemandKvaByAreaAndClients(
      settings.clandestinoAreaM2 ?? 0,
      totalClientsX
    );

    const cqtScenario = btNetworkScenario === 'proj1' || btNetworkScenario === 'proj2' ? btNetworkScenario : 'atual';
    const accumulatedByPoleMap = new Map(
      btAccumulated.map((item) => [item.poleId, item.accumulatedDemandKva])
    );
    const polesById = new Map(btTopology.poles.map((pole) => [pole.id, pole]));

    const cqtBranches = btTopology.edges
      .filter((edge) => getEdgeChangeFlag(edge) !== 'remove')
      .map((edge) => {
        const conductorName = edge.conductors[0]?.conductorName;
        if (!conductorName) {
          return null;
        }

        const fromAccumulatedKva = accumulatedByPoleMap.get(edge.fromPoleId) ?? 0;
        const toAccumulatedKva = accumulatedByPoleMap.get(edge.toPoleId) ?? 0;
        const acumuladaKva = Math.max(fromAccumulatedKva, toAccumulatedKva, 0);
        const fromPoleTitle = polesById.get(edge.fromPoleId)?.title ?? '';
        const toPoleTitle = polesById.get(edge.toPoleId)?.title ?? '';
        const inferredSide =
          inferBranchSide(edge.id) ??
          inferBranchSide(fromPoleTitle) ??
          inferBranchSide(toPoleTitle);

        return {
          trechoId: edge.id,
          ponto: edge.toPoleId,
          lado: inferredSide,
          fase: 'TRI' as const,
          acumuladaKva,
          eta: 1,
          tensaoTrifasicaV: 127,
          conductorName,
          lengthMeters: edge.lengthMeters ?? 0,
          temperatureC: 30
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const cqtComputationInputs: BtCqtComputationInputs = {
      scenario: cqtScenario,
      dmdi: {
        clandestinoEnabled: (settings.projectType ?? 'ramais') === 'clandestino',
        aa24DemandBase,
        sumClientsX: totalClientsX,
        ab35LookupDmdi
      },
      db: {
        trAtual: btTopology.transformers.reduce((sum, transformer) => sum + (transformer.projectPowerKva ?? 0), 0),
        demAtual: aa24DemandBase,
        qtMt: 0
      },
      branches: cqtBranches
    };

    const btContext = {
      projectType: settings.projectType ?? 'ramais',
      btNetworkScenario,
      clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
      totalTransformers: btTopology.transformers.length,
      totalPoles: btTopology.poles.length,
      totalEdges: btTopology.edges.length,
      verifiedTransformers: btTopology.transformers.filter((item) => item.verified).length,
      verifiedPoles: btTopology.poles.filter((item) => item.verified).length,
      verifiedEdges: btTopology.edges.filter((item) => item.verified).length,
      accumulatedByPole: btAccumulated,
      criticalPole: btAccumulated[0] ?? null,
      cqtComputationInputs,
      topology: settings.layers.btNetwork
        ? {
            poles: btTopology.poles.map((pole) => ({
              id: pole.id,
              lat: pole.lat,
              lng: pole.lng,
              title: pole.title,
              nodeChangeFlag: getPoleChangeFlag(pole),
              circuitBreakPoint: pole.circuitBreakPoint ?? false,
              verified: pole.verified ?? false,
              ramais: (pole.ramais ?? []).map((ramal) => ({
                id: ramal.id,
                quantity: ramal.quantity,
                ramalType: ramal.ramalType ?? ''
              }))
            })),
            transformers: btTopology.transformers.map((transformer) => ({
              id: transformer.id,
              poleId: transformer.poleId ?? '',
              lat: transformer.lat,
              lng: transformer.lng,
              title: transformer.title,
              transformerChangeFlag: getTransformerChangeFlag(transformer),
              projectPowerKva: transformer.projectPowerKva ?? 0,
              demandKw: transformer.demandKw,
              verified: transformer.verified ?? false
            })),
            edges: btTopology.edges.map((edge) => ({
              id: edge.id,
              fromPoleId: edge.fromPoleId,
              toPoleId: edge.toPoleId,
              lengthMeters: edge.lengthMeters ?? 0,
              verified: edge.verified ?? false,
              edgeChangeFlag: getEdgeChangeFlag(edge),
              removeOnExecution: getEdgeChangeFlag(edge) === 'remove',
              replacementFromConductors: (edge.replacementFromConductors ?? []).map((conductor) => ({
                id: conductor.id,
                quantity: conductor.quantity,
                conductorName: conductor.conductorName
              })),
              conductors: edge.conductors.map((conductor) => ({
                id: conductor.id,
                quantity: conductor.quantity,
                conductorName: conductor.conductorName
              }))
            }))
          }
        : null
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
    clearPendingBtEdge();
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

      {(latestBtExport || btExportHistory.length > 0) && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-500/30 bg-slate-950/95 px-4 py-3 text-xs text-cyan-100 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="font-semibold uppercase tracking-wide text-cyan-300">Resumo BT Exportado</div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportBtHistoryJson}
                className="inline-flex items-center gap-1 rounded border border-cyan-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/10"
              >
                <Download size={10} /> JSON
              </button>
              <button
                onClick={exportBtHistoryCsv}
                className="inline-flex items-center gap-1 rounded border border-cyan-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/10"
              >
                <Download size={10} /> CSV
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
              {((latestBtExport.totalPoles ?? 0) > 0 || (latestBtExport.totalEdges ?? 0) > 0 || (latestBtExport.totalTransformers ?? 0) > 0) && (
                <div className="mt-1 text-cyan-100/90">
                  Verificação Atual: Postes {latestBtExport.verifiedPoles ?? 0}/{latestBtExport.totalPoles ?? 0} | Condutores {latestBtExport.verifiedEdges ?? 0}/{latestBtExport.totalEdges ?? 0} | Trafos {latestBtExport.verifiedTransformers ?? 0}/{latestBtExport.totalTransformers ?? 0}
                </div>
              )}
              {latestBtExport.cqt && (
                <div className="mt-1 text-cyan-100/90">
                  CQT {latestBtExport.cqt.scenario?.toUpperCase() ?? '-'}: DMDI {latestBtExport.cqt.dmdi?.toFixed(3) ?? '-'} | P31 {latestBtExport.cqt.p31?.toFixed(3) ?? '-'} | P32 {latestBtExport.cqt.p32?.toFixed(3) ?? '-'} | K10 {latestBtExport.cqt.k10QtMttr?.toFixed(6) ?? '-'}
                  {typeof latestBtExport.cqt.parityPassed === 'number' && typeof latestBtExport.cqt.parityFailed === 'number'
                    ? ` | Paridade ${latestBtExport.cqt.parityPassed} OK / ${latestBtExport.cqt.parityFailed} falhas`
                    : ''}
                </div>
              )}
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
                  {((entry.totalPoles ?? 0) > 0 || (entry.totalEdges ?? 0) > 0 || (entry.totalTransformers ?? 0) > 0)
                    ? ` | V ${entry.verifiedPoles ?? 0}/${entry.totalPoles ?? 0} P, ${entry.verifiedEdges ?? 0}/${entry.totalEdges ?? 0} A, ${entry.verifiedTransformers ?? 0}/${entry.totalTransformers ?? 0} T`
                    : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showSettings && (
          <Suspense fallback={<InlineSuspenseFallback label="Carregando configurações" />}>
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
          </Suspense>
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
          <Suspense fallback={<InlineSuspenseFallback label="Carregando histórico" />}>
            <HistoryControls
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
            />
          </Suspense>

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

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Editor BT</label>
              <span className="text-[9px] text-slate-500 uppercase">{(settings.projectType ?? 'ramais').toUpperCase()} / {btNetworkScenario === 'asis' ? 'ATUAL' : 'PROJETO'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ ...settings, btNetworkScenario: 'asis', btEditorMode: 'none' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btNetworkScenario === 'asis' ? 'bg-cyan-700 text-white border-cyan-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                REDE ATUAL
              </button>
              <button
                onClick={() => updateSettings({ ...settings, btNetworkScenario: 'projeto' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btNetworkScenario === 'projeto' ? 'bg-indigo-700 text-white border-indigo-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                REDE NOVA
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => updateSettings({ ...settings, btEditorMode: 'none' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'none' ? 'bg-slate-800 text-slate-100 border-white/10' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                NAVEGAR
              </button>
              <button
                onClick={() => updateSettings({ ...settings, btEditorMode: 'move-pole' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'move-pole' ? 'bg-amber-600 text-white border-amber-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                MOVER
              </button>
              <button
                onClick={() => updateSettings({ ...settings, btEditorMode: 'add-pole' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-pole' ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                + POSTE
              </button>
              <button
                onClick={() => {
                  clearPendingBtEdge();
                  updateSettings({ ...settings, btEditorMode: 'add-edge' });
                }}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-edge' ? 'bg-emerald-600 text-white border-emerald-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                + CONDUTOR
              </button>
              <button
                onClick={() => updateSettings({ ...settings, btEditorMode: 'add-transformer' })}
                className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === 'add-transformer' ? 'bg-violet-600 text-white border-violet-500' : 'text-slate-500 border-white/5 hover:text-slate-300'}`}
              >
                + TRAFO
              </button>
            </div>
            {btEditorMode === 'add-pole' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBtInsertPoleByCoordinates();
                }}
                className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 space-y-2"
              >
                <div className="text-[10px] font-semibold text-blue-200">Inserir poste por coordenadas</div>
                <input
                  type="text"
                  value={btPoleCoordinateInput}
                  onChange={(e) => setBtPoleCoordinateInput(e.target.value)}
                  placeholder="-22.9068 -43.1729 ou 23K 635806 7462003"
                  aria-label="Coordenadas do poste"
                  className="w-full rounded border border-blue-500/40 bg-slate-900 p-2 text-[11px] text-blue-100 placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="w-full rounded border border-blue-500 bg-blue-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-blue-500"
                >
                  INSERIR POR COORDENADA
                </button>
              </form>
            )}
            {btEditorMode === 'move-pole' && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium leading-snug text-amber-900 shadow-sm">
                <div>Arraste fino de poste:</div>
                <div>Clique e segure no poste para ajustar a posicao no mapa.</div>
              </div>
            )}
            {btNetworkScenario === 'asis' && (
              <div className="text-[10px] text-cyan-900 bg-cyan-50 border border-cyan-300 rounded-lg p-2">
                Rede Atual ativa: você pode navegar e lançar poste, condutor e trafo na topologia existente.
              </div>
            )}
            {settings.projectType === 'clandestino' && (
              <div className="text-[10px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-lg p-2">
                Área clandestina: {settings.clandestinoAreaM2 ?? 0} m²
              </div>
            )}
            {settings.projectType !== 'clandestino' && pendingNormalClassificationPoles.length > 0 && (
              <div className="text-[10px] text-rose-300 bg-rose-900/20 border border-rose-500/30 rounded-lg p-2">
                Classificação pendente em {pendingNormalClassificationPoles.length} poste(s). DXF bloqueado até classificar.
              </div>
            )}
            <button
              onClick={handleResetBtTopology}
              className="w-full text-[10px] font-bold py-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 transition-all"
              title="Remover toda a topologia BT"
            >
              ZERAR BT (LIMPAR TUDO)
            </button>
          </div>

          <div className="h-px bg-white/5 mx-2"></div>

          <Suspense fallback={<InlineSuspenseFallback label="Carregando painel BT" />}>
            <BtTopologyPanel
              btTopology={btTopology}
              projectType={settings.projectType ?? 'ramais'}
              btNetworkScenario={btNetworkScenario}
              clandestinoAreaM2={settings.clandestinoAreaM2 ?? 0}
              transformerDebugById={btTransformerDebugById}
              onTopologyChange={updateBtTopology}
              onSelectedPoleChange={handleBtSelectedPoleChange}
              onSelectedTransformerChange={handleBtSelectedTransformerChange}
              onSelectedEdgeChange={handleBtSelectedEdgeChange}
              onProjectTypeChange={updateProjectType}
              onClandestinoAreaChange={updateClandestinoAreaM2}
              onBtRenamePole={handleBtRenamePole}
              onBtRenameTransformer={handleBtRenameTransformer}
              onBtSetEdgeChangeFlag={handleBtSetEdgeChangeFlag}
              onBtSetPoleChangeFlag={handleBtSetPoleChangeFlag}
              onBtTogglePoleCircuitBreak={handleBtTogglePoleCircuitBreak}
              onBtSetTransformerChangeFlag={handleBtSetTransformerChangeFlag}
            />
          </Suspense>

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
                <Suspense fallback={<InlineSuspenseFallback label="Carregando análise" />}>
                  <Dashboard stats={stats} analysisText={analysisText} />
                </Suspense>

                <Suspense fallback={<InlineSuspenseFallback label="Carregando legenda DXF" />}>
                  <DxfLegend />
                </Suspense>

                <Suspense fallback={<InlineSuspenseFallback label="Carregando importação em lote" />}>
                  <BatchUpload
                    onError={(message) => showToast(message, 'error')}
                    onInfo={(message) => showToast(message, 'info')}
                  />
                </Suspense>

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

          <AnimatePresence>
            {normalRamalModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[980] flex items-center justify-center bg-black/40 p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-4 shadow-2xl"
                >
                  <div className="text-sm font-semibold text-slate-800">Ramal do cliente</div>
                  <div className="mt-1 text-xs text-slate-500">{normalRamalModal.poleTitle}</div>

                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-slate-600 block">Tipo de ramal</label>
                    <select
                      aria-label="Tipo de ramal"
                      value={normalRamalModal.ramalType}
                      onChange={(e) => setNormalRamalModal({ ...normalRamalModal, ramalType: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800"
                    >
                      {NORMAL_CLIENT_RAMAL_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>

                    <label className="text-xs text-slate-600 block">Quantidade</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Quantidade de ramais"
                      value={normalRamalModal.quantity === 0 ? '' : String(normalRamalModal.quantity)}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const n = parseInt(raw, 10);
                        setNormalRamalModal({ ...normalRamalModal, quantity: Number.isFinite(n) && n > 0 ? n : 0 });
                      }}
                      className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setNormalRamalModal(null)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmNormalRamalModal}
                      className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
                    >
                      Adicionar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {clandestinoToNormalModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[985] flex items-center justify-center bg-black/50 p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  className="w-full max-w-2xl rounded-xl border border-amber-300 bg-white p-5 shadow-2xl"
                >
                  <div className="text-base font-semibold text-slate-900">Atenção: mudança Clandestino → Normal</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Identifique os tipos de ramal dos postes abaixo para cálculo normal. Você pode migrar tudo agora como Monofásico ou fazer depois.
                  </p>

                  <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Poste</th>
                          <th className="px-3 py-2 font-semibold">Clientes clandestinos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clandestinoToNormalModal.poles.map((entry) => (
                          <tr key={entry.poleId} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-800">{entry.poleTitle}</td>
                            <td className="px-3 py-2 text-slate-700">{entry.clandestinoClients}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => setClandestinoToNormalModal(null)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleClandestinoToNormalClassifyLater}
                      className="rounded border border-amber-500 bg-amber-500 px-3 py-1.5 text-xs text-white hover:bg-amber-400"
                    >
                      Fazer Depois (Bloquear DXF)
                    </button>
                    <button
                      onClick={handleClandestinoToNormalConvertNow}
                      className="rounded border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
                    >
                      Migrar Agora como Monofásico
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {normalToClandestinoModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[985] flex items-center justify-center bg-black/50 p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-5 shadow-2xl"
                >
                  <div className="text-base font-semibold text-slate-900">Mudança Normal → Clandestino</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Há {normalToClandestinoModal.totalNormalClients} cliente(s) normal(is) cadastrados. Deseja manter para possível retorno ou zerar somente os normais?
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => setNormalToClandestinoModal(null)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleNormalToClandestinoKeepClients}
                      className="rounded border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
                    >
                      Manter Clientes
                    </button>
                    <button
                      onClick={handleNormalToClandestinoZeroNormalClients}
                      className="rounded border border-rose-500 bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-500"
                    >
                      Zerar Só Normais
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;