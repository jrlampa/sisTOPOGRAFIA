import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Database, BarChart2, History } from "lucide-react";
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
} from "../services/constantsCatalogService";
import type { AppLocale } from "../types";

const formatDate = (value: string | undefined, locale: AppLocale): string => {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale);
};

type ConstantsCatalogOpsProps = {
  locale: AppLocale;
};

const CONSTANTS_TEXT: Record<
  AppLocale,
  {
    title: string;
    activeNamespaces: string;
    lastRefresh: string;
    actor: string;
    duration: string;
    tokenPlaceholder: string;
    loadingStatus: string;
    refreshStatus: string;
    refreshing: string;
    refreshCatalog: string;
    statsTitle: string;
    totalRefreshes: string;
    successRate: string;
    averageDuration: string;
    maxDuration: string;
    lastSuccess: string;
    namespaceFrequency: string;
    noStats: string;
    recentHistory: string;
    noEvents: string;
    snapshots: string;
    noSnapshots: string;
    restore: string;
    activeNamespacesFallback: string;
    loadingFallback: string;
    na: string;
    statusUpdated: string;
    statusLoadError: string;
    refreshSuccess: string;
    refreshError: string;
    restoreSuccess: (
      snapshotId: number,
      namespace: string,
      entryCount: number,
    ) => string;
    restoreError: (snapshotId: number) => string;
    successCode: string;
    errorCode: string;
    noPermission: string;
  }
> = {
  "pt-BR": {
    title: "Catalogo de Constantes",
    activeNamespaces: "Namespaces ativos:",
    lastRefresh: "Ultimo refresh:",
    actor: "Ator:",
    duration: "Duracao:",
    tokenPlaceholder: "Token refresh (opcional/local)",
    loadingStatus: "Atualizando...",
    refreshStatus: "Atualizar Status",
    refreshing: "Refresh...",
    refreshCatalog: "Refresh Catalogo",
    statsTitle: "Estatisticas de Refresh",
    totalRefreshes: "Total refreshes:",
    successRate: "Taxa de sucesso:",
    averageDuration: "Duracao media:",
    maxDuration: "Duracao max:",
    lastSuccess: "Ultimo sucesso:",
    namespaceFrequency: "Namespaces (freq):",
    noStats: "Sem dados ou sem permissao para leitura.",
    recentHistory: "Historico Recente",
    noEvents: "Sem eventos ou sem permissao para leitura.",
    snapshots: "Snapshots",
    noSnapshots: "Sem snapshots ou sem permissao para leitura.",
    restore: "Restaurar",
    activeNamespacesFallback: "nenhum",
    loadingFallback: "carregando",
    na: "n/a",
    statusUpdated: "Status do catalogo atualizado.",
    statusLoadError: "Falha ao carregar status do catalogo.",
    refreshSuccess: "Refresh operacional concluido com sucesso.",
    refreshError: "Falha no refresh do catalogo.",
    restoreSuccess: (snapshotId, namespace, entryCount) =>
      `Snapshot #${snapshotId} (${namespace}) restaurado - ${entryCount} entradas.`,
    restoreError: (snapshotId) => `Falha ao restaurar snapshot #${snapshotId}.`,
    successCode: "OK",
    errorCode: "ERR",
    noPermission: "Sem dados ou sem permissao para leitura.",
  },
  "en-US": {
    title: "Constants Catalog",
    activeNamespaces: "Active namespaces:",
    lastRefresh: "Last refresh:",
    actor: "Actor:",
    duration: "Duration:",
    tokenPlaceholder: "Refresh token (optional/local)",
    loadingStatus: "Updating...",
    refreshStatus: "Refresh Status",
    refreshing: "Refreshing...",
    refreshCatalog: "Refresh Catalog",
    statsTitle: "Refresh Statistics",
    totalRefreshes: "Total refreshes:",
    successRate: "Success rate:",
    averageDuration: "Average duration:",
    maxDuration: "Max duration:",
    lastSuccess: "Last success:",
    namespaceFrequency: "Namespaces (freq):",
    noStats: "No data or no permission to read.",
    recentHistory: "Recent History",
    noEvents: "No events or no permission to read.",
    snapshots: "Snapshots",
    noSnapshots: "No snapshots or no permission to read.",
    restore: "Restore",
    activeNamespacesFallback: "none",
    loadingFallback: "loading",
    na: "n/a",
    statusUpdated: "Catalog status updated.",
    statusLoadError: "Failed to load catalog status.",
    refreshSuccess: "Operational refresh completed successfully.",
    refreshError: "Catalog refresh failed.",
    restoreSuccess: (snapshotId, namespace, entryCount) =>
      `Snapshot #${snapshotId} (${namespace}) restored - ${entryCount} entries.`,
    restoreError: (snapshotId) => `Failed to restore snapshot #${snapshotId}.`,
    successCode: "OK",
    errorCode: "ERR",
    noPermission: "No data or no permission to read.",
  },
  "es-ES": {
    title: "Catalogo de Constantes",
    activeNamespaces: "Namespaces activos:",
    lastRefresh: "Ultima actualizacion:",
    actor: "Actor:",
    duration: "Duracion:",
    tokenPlaceholder: "Token de refresh (opcional/local)",
    loadingStatus: "Actualizando...",
    refreshStatus: "Actualizar Estado",
    refreshing: "Actualizando...",
    refreshCatalog: "Refresh Catalogo",
    statsTitle: "Estadisticas de Refresh",
    totalRefreshes: "Total de refreshes:",
    successRate: "Tasa de exito:",
    averageDuration: "Duracion media:",
    maxDuration: "Duracion maxima:",
    lastSuccess: "Ultimo exito:",
    namespaceFrequency: "Namespaces (freq):",
    noStats: "Sin datos o sin permiso de lectura.",
    recentHistory: "Historial Reciente",
    noEvents: "Sin eventos o sin permiso de lectura.",
    snapshots: "Snapshots",
    noSnapshots: "Sin snapshots o sin permiso de lectura.",
    restore: "Restaurar",
    activeNamespacesFallback: "ninguno",
    loadingFallback: "cargando",
    na: "n/a",
    statusUpdated: "Estado del catalogo actualizado.",
    statusLoadError: "No se pudo cargar el estado del catalogo.",
    refreshSuccess: "Refresh operativo concluido con exito.",
    refreshError: "Fallo en el refresh del catalogo.",
    restoreSuccess: (snapshotId, namespace, entryCount) =>
      `Snapshot #${snapshotId} (${namespace}) restaurado - ${entryCount} entradas.`,
    restoreError: (snapshotId) => `Fallo al restaurar snapshot #${snapshotId}.`,
    successCode: "OK",
    errorCode: "ERR",
    noPermission: "Sin datos o sin permiso de lectura.",
  },
};

