import { useEffect, useRef, useState } from 'react';
import type { BtExportHistoryEntry, BtExportSummary, GlobalState } from '../types';
import type { ToastType } from '../components/Toast';
import {
  clearBtExportHistoryRemote,
  ingestBtExportHistory,
  listBtExportHistory,
} from '../services/btExportHistoryService';
import { MAX_BT_EXPORT_HISTORY } from '../utils/btNormalization';

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
  projectType: 'ramais' | 'clandestino';
};

export function useBtExportHistory({ appState, setAppState, showToast, projectType }: Params) {
  const btHistoryHydratedRef = useRef(false);
  const [btHistoryTotal, setBtHistoryTotal] = useState(0);
  const [btHistoryLoading, setBtHistoryLoading] = useState(false);
  const [btHistoryProjectTypeFilter, setBtHistoryProjectTypeFilter] = useState<'all' | 'ramais' | 'clandestino'>('all');
  const [btHistoryCqtScenarioFilter, setBtHistoryCqtScenarioFilter] = useState<'all' | 'atual' | 'proj1' | 'proj2'>('all');

  const btExportSummary = appState.btExportSummary ?? null;
  const btExportHistory = appState.btExportHistory ?? [];
  const latestBtExport = btExportSummary ?? btExportHistory[0] ?? null;
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

  const ingestBtContextHistory = async (btContextUrl: string, btContext: unknown) => {
    try {
      const result = await ingestBtExportHistory({
        btContextUrl,
        btContext,
        projectType,
      });

      if (!result.entry) {
        return;
      }

      appendBtHistoryEntry(result.entry);
    } catch {
      showToast('Falha ao consolidar resumo BT no backend.', 'error');
    }
  };

  useEffect(() => {
    if (btHistoryHydratedRef.current) {
      return;
    }

    if ((appState.btExportHistory ?? []).length > 0) {
      btHistoryHydratedRef.current = true;
      return;
    }

    btHistoryHydratedRef.current = true;
    void loadBtHistoryPage(0, false);
  }, [appState]);

  useEffect(() => {
    if (!btHistoryHydratedRef.current) {
      return;
    }

    void loadBtHistoryPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btHistoryProjectTypeFilter, btHistoryCqtScenarioFilter]);

  return {
    latestBtExport,
    btExportHistory,
    btHistoryTotal,
    btHistoryLoading,
    btHistoryCanLoadMore,
    btHistoryProjectTypeFilter,
    setBtHistoryProjectTypeFilter,
    btHistoryCqtScenarioFilter,
    setBtHistoryCqtScenarioFilter,
    handleLoadMoreBtHistory,
    handleClearBtExportHistory,
    ingestBtContextHistory,
  };
}