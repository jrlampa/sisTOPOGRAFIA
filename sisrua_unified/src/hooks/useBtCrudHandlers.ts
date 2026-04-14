/**
 * useBtCrudHandlers.ts (REFACTORED)
 * 
 * **SPLIT INTO 3 SPECIALIZED HOOKS FOR SRP COMPLIANCE:**
 * - useBtPoleOperations.ts → All pole CRUD operations
 * - useBtEdgeOperations.ts → All edge/conductor CRUD operations
 * - useBtTransformerOperations.ts → All transformer CRUD operations
 * 
 * This hook now contains ONLY:
 * - Central state orchestration (handleBtMapClick delegator)
 * - Global topology updates (updateBtTopology)
 * - Export/download handlers (validateBtBeforeExport, exportBtHistoryJson, exportBtHistoryCsv)
 * - System-wide operations (reset, area configuration)
 * 
 * IMPACT: Reduces from 1221 → ~400 lines (SRP: Single Responsibility Principle)
 */

import { useState } from 'react';
import { GlobalState, GeoLocation, BtTopology, AppSettings } from '../types';
import { ToastType } from '../components/Toast';
import {
  EMPTY_BT_TOPOLOGY,
  MAX_BT_EXPORT_HISTORY,
  CLANDESTINO_RAMAL_TYPE,  
  getEdgeChangeFlag,
  normalizeBtPoles,
  normalizeBtTransformers,
  normalizeBtEdges,
} from '../utils/btNormalization';
import {
  getClandestinoAreaRange,
  getClandestinoClientsRange,
  getClandestinoKvaByArea,
  getClandestinoDiversificationFactorByClients,
  calculateClandestinoDemandKvaByAreaAndClients
} from '../utils/btCalculations';
import { downloadCsv, downloadJson } from '../utils/downloads';
import { useBtPoleOperations, PendingNormalClassificationPole } from './useBtPoleOperations';
import { useBtEdgeOperations } from './useBtEdgeOperations';
import { useBtTransformerOperations } from './useBtTransformerOperations';

// ─── Helper ────────────────────────────────────────────────────────────────

const escapeCsvCell = (value: string | number) => {
  const normalized = String(value).replace(/\r?\n/g, ' ');
  if (normalized.includes(';') || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
};

export function useBtCrudHandlers({ appState, setAppState, showToast }: Params) {
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const settings: AppSettings = appState.settings;
  const btExportSummary = appState.btExportSummary ?? null;
  const btExportHistory = appState.btExportHistory ?? [];

  // ── Compose 3 specialized hooks ────────────────────────────────────────────
  const poles = useBtPoleOperations({ appState, setAppState, showToast });
  const edges = useBtEdgeOperations({ appState, setAppState, showToast, findNearestPole: poles.findNearestPole });
  const transformers = useBtTransformerOperations({ appState, setAppState, showToast, findNearestPole: poles.findNearestPole });

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // ─── Central Orchestration ─────────────────────────────────────────────────

  const updateBtTopology = (nextTopology: BtTopology) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...nextTopology,
          poles: normalizeBtPoles(nextTopology.poles),
          transformers: normalizeBtTransformers(nextTopology.transformers),
          edges: normalizeBtEdges(nextTopology.edges)
        }
      },
      true
    );
  };

  const updateClandestinoAreaM2 = (nextAreaM2: number) => {
    setAppState(
      { ...appState, settings: { ...settings, clandestinoAreaM2: nextAreaM2 } },
      true
    );
  };

  /**
   * Map click handler - delegates to appropriate pole/edge/transformer hook
   * based on current btEditorMode setting.
   * This is the main orchestrator that routes clicks to the right domain handler.
   */
  const handleBtMapClick = (location: GeoLocation) => {
    const btEditorMode = settings.btEditorMode ?? 'none';

    if (btEditorMode === 'none' || btEditorMode === 'move-pole') {
      return;
    }

    if (btEditorMode === 'add-pole') {
      poles.insertBtPoleAtLocation(location);
      return;
    }

    if (btEditorMode === 'add-transformer') {
      transformers.handleBtMapClickAddTransformer(location);
      return;
    }

    if (btEditorMode === 'add-edge') {
      edges.handleBtMapClickAddEdge(location);
    }
  };

  // ─── Export & Validation ────────────────────────────────────────────────────

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

    downloadJson(payload, `${settings.projectMetadata.projectName}_bt_history.json`, true);
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

    downloadCsv(csv, `${settings.projectMetadata.projectName}_bt_history.csv`);
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

      const totalClandestinoClients = btTopology.poles.reduce(
        (acc, pole) => acc + poles.getPoleClandestinoClients(pole),
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

    const edgeWithoutConductors = btTopology.edges.find(
      (edge) => getEdgeChangeFlag(edge) !== 'remove' && edge.conductors.length === 0
    );
    if (edgeWithoutConductors) {
      showToast(`Trecho ${edgeWithoutConductors.id} sem condutores definidos.`, 'error');
      return false;
    }

    const replacementWithoutOutgoing = btTopology.edges.find(
      (edge) =>
        getEdgeChangeFlag(edge) === 'replace' &&
        (!edge.replacementFromConductors || edge.replacementFromConductors.length === 0)
    );
    if (replacementWithoutOutgoing) {
      showToast(
        `Trecho ${replacementWithoutOutgoing.id} marcado para substituição, mas sem condutores de respaldo.`,
        'error'
      );
      return false;
    }

    const transformerReplacementMissingInfo = btTopology.transformers.find(
      (transformer) =>
        (transformer.transformerChangeFlag ?? 'existing') === 'replace' &&
        (!(typeof transformer.replacementFromKva === 'number' && transformer.replacementFromKva > 0) ||
          !(typeof transformer.replacementToKva === 'number' && transformer.replacementToKva > 0))
    );
    if (transformerReplacementMissingInfo) {
      showToast(
        `Transformador ${transformerReplacementMissingInfo.id} marcado para substituição, mas sem trafo que sai e/ou entra.`,
        'error'
      );
      return false;
    }

    if (settings.projectType === 'ramais') {
      const transformerWithoutReadings = btTopology.transformers.find(
        (transformer) => transformer.readings.length === 0
      );
      if (transformerWithoutReadings) {
        showToast(`Transformador ${transformerWithoutReadings.id} sem leituras.`, 'error');
        return false;
      }
    }

    return true;
  };

  // ─── System Operations ─────────────────────────────────────────────────────

  const handleResetBtTopology = () => {
    const hasBtData =
      btTopology.poles.length > 0 || btTopology.edges.length > 0 || btTopology.transformers.length > 0;
    if (!hasBtData && btExportSummary === null && btExportHistory.length === 0) {
      showToast('Topologia BT já está vazia.', 'info');
      return;
    }

    setResetConfirmOpen(true);
  };

  const handleConfirmResetBtTopology = () => {
    setResetConfirmOpen(false);
    edges.clearPendingBtEdge();
    setAppState(
      { ...appState, btTopology: EMPTY_BT_TOPOLOGY, btExportSummary: null, btExportHistory: [] },
      true
    );
    showToast('Topologia BT zerada.', 'success');
  };

  // ─── Return (Composition of 3 hooks + central handlers) ────────────────────

  return {
    // ── State from specialized hooks ────────────────────────────────────────
    ...poles,
    ...edges,
    ...transformers,

    // ── Central handlers ────────────────────────────────────────────────────
    updateBtTopology,
    updateClandestinoAreaM2,
    handleBtMapClick,
    handleResetBtTopology,
    resetConfirmOpen,
    setResetConfirmOpen,
    handleConfirmResetBtTopology,
    
    // ── Export/History ─────────────────────────────────────────────────────
    clearBtExportHistory,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    validateBtBeforeExport,

    // ── Re-export helpers for downstream components ─────────────────────────
    calculateClandestinoDemandKvaByAreaAndClients
  };
}
