import React, { useState, useEffect } from 'react';
import { Download, Map as MapIcon, Layers, Search, Loader2, AlertCircle, Settings, Mountain, TrendingUp } from 'lucide-react';
import { AnalysisStats, GlobalState, AppSettings, GeoLocation, SelectionMode, BtTopology, BtPoleNode, BtTransformer, BtEditorMode, BtExportSummary, BtExportHistoryEntry, BtNetworkScenario, BtCqtComputationInputs, BtEdge } from './types';
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
import { useAutoSave, loadSessionDraft, clearSessionDraft } from './hooks/useAutoSave';
import { useBtNavigationState } from './hooks/useBtNavigationState';
import {
  calculateAccumulatedDemandByPole,
  calculateEstimatedDemandByTransformer,
  calculateSectioningImpact,
  calculateClandestinoDemandKvaByAreaAndClients,
  getClandestinoAreaRange,
  getClandestinoClientsRange,
  getClandestinoDiversificationFactorByClients,
  getClandestinoKvaByArea,
  loadClandestinoWorkbookRules
} from './utils/btCalculations';
import { parseLatLngQuery, parseUtmQuery } from './utils/geo';
import { motion, AnimatePresence } from 'framer-motion';

const EMPTY_BT_TOPOLOGY: BtTopology = {
  poles: [],
  transformers: [],
  edges: []
};
const MAX_BT_EXPORT_HISTORY = 20;
const NORMAL_CLIENT_RAMAL_TYPES = [
  '5 CC',
  '8 CC',
  '13 CC',
  '21 CC',
  '33 CC',
  '53 CC',
  '67 CC',
  '85 CC',
  '107 CC',
  '127 CC',
  '253 CC',
  '13 DX 6 AWG',
  '13 TX 6 AWG',
  '13 QX 6 AWG',
  '21 QX 4 AWG',
  '53 QX 1/0',
  '85 QX 3/0',
  '107 QX 4/0',
  '70 MMX',
  '185 MMX'
];
const CLANDESTINO_RAMAL_TYPE = 'Clandestino';
const DEFAULT_EDGE_CONDUCTOR = '70 Al - MX';
const CURRENT_TO_DEMAND_CONVERSION = 0.375;
const DEFAULT_TEMPERATURE_FACTOR = 1.2;
type BtEdgeChangeFlag = NonNullable<BtEdge['edgeChangeFlag']>;
type BtPoleChangeFlag = NonNullable<BtPoleNode['nodeChangeFlag']>;
type BtTransformerChangeFlag = NonNullable<BtTransformer['transformerChangeFlag']>;

const getEdgeChangeFlag = (edge: BtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }

  return edge.removeOnExecution ? 'remove' : 'existing';
};

const normalizeBtEdge = (edge: BtEdge): BtEdge => {
  const edgeChangeFlag = getEdgeChangeFlag(edge);
  const mustHaveConductor = edgeChangeFlag === 'replace' || edgeChangeFlag === 'new';
  const hasConductors = edge.conductors.length > 0;
  const replacementFromConductors = Array.isArray(edge.replacementFromConductors)
    ? edge.replacementFromConductors
    : [];
  const hasReplacementFrom = replacementFromConductors.length > 0;

  return {
    ...edge,
    edgeChangeFlag,
    removeOnExecution: edgeChangeFlag === 'remove',
    conductors: mustHaveConductor && !hasConductors
      ? [{ id: `C${Date.now()}${Math.floor(Math.random() * 1000)}`, quantity: 1, conductorName: DEFAULT_EDGE_CONDUCTOR }]
      : edge.conductors,
    replacementFromConductors: mustHaveConductor && !hasReplacementFrom
      ? [{ id: `RC${Date.now()}${Math.floor(Math.random() * 1000)}`, quantity: 1, conductorName: DEFAULT_EDGE_CONDUCTOR }]
      : replacementFromConductors
  };
};

const normalizeBtEdges = (edges: BtEdge[]): BtEdge[] => edges.map(normalizeBtEdge);

const getPoleChangeFlag = (pole: BtPoleNode): BtPoleChangeFlag => pole.nodeChangeFlag ?? 'existing';
const normalizeBtPole = (pole: BtPoleNode): BtPoleNode => ({
  ...pole,
  nodeChangeFlag: getPoleChangeFlag(pole),
  circuitBreakPoint: pole.circuitBreakPoint ?? false
});
const normalizeBtPoles = (poles: BtPoleNode[]): BtPoleNode[] => poles.map(normalizeBtPole);

const getTransformerChangeFlag = (transformer: BtTransformer): BtTransformerChangeFlag => transformer.transformerChangeFlag ?? 'existing';
const normalizeBtTransformer = (transformer: BtTransformer): BtTransformer => ({
  ...transformer,
  transformerChangeFlag: getTransformerChangeFlag(transformer)
});
const normalizeBtTransformers = (transformers: BtTransformer[]): BtTransformer[] => transformers.map(normalizeBtTransformer);

type PendingNormalClassificationPole = {
  poleId: string;
  poleTitle: string;
  clandestinoClients: number;
};

const downloadBlob = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const escapeCsvCell = (value: string | number) => {
  const normalized = String(value).replace(/\r?\n/g, ' ');
  if (normalized.includes(';') || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

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

const nextSequentialId = (ids: string[], prefix: string): string => {
  const matcher = new RegExp(`^${prefix}(\\d+)$`);
  let maxSuffix = 0;

  for (const id of ids) {
    const match = id.match(matcher);
    if (!match) {
      continue;
    }

    const suffix = Number.parseInt(match[1], 10);
    if (Number.isFinite(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  return `${prefix}${maxSuffix + 1}`;
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
  const [pendingBtEdgeStartPoleId, setPendingBtEdgeStartPoleId] = useState<string | null>(null);

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
  const [normalRamalModal, setNormalRamalModal] = useState<{
    poleId: string;
    poleTitle: string;
    ramalType: string;
    quantity: number;
  } | null>(null);
  const [pendingNormalClassificationPoles, setPendingNormalClassificationPoles] = useState<PendingNormalClassificationPole[]>([]);
  const [clandestinoToNormalModal, setClandestinoToNormalModal] = useState<{
    poles: PendingNormalClassificationPole[];
  } | null>(null);
  const [normalToClandestinoModal, setNormalToClandestinoModal] = useState<{
    totalNormalClients: number;
  } | null>(null);
  const [btPoleCoordinateInput, setBtPoleCoordinateInput] = useState('');

  // Auto-save: persist appState to localStorage with debounce
  useAutoSave(appState);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

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

  const getPoleClandestinoClients = (pole: BtPoleNode) =>
    (pole.ramais ?? []).reduce((acc, ramal) => {
      const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      return isClandestino ? acc + ramal.quantity : acc;
    }, 0);

  const getPoleNormalClients = (pole: BtPoleNode) =>
    (pole.ramais ?? []).reduce((acc, ramal) => {
      const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      return isClandestino ? acc : acc + ramal.quantity;
    }, 0);

  const getPolesPendingNormalClassification = (topology: BtTopology): PendingNormalClassificationPole[] =>
    topology.poles
      .map((pole) => ({
        poleId: pole.id,
        poleTitle: pole.title,
        clandestinoClients: getPoleClandestinoClients(pole)
      }))
      .filter((entry) => entry.clandestinoClients > 0);

  const migrateClandestinoToDefaultNormalType = (topology: BtTopology, normalType: string): BtTopology => ({
    ...topology,
    poles: topology.poles.map((pole) => {
      const ramais = (pole.ramais ?? []).map((ramal) => {
        const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
        return isClandestino ? { ...ramal, ramalType: normalType } : ramal;
      });
      return { ...pole, ramais };
    })
  });

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

  const updateBtTopology = (nextTopology: BtTopology) => {
    setAppState({
      ...appState,
      btTopology: {
        ...nextTopology,
        poles: normalizeBtPoles(nextTopology.poles),
        transformers: normalizeBtTransformers(nextTopology.transformers),
        edges: normalizeBtEdges(nextTopology.edges)
      }
    }, true);
  };

  const updateProjectType = (nextProjectType: 'ramais' | 'clandestino') => {
    const currentProjectType = settings.projectType ?? 'ramais';
    if (currentProjectType === nextProjectType) {
      return;
    }

    if (currentProjectType === 'clandestino' && nextProjectType === 'ramais') {
      const pendingPoles = getPolesPendingNormalClassification(btTopology);
      if (pendingPoles.length > 0) {
        setClandestinoToNormalModal({ poles: pendingPoles });
        return;
      }
    }

    if (currentProjectType === 'ramais' && nextProjectType === 'clandestino') {
      const totalNormalClients = btTopology.poles.reduce((acc, pole) => acc + getPoleNormalClients(pole), 0);
      if (totalNormalClients > 0) {
        setNormalToClandestinoModal({ totalNormalClients });
        return;
      }
    }

    setPendingNormalClassificationPoles([]);
    setAppState({
      ...appState,
      settings: {
        ...settings,
        projectType: nextProjectType
      }
    }, true);
  };

  const updateClandestinoAreaM2 = (nextAreaM2: number) => {
    setAppState({
      ...appState,
      settings: {
        ...settings,
        clandestinoAreaM2: nextAreaM2
      }
    }, true);
  };

  const applyProjectTypeSwitch = (nextProjectType: 'ramais' | 'clandestino', nextTopology: BtTopology = btTopology) => {
    setAppState({
      ...appState,
      btTopology: nextTopology,
      settings: {
        ...settings,
        projectType: nextProjectType
      }
    }, true);
  };

  const handleClandestinoToNormalClassifyLater = () => {
    if (!clandestinoToNormalModal) {
      return;
    }

    setPendingNormalClassificationPoles(clandestinoToNormalModal.poles);
    applyProjectTypeSwitch('ramais');
    setClandestinoToNormalModal(null);
    showToast('Projeto mudou para Normal. Classificação de ramais pendente (DXF bloqueado).', 'info');
  };

  const handleClandestinoToNormalConvertNow = () => {
    if (!clandestinoToNormalModal) {
      return;
    }

    const migratedTopology = migrateClandestinoToDefaultNormalType(btTopology, NORMAL_CLIENT_RAMAL_TYPES[0]);
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch('ramais', migratedTopology);
    setClandestinoToNormalModal(null);
    showToast('Ramais clandestinos migrados para Ramal Monofasico.', 'success');
  };

  const handleNormalToClandestinoKeepClients = () => {
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch('clandestino');
    setNormalToClandestinoModal(null);
    showToast('Mudança para Clandestino mantendo clientes normais para possível retorno.', 'info');
  };

  const handleNormalToClandestinoZeroNormalClients = () => {
    const cleanedTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) => ({
        ...pole,
        ramais: (pole.ramais ?? []).filter((ramal) => (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE)
      }))
    };

    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch('clandestino', cleanedTopology);
    setNormalToClandestinoModal(null);
    showToast('Clientes normais zerados. Apenas ramais clandestinos foram mantidos.', 'success');
  };

  const handleResetBtTopology = () => {
    const hasBtData = btTopology.poles.length > 0 || btTopology.edges.length > 0 || btTopology.transformers.length > 0;
    if (!hasBtData && (btExportSummary === null) && btExportHistory.length === 0) {
      showToast('Topologia BT já está vazia.', 'info');
      return;
    }

    const confirmed = window.confirm('Zerar toda a topologia BT? Isso removerá postes, condutores, trafos e histórico BT.');
    if (!confirmed) {
      return;
    }

    setPendingBtEdgeStartPoleId(null);
    setPendingNormalClassificationPoles([]);
    setClandestinoToNormalModal(null);
    setNormalToClandestinoModal(null);
    setAppState({
      ...appState,
      btTopology: EMPTY_BT_TOPOLOGY,
      btExportSummary: null,
      btExportHistory: []
    }, true);
    showToast('Topologia BT zerada.', 'success');
  };

  const clearBtExportHistory = () => {
    setAppState({ ...appState, btExportSummary: null, btExportHistory: [] }, true);
    showToast('Histórico BT limpo.', 'info');
  };

  const exportBtHistoryJson = () => {
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

    downloadBlob(
      JSON.stringify(payload, null, 2),
      'application/json',
      `${settings.projectMetadata.projectName}_bt_history.json`
    );
    showToast('Histórico BT exportado em JSON.', 'success');
  };

  const exportBtHistoryCsv = () => {
    if (btExportHistory.length === 0) {
      showToast('Não há histórico BT para exportar.', 'info');
      return;
    }

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
      'totalTransformers'
    ];

    const rows = btExportHistory.map((entry) => [
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
      entry.totalTransformers ?? 0
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsvCell(value)).join(';'))
      .join('\n');

    downloadBlob(csv, 'text/csv;charset=utf-8', `${settings.projectMetadata.projectName}_bt_history.csv`);
    showToast('Histórico BT exportado em CSV.', 'success');
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

      const totalClandestinoClients = btTopology.poles.reduce((acc, pole) => acc + getPoleClandestinoClients(pole), 0);

      if (getClandestinoDiversificationFactorByClients(totalClandestinoClients) === null) {
        showToast(
          `Total de clientes/ramais fora da tabela (${clientsRange.min}-${clientsRange.max}). Atual: ${totalClandestinoClients}.`,
          'error'
        );
        return false;
      }
    }

    const edgeWithoutConductors = btTopology.edges.find((edge) => getEdgeChangeFlag(edge) !== 'remove' && edge.conductors.length === 0);
    if (edgeWithoutConductors) {
      showToast(`Trecho ${edgeWithoutConductors.id} sem condutores definidos.`, 'error');
      return false;
    }

    const replacementWithoutOutgoing = btTopology.edges.find((edge) =>
      getEdgeChangeFlag(edge) === 'replace' && (!edge.replacementFromConductors || edge.replacementFromConductors.length === 0)
    );
    if (replacementWithoutOutgoing) {
      showToast(`Trecho ${replacementWithoutOutgoing.id} em substituição sem condutor de saída definido.`, 'error');
      return false;
    }

    if (settings.projectType !== 'clandestino') {
      if (pendingNormalClassificationPoles.length > 0) {
        showToast('Existem postes com classificação de ramal pendente. Conclua antes de gerar DXF.', 'error');
        return false;
      }

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

  const insertBtPoleAtLocation = (location: GeoLocation) => {
    const nextId = nextSequentialId(btTopology.poles.map((pole) => pole.id), 'P');
    const nextPole: BtPoleNode = {
      id: nextId,
      lat: location.lat,
      lng: location.lng,
      title: `Poste ${nextId}`,
      ramais: [],
      nodeChangeFlag: 'existing'
    };

    setAppState({
      ...appState,
      center: { lat: location.lat, lng: location.lng, label: location.label ?? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` },
      btTopology: {
        ...btTopology,
        poles: [...btTopology.poles, nextPole]
      }
    }, true);

    showToast(`${nextPole.title} inserido`, 'success');
  };

  const handleBtInsertPoleByCoordinates = () => {
    const query = btPoleCoordinateInput.trim();
    if (!query) {
      showToast('Informe as coordenadas do poste.', 'info');
      return;
    }

    const parsed = parseLatLngQuery(query) ?? parseUtmQuery(query);
    if (!parsed) {
      showToast('Formato inválido. Use: -22.9068 -43.1729 ou 23K 635806 7462003.', 'error');
      return;
    }

    insertBtPoleAtLocation(parsed);
    setBtPoleCoordinateInput('');
  };

  const handleBtMapClick = (location: GeoLocation) => {
    if (btEditorMode === 'none') {
      return;
    }

    if (btEditorMode === 'move-pole') {
      return;
    }

    if (btEditorMode === 'add-pole') {
      insertBtPoleAtLocation(location);
      return;
    }

    if (btEditorMode === 'add-transformer') {
        const nearestPole = findNearestPole(location);
        if (!nearestPole) {
          showToast('Trafo deve ser atrelado a um poste (clique em um poste)', 'error');
          return;
        }

        const existingOnPole = btTopology.transformers.find((transformer) => {
          if (transformer.poleId) {
            return transformer.poleId === nearestPole.id;
          }

          return distanceMeters(
            { lat: transformer.lat, lng: transformer.lng },
            { lat: nearestPole.lat, lng: nearestPole.lng }
          ) <= 6;
        });

        if (existingOnPole) {
          showToast(`${nearestPole.title} já possui transformador`, 'info');
          return;
        }

      const nextId = nextSequentialId(btTopology.transformers.map((transformer) => transformer.id), 'TR');
      const nextTransformer: BtTransformer = {
        id: nextId,
          poleId: nearestPole.id,
          lat: nearestPole.lat,
          lng: nearestPole.lng,
        title: `Transformador ${nextId}`,
        projectPowerKva: 0,
        monthlyBillBrl: 0,
        demandKw: 0,
        readings: [],
        transformerChangeFlag: 'existing'
      };

      setAppState({
        ...appState,
        btTopology: {
          ...btTopology,
          transformers: [...btTopology.transformers, nextTransformer]
        }
      }, true);
      showToast(`${nextTransformer.title} inserido em ${nearestPole.title}`, 'success');
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
        showToast('Selecione um segundo poste para concluir o condutor', 'info');
        return;
      }

      const fromPole = btTopology.poles.find((pole) => pole.id === pendingBtEdgeStartPoleId);
      if (!fromPole) {
        setPendingBtEdgeStartPoleId(null);
        showToast('Poste de origem não encontrado', 'error');
        return;
      }

      const alreadyConnected = btTopology.edges.some((edge) =>
        (edge.fromPoleId === fromPole.id && edge.toPoleId === nearestPole.id) ||
        (edge.fromPoleId === nearestPole.id && edge.toPoleId === fromPole.id)
      );

      if (alreadyConnected) {
        setPendingBtEdgeStartPoleId(nearestPole.id);
        showToast(`Já existe condutor entre ${fromPole.id} <-> ${nearestPole.id}. Nova origem: ${nearestPole.id}`, 'info');
        return;
      }

      const edgeId = nextSequentialId(btTopology.edges.map((edge) => edge.id), 'E');
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
              conductors: [],
              replacementFromConductors: [],
              removeOnExecution: false,
              edgeChangeFlag: 'existing'
            }
          ]
        }
      }, true);

      setPendingBtEdgeStartPoleId(nearestPole.id);
      showToast(`Condutor ${edgeId} criado (${lengthMeters}m). Nova origem: ${nearestPole.id}`, 'success');
    }
  };

  const handleBtDeletePole = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    const transformerIdsToRemove = new Set(
      btTopology.transformers
        .filter((transformer) => {
          if (transformer.poleId) {
            return transformer.poleId === poleId;
          }

          if (!pole) {
            return false;
          }

          return distanceMeters(
            { lat: transformer.lat, lng: transformer.lng },
            { lat: pole.lat, lng: pole.lng }
          ) <= 6;
        })
        .map((transformer) => transformer.id)
    );

    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.filter((p) => p.id !== poleId),
        edges: btTopology.edges.filter((e) => e.fromPoleId !== poleId && e.toPoleId !== poleId),
        transformers: btTopology.transformers.filter((transformer) => !transformerIdsToRemove.has(transformer.id))
      }
    }, true);
    showToast(`Poste ${poleId} removido`, 'info');
  };

  const handleBtDeleteEdge = (edgeId: string) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        edges: btTopology.edges.filter((e) => e.id !== edgeId)
      }
    }, true);
    showToast(`Condutor ${edgeId} removido`, 'info');
  };

  const handleBtSetEdgeChangeFlag = (edgeId: string, edgeChangeFlag: BtEdgeChangeFlag) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        edges: btTopology.edges.map((edge) => {
          if (edge.id !== edgeId) {
            return edge;
          }

          const nextEdge = {
            ...edge,
            edgeChangeFlag,
            removeOnExecution: edgeChangeFlag === 'remove'
          };

          return normalizeBtEdge(nextEdge);
        })
      }
    }, true);

    const statusLabel =
      edgeChangeFlag === 'remove'
        ? 'REMOÇÃO'
        : edgeChangeFlag === 'new'
          ? 'NOVO'
          : edgeChangeFlag === 'replace'
            ? 'SUBSTITUIÇÃO'
            : 'EXISTENTE';

    showToast(`Trecho ${edgeId} marcado como ${statusLabel}.`, 'info');
  };

  const handleBtSetPoleChangeFlag = (poleId: string, nodeChangeFlag: BtPoleChangeFlag) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((pole) =>
          pole.id === poleId ? normalizeBtPole({ ...pole, nodeChangeFlag }) : pole
        )
      }
    }, true);
  };

  const handleBtTogglePoleCircuitBreak = (poleId: string, circuitBreakPoint: boolean) => {
    const nextTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? normalizeBtPole({ ...pole, circuitBreakPoint }) : pole
      )
    };

    const sectioningImpact = circuitBreakPoint
      ? calculateSectioningImpact(nextTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0)
      : null;
    const suggestedPole = sectioningImpact?.suggestedPoleId
      ? nextTopology.poles.find((pole) => pole.id === sectioningImpact.suggestedPoleId)
      : null;

    setAppState({
      ...appState,
      center: suggestedPole
        ? {
            lat: suggestedPole.lat,
            lng: suggestedPole.lng,
            label: `Poste sugerido para novo trafo: ${suggestedPole.title}`
          }
        : appState.center,
      btTopology: {
        ...nextTopology
      }
    }, true);

    if (!circuitBreakPoint) {
      showToast(`Separação física removida do poste ${poleId}.`, 'info');
      return;
    }

    if (sectioningImpact && sectioningImpact.unservedPoleIds.length > 0) {
      const suggestedLabel = suggestedPole ? `${suggestedPole.title} (${suggestedPole.id})` : 'não encontrado';
      showToast(
        `Seccionamento BT: ${sectioningImpact.unservedPoleIds.length} poste(s) sem trafo atendendo. ` +
          `Carga sobrante estimada: ${sectioningImpact.estimatedDemandKw.toFixed(2)} kVA para ${sectioningImpact.unservedClients} cliente(s). ` +
          `Poste sugerido: ${suggestedLabel}.`,
        'error'
      );
      return;
    }

    showToast(`Poste ${poleId} marcado com separação física do circuito.`, 'info');
  };

  const handleBtSetTransformerChangeFlag = (transformerId: string, transformerChangeFlag: BtTransformerChangeFlag) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        transformers: btTopology.transformers.map((transformer) =>
          transformer.id === transformerId ? normalizeBtTransformer({ ...transformer, transformerChangeFlag }) : transformer
        )
      }
    }, true);
  };

  const handleBtToggleEdgeRemoval = (edgeId: string, removeOnExecution: boolean) => {
    handleBtSetEdgeChangeFlag(edgeId, removeOnExecution ? 'remove' : 'existing');
  };

  const handleBtSetEdgeReplacementFromConductors = (edgeId: string, conductors: BtEdge['conductors']) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        edges: btTopology.edges.map((edge) => {
          if (edge.id !== edgeId) {
            return edge;
          }

          return normalizeBtEdge({
            ...edge,
            replacementFromConductors: conductors
          });
        })
      }
    }, true);
  };

  const handleBtDeleteTransformer = (transformerId: string) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        transformers: btTopology.transformers.filter((t) => t.id !== transformerId)
      }
    }, true);
    showToast(`Transformador ${transformerId} removido`, 'info');
  };

  const handleBtToggleTransformerOnPole = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast('Poste não encontrado', 'error');
      return;
    }

    const transformersOnPole = btTopology.transformers.filter((transformer) => {
      if (transformer.poleId) {
        return transformer.poleId === poleId;
      }

      return distanceMeters(
        { lat: transformer.lat, lng: transformer.lng },
        { lat: pole.lat, lng: pole.lng }
      ) <= 6;
    });

    if (transformersOnPole.length === 0) {
      const nextId = nextSequentialId(btTopology.transformers.map((transformer) => transformer.id), 'TR');
      const nextTransformer: BtTransformer = {
        id: nextId,
        poleId,
        lat: pole.lat,
        lng: pole.lng,
        title: `Transformador ${nextId}`,
        projectPowerKva: 0,
        monthlyBillBrl: 0,
        demandKw: 0,
        readings: [],
        transformerChangeFlag: 'existing'
      };

      setAppState({
        ...appState,
        btTopology: {
          ...btTopology,
          transformers: [...btTopology.transformers, nextTransformer]
        }
      }, true);

      showToast(`Transformador adicionado em ${pole.title}`, 'success');
      return;
    }

    const removeIds = new Set(transformersOnPole.map((transformer) => transformer.id));
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        transformers: btTopology.transformers.filter((transformer) => !removeIds.has(transformer.id))
      }
    }, true);

    showToast(`Transformador removido de ${pole.title}`, 'success');
  };

  const handleBtDragPole = (poleId: string, lat: number, lng: number) => {
    const updatedPoles = btTopology.poles.map((p) =>
      p.id === poleId ? { ...p, lat, lng } : p
    );
    const updatedTransformers = btTopology.transformers.map((transformer) =>
      transformer.poleId === poleId ? { ...transformer, lat, lng } : transformer
    );
    const updatedEdges = btTopology.edges.map((edge) => {
      const from = updatedPoles.find((p) => p.id === edge.fromPoleId);
      const to = updatedPoles.find((p) => p.id === edge.toPoleId);
      if (!from || !to) return edge;
      const newLength = Math.round(distanceMeters({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }));
      return { ...edge, lengthMeters: newLength };
    });
    setAppState({ ...appState, btTopology: { ...btTopology, poles: updatedPoles, transformers: updatedTransformers, edges: updatedEdges } }, true);
  };

  const handleBtDragTransformer = (transformerId: string, lat: number, lng: number) => {
    const nearestPole = findNearestPole({ lat, lng });
    if (!nearestPole) {
      showToast('Trafo deve permanecer atrelado a um poste', 'error');
      return;
    }

    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        transformers: btTopology.transformers.map((t) =>
          t.id === transformerId ? { ...t, poleId: nearestPole.id, lat: nearestPole.lat, lng: nearestPole.lng } : t
        )
      }
    }, true);
  };

  const handleBtRenamePole = (poleId: string, title: string) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((p) => p.id === poleId ? { ...p, title } : p)
      }
    }, true);
  };

  const handleBtRenameTransformer = (transformerId: string, title: string) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        transformers: btTopology.transformers.map((t) => t.id === transformerId ? { ...t, title } : t)
      }
    }, true);
  };

  const handleBtSetPoleVerified = (poleId: string, verified: boolean) => {
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((pole) => pole.id === poleId ? { ...pole, verified } : pole)
      }
    }, true);
  };

  const handleBtQuickAddPoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast('Poste não encontrado', 'error');
      return;
    }

    if ((settings.projectType ?? 'ramais') !== 'clandestino') {
      setNormalRamalModal({
        poleId,
        poleTitle: pole.title,
        ramalType: NORMAL_CLIENT_RAMAL_TYPES[0],
        quantity: 1
      });
      return;
    }

    const quantity = 1;

    const nextRamalId = `RP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((candidate) =>
          candidate.id === poleId
            ? {
                ...candidate,
                ramais: [...(candidate.ramais ?? []), { id: nextRamalId, quantity, ramalType: CLANDESTINO_RAMAL_TYPE }]
              }
            : candidate
        )
      }
    }, true);

    showToast(`+${quantity} ramal em ${pole.title}.`, 'success');
  };

  const handleBtQuickRemovePoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast('Poste não encontrado', 'error');
      return;
    }

    const ramais = [...(pole.ramais ?? [])];
    if (ramais.length === 0) {
      showToast(`${pole.title} sem ramais para reduzir.`, 'info');
      return;
    }

    const isClandestinoMode = (settings.projectType ?? 'ramais') === 'clandestino';
    const targetIndex = [...ramais]
      .map((ramal, index) => ({ ramal, index }))
      .reverse()
      .find(({ ramal }) => {
        const isClandestinoRamal = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
        return isClandestinoMode ? isClandestinoRamal : !isClandestinoRamal;
      })?.index;

    if (targetIndex === undefined) {
      showToast(
        isClandestinoMode
          ? `${pole.title} não possui ramais clandestinos para reduzir.`
          : `${pole.title} não possui ramais normais para reduzir.`,
        'info'
      );
      return;
    }

    const targetRamal = ramais[targetIndex];
    if (targetRamal.quantity > 1) {
      ramais[targetIndex] = { ...targetRamal, quantity: targetRamal.quantity - 1 };
    } else {
      ramais.splice(targetIndex, 1);
    }

    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((candidate) =>
          candidate.id === poleId ? { ...candidate, ramais } : candidate
        )
      }
    }, true);

    showToast(`-1 ramal em ${pole.title}.`, 'success');
  };

  const handleBtQuickAddEdgeConductor = (edgeId: string, conductorName: string) => {
    const edge = btTopology.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      showToast('Condutor não encontrado', 'error');
      return;
    }

    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    const existingIndex = conductors.findIndex((entry) => entry.conductorName === selectedConductor);
    if (existingIndex === -1) {
      conductors.push({
        id: `C${Date.now()}${Math.floor(Math.random() * 1000)}`,
        quantity: 1,
        conductorName: selectedConductor
      });
    } else {
      const target = conductors[existingIndex];
      conductors[existingIndex] = { ...target, quantity: target.quantity + 1 };
    }

    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        edges: btTopology.edges.map((candidate) =>
          candidate.id === edgeId ? { ...candidate, conductors } : candidate
        )
      }
    }, true);

    showToast(`+1 ${selectedConductor} no trecho ${edgeId}.`, 'success');
  };

  const handleBtQuickRemoveEdgeConductor = (edgeId: string, conductorName: string) => {
    const edge = btTopology.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      showToast('Condutor não encontrado', 'error');
      return;
    }

    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    if (conductors.length === 0) {
      showToast(`Trecho ${edgeId} sem condutor para reduzir.`, 'info');
      return;
    }

    const targetIndex = [...conductors]
      .map((entry, index) => ({ entry, index }))
      .reverse()
      .find(({ entry }) => entry.conductorName === selectedConductor)?.index;

    if (targetIndex === undefined) {
      showToast(`Trecho ${edgeId} sem ${selectedConductor} para reduzir.`, 'info');
      return;
    }

    const target = conductors[targetIndex];
    if (target.quantity > 1) {
      conductors[targetIndex] = { ...target, quantity: target.quantity - 1 };
    } else {
      conductors.splice(targetIndex, 1);
    }

    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        edges: btTopology.edges.map((candidate) =>
          candidate.id === edgeId ? { ...candidate, conductors } : candidate
        )
      }
    }, true);

    showToast(`-1 ${selectedConductor} no trecho ${edgeId}.`, 'success');
  };

  const handleConfirmNormalRamalModal = () => {
    if (!normalRamalModal) {
      return;
    }

    const quantity = Math.max(1, Math.round(normalRamalModal.quantity));
    const nextRamalId = `RP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((candidate) =>
          candidate.id === normalRamalModal.poleId
            ? {
                ...candidate,
                ramais: [
                  ...(candidate.ramais ?? []),
                  { id: nextRamalId, quantity, ramalType: normalRamalModal.ramalType }
                ]
              }
            : candidate
        )
      }
    }, true);

    setPendingNormalClassificationPoles((current) =>
      current.filter((entry) => entry.poleId !== normalRamalModal.poleId)
    );

    showToast(`${quantity} ramal(is) ${normalRamalModal.ramalType} em ${normalRamalModal.poleTitle}.`, 'success');
    setNormalRamalModal(null);
  };

  const isSidebarDockedForRamalModal = Boolean(normalRamalModal);

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
                  setPendingBtEdgeStartPoleId(null);
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