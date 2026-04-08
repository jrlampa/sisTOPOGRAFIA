import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Database, BarChart2, History } from 'lucide-react';
import {
  CatalogSnapshotMeta,
  ConstantsCatalogStatus,
  ConstantsRefreshEvent,
  ConstantsRefreshStats,
  fetchCatalogSnapshots,
  fetchConstantsRefreshEvents,
  fetchConstantsCatalogStatus,
  fetchConstantsRefreshStats,
  refreshConstantsCatalog,
  restoreCatalogSnapshot,
} from '../services/constantsCatalogService';

const formatDate = (value?: string): string => {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ConstantsCatalogOps: React.FC = () => {
  const [status, setStatus] = useState<ConstantsCatalogStatus | null>(null);
  const [events, setEvents] = useState<ConstantsRefreshEvent[]>([]);
  const [stats, setStats] = useState<ConstantsRefreshStats | null>(null);
  const [snapshots, setSnapshots] = useState<CatalogSnapshotMeta[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const payload = await fetchConstantsCatalogStatus();
      setStatus(payload);
      setMessage('Status do catalogo atualizado.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Falha ao carregar status do catalogo.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const payload = await fetchConstantsRefreshEvents(5, token || undefined);
      setEvents(payload.events);
    } catch {
      setEvents([]);
    }
  }, [token]);

  const loadStats = useCallback(async () => {
    try {
      const payload = await fetchConstantsRefreshStats(token || undefined);
      setStats(payload);
    } catch {
      setStats(null);
    }
  }, [token]);

  const loadSnapshots = useCallback(async () => {
    try {
      const payload = await fetchCatalogSnapshots(8, token || undefined);
      setSnapshots(payload.snapshots);
    } catch {
      setSnapshots([]);
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadEvents();
    loadStats();
    loadSnapshots();
  }, [loadEvents, loadStats, loadSnapshots]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshConstantsCatalog(token || undefined);
      await loadStatus();
      await loadEvents();
      await loadStats();
      await loadSnapshots();
      setMessage('Refresh operacional concluido com sucesso.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Falha no refresh do catalogo.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    try {
      const result = await restoreCatalogSnapshot(id, token || undefined);
      await loadStatus();
      await loadSnapshots();
      setMessage(`Snapshot #${result.restoredSnapshotId} (${result.namespace}) restaurado — ${result.entryCount} entradas.`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : `Falha ao restaurar snapshot #${id}.`);
    } finally {
      setRestoringId(null);
    }
  };

  const namespaces = status
    ? Object.entries(status.flags)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .join(', ') || 'nenhum'
    : 'carregando';

  return (
    <div className="bg-slate-800/30 p-3 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <Database size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-slate-300 uppercase">Catalogo de Constantes</span>
      </div>

      <div className="text-[11px] text-slate-400 space-y-1">
        <p>Namespaces ativos: <span className="text-slate-200">{namespaces}</span></p>
        <p>Ultimo refresh: <span className="text-slate-200">{formatDate(status?.lastRefreshEvent?.createdAt)}</span></p>
        <p>Ator: <span className="text-slate-200">{status?.lastRefreshEvent?.actor ?? 'n/a'}</span></p>
        <p>Duracao: <span className="text-slate-200">{status?.lastRefreshEvent?.durationMs ?? 'n/a'} ms</span></p>
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          placeholder="Token refresh (opcional/local)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-100 outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={loadStatus}
          disabled={loadingStatus}
          className="flex-1 py-2 text-xs rounded border border-slate-700 text-slate-300 hover:text-white"
        >
          {loadingStatus ? 'Atualizando...' : 'Atualizar Status'}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex-1 py-2 text-xs rounded border border-cyan-500/50 text-cyan-300 hover:text-cyan-200 flex items-center justify-center gap-2"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refresh...' : 'Refresh Catalogo'}
        </button>
      </div>

      <div className="rounded border border-slate-700 p-2 space-y-1">
        <div className="flex items-center gap-1 mb-1">
          <BarChart2 size={11} className="text-slate-400" />
          <p className="text-[11px] text-slate-400 uppercase">Estatisticas de Refresh</p>
        </div>
        {stats ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <span className="text-slate-400">Total refreshes:</span>
            <span className="text-slate-200">{stats.totalRefreshes}</span>
            <span className="text-slate-400">Taxa de sucesso:</span>
            <span className={stats.successRate >= 90 ? 'text-emerald-300' : stats.successRate >= 60 ? 'text-yellow-300' : 'text-rose-300'}>
              {stats.successRate}% ({stats.successCount}/{stats.totalRefreshes})
            </span>
            <span className="text-slate-400">Duracao media:</span>
            <span className="text-slate-200">{stats.avgDurationMs != null ? `${stats.avgDurationMs}ms` : 'n/a'}</span>
            <span className="text-slate-400">Duracao max:</span>
            <span className="text-slate-200">{stats.maxDurationMs != null ? `${stats.maxDurationMs}ms` : 'n/a'}</span>
            <span className="text-slate-400">Ultimo sucesso:</span>
            <span className="text-slate-200 col-span-1 truncate">{formatDate(stats.lastSuccessAt ?? undefined)}</span>
            {Object.keys(stats.namespaceFrequency).length > 0 && (
              <>
                <span className="text-slate-400">Namespaces (freq):</span>
                <span className="text-slate-200 truncate">
                  {Object.entries(stats.namespaceFrequency).map(([ns, n]) => `${ns}(${n})`).join(', ')}
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Sem dados ou sem permissao para leitura.</p>
        )}
      </div>

      <div className="rounded border border-slate-700 p-2 space-y-1">
        <p className="text-[11px] text-slate-400 uppercase">Historico Recente</p>
        {events.length === 0 ? (
          <p className="text-[11px] text-slate-500">Sem eventos ou sem permissao para leitura.</p>
        ) : (
          events.map((event, index) => (
            <div key={`${event.createdAt ?? 'event'}-${index}`} className="text-[11px] text-slate-300 flex items-center justify-between gap-2">
              <span className={event.success ? 'text-emerald-300' : 'text-rose-300'}>{event.success ? 'OK' : 'ERR'} {event.httpStatus}</span>
              <span className="truncate">{event.actor}</span>
              <span>{event.durationMs ?? 0}ms</span>
              <span>{formatDate(event.createdAt)}</span>
            </div>
          ))
        )}
      </div>

      <div className="rounded border border-slate-700 p-2 space-y-1">
        <div className="flex items-center gap-1 mb-1">
          <History size={11} className="text-slate-400" />
          <p className="text-[11px] text-slate-400 uppercase">Snapshots</p>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-[11px] text-slate-500">Sem snapshots ou sem permissao para leitura.</p>
        ) : (
          snapshots.map((snap) => (
            <div key={snap.id} className="text-[11px] flex items-center justify-between gap-2">
              <span className="text-slate-400">#{snap.id}</span>
              <span className="text-cyan-300/80 flex-shrink-0">{snap.namespace}</span>
              <span className="text-slate-400 flex-shrink-0">{snap.entryCount}k</span>
              <span className="text-slate-500 truncate flex-1">{formatDate(snap.createdAt)}</span>
              <button
                onClick={() => handleRestore(snap.id)}
                disabled={restoringId !== null}
                className="flex-shrink-0 px-2 py-0.5 text-[10px] rounded border border-amber-500/50 text-amber-300 hover:text-amber-200 disabled:opacity-40"
              >
                {restoringId === snap.id ? '...' : 'Restaurar'}
              </button>
            </div>
          ))
        )}
      </div>

      {message && <p className="text-[11px] text-slate-300">{message}</p>}
    </div>
  );
};

export default ConstantsCatalogOps;