const ConstantsCatalogOps: React.FC<ConstantsCatalogOpsProps> = ({
  locale,
}) => {
  const text = CONSTANTS_TEXT[locale] ?? CONSTANTS_TEXT["pt-BR"];
  const [status, setStatus] = useState<ConstantsCatalogStatus | null>(null);
  const [events, setEvents] = useState<ConstantsRefreshEvent[]>([]);
  const [stats, setStats] = useState<ConstantsRefreshStats | null>(null);
  const [snapshots, setSnapshots] = useState<CatalogSnapshotMeta[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const payload = await fetchConstantsCatalogStatus();
      setStatus(payload);
      setMessage(text.statusUpdated);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : text.statusLoadError);
    } finally {
      setLoadingStatus(false);
    }
  }, [text.statusLoadError, text.statusUpdated]);

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
      setMessage(text.refreshSuccess);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : text.refreshError);
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
      setMessage(
        text.restoreSuccess(
          result.restoredSnapshotId,
          result.namespace,
          result.entryCount,
        ),
      );
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : text.restoreError(id));
    } finally {
      setRestoringId(null);
    }
  };

  const namespaces = status
    ? Object.entries(status.flags)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .join(", ") || text.activeNamespacesFallback
    : text.loadingFallback;

  return (
    <div className="bg-slate-800/30 p-3 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <Database size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-slate-300 uppercase">
          {text.title}
        </span>
      </div>

      <div className="text-sm text-slate-400 space-y-1">
        <p>
          {text.activeNamespaces}{" "}
          <span className="text-slate-200">{namespaces}</span>
        </p>
        <p>
          {text.lastRefresh}{" "}
          <span className="text-slate-200">
            {formatDate(status?.lastRefreshEvent?.createdAt, locale)}
          </span>
        </p>
        <p>
          {text.actor}{" "}
          <span className="text-slate-200">
            {status?.lastRefreshEvent?.actor ?? text.na}
          </span>
        </p>
        <p>
          {text.duration}{" "}
          <span className="text-slate-200">
            {status?.lastRefreshEvent?.durationMs ?? text.na} ms
          </span>
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          placeholder={text.tokenPlaceholder}
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
          {loadingStatus ? text.loadingStatus : text.refreshStatus}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex-1 py-2 text-xs rounded border border-cyan-500/50 text-cyan-300 hover:text-cyan-200 flex items-center justify-center gap-2"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? text.refreshing : text.refreshCatalog}
        </button>
      </div>

      <div className="rounded border border-slate-700 p-2 space-y-1">
        <div className="flex items-center gap-1 mb-1">
          <BarChart2 size={11} className="text-slate-400" />
          <p className="text-sm text-slate-400 uppercase">
            {text.statsTitle}
          </p>
        </div>
        {stats ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-400">{text.totalRefreshes}</span>
            <span className="text-slate-200">{stats.totalRefreshes}</span>
            <span className="text-slate-400">{text.successRate}</span>
            <span
              className={
                stats.successRate >= 90
                  ? "text-emerald-300"
                  : stats.successRate >= 60
                    ? "text-yellow-300"
                    : "text-rose-300"
              }
            >
              {stats.successRate}% ({stats.successCount}/{stats.totalRefreshes})
            </span>
            <span className="text-slate-400">{text.averageDuration}</span>
            <span className="text-slate-200">
              {stats.avgDurationMs != null
                ? `${stats.avgDurationMs}ms`
                : text.na}
            </span>
            <span className="text-slate-400">{text.maxDuration}</span>
            <span className="text-slate-200">
              {stats.maxDurationMs != null
                ? `${stats.maxDurationMs}ms`
                : text.na}
            </span>
            <span className="text-slate-400">{text.lastSuccess}</span>
            <span className="text-slate-200 col-span-1 truncate">
              {formatDate(stats.lastSuccessAt ?? undefined, locale)}
            </span>
            {Object.keys(stats.namespaceFrequency).length > 0 && (
              <>
                <span className="text-slate-400">
                  {text.namespaceFrequency}
                </span>
                <span className="text-slate-200 truncate">
                  {Object.entries(stats.namespaceFrequency)
                    .map(([ns, n]) => `${ns}(${n})`)
                    .join(", ")}
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{text.noStats}</p>
        )}
      </div>

      <div className="rounded border border-slate-700 p-2 space-y-1">
        <p className="text-sm text-slate-400 uppercase">
          {text.recentHistory}
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">{text.noEvents}</p>
        ) : (
          events.map((event, index) => (
            <div
              key={`${event.createdAt ?? "event"}-${index}`}
              className="text-sm text-slate-300 flex items-center justify-between gap-2"
            >
              <span
                className={event.success ? "text-emerald-300" : "text-rose-300"}
              >
                {event.success ? text.successCode : text.errorCode}{" "}
                {event.httpStatus}
              </span>
              <span className="truncate">{event.actor}</span>
              <span>{event.durationMs ?? 0}ms</span>
              <span>{formatDate(event.createdAt, locale)}</span>
            </div>
          ))
        )}
      </div>

      <div className="rounded border border-slate-700 p-2 space-y-1">
        <div className="flex items-center gap-1 mb-1">
          <History size={11} className="text-slate-400" />
          <p className="text-sm text-slate-400 uppercase">
            {text.snapshots}
          </p>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-sm text-slate-500">{text.noSnapshots}</p>
        ) : (
          snapshots.map((snap) => (
            <div
              key={snap.id}
              className="text-sm flex items-center justify-between gap-2"
            >
              <span className="text-slate-400">#{snap.id}</span>
              <span className="text-cyan-300/80 flex-shrink-0">
                {snap.namespace}
              </span>
              <span className="text-slate-400 flex-shrink-0">
                {snap.entryCount}k
              </span>
              <span className="text-slate-500 truncate flex-1">
                {formatDate(snap.createdAt, locale)}
              </span>
              <button
                onClick={() => handleRestore(snap.id)}
                disabled={restoringId !== null}
                className="flex-shrink-0 px-2 py-0.5 text-xs rounded border border-amber-500/50 text-amber-300 hover:text-amber-200 disabled:opacity-40"
              >
                {restoringId === snap.id ? "..." : text.restore}
              </button>
            </div>
          ))
        )}
      </div>

      {message && <p className="text-sm text-slate-300">{message}</p>}
    </div>
  );
};

export default ConstantsCatalogOps;
