import { useState } from "react";
import { ChevronDown, ChevronUp, Download, X } from "lucide-react";
import { usePagination, PaginationControls } from "../hooks/usePagination";
import type { BtExportSummary, BtExportHistoryEntry } from "../types";

// CQT severity thresholds (PRODIST / ANEEL reference values, %)
const CQT_WARN_THRESHOLD = 5;
const CQT_CRITICAL_THRESHOLD = 8;

function cqtSeverityClass(value: number | null | undefined): string {
  if (value == null) return "text-slate-500";
  if (value >= CQT_CRITICAL_THRESHOLD)
    return "font-bold text-red-600 dark:text-red-400";
  if (value >= CQT_WARN_THRESHOLD)
    return "font-bold text-amber-600 dark:text-amber-400";
  return "font-bold text-emerald-600 dark:text-emerald-400";
}

function cqtSeverityBadge(value: number | null | undefined): string {
  if (value == null) return "";
  if (value >= CQT_CRITICAL_THRESHOLD) return "🔴";
  if (value >= CQT_WARN_THRESHOLD) return "🟡";
  return "🟢";
}

interface BtExportSummaryBannerProps {
  latestBtExport: BtExportSummary | BtExportHistoryEntry | null;
  btExportHistory: BtExportHistoryEntry[];
  exportBtHistoryJson: () => void;
  exportBtHistoryCsv: () => void;
  clearBtExportHistory: () => void;
  onClose?: () => void;
  btHistoryTotal?: number;
  btHistoryLoading?: boolean;
  btHistoryCanLoadMore?: boolean;
  onLoadMoreBtHistory?: () => void;
  historyProjectTypeFilter?: "all" | "ramais" | "clandestino";
  onHistoryProjectTypeFilterChange?: (
    value: "all" | "ramais" | "clandestino",
  ) => void;
  historyCqtScenarioFilter?: "all" | "atual" | "proj1" | "proj2";
  onHistoryCqtScenarioFilterChange?: (
    value: "all" | "atual" | "proj1" | "proj2",
  ) => void;
}

export function BtExportSummaryBanner({
  latestBtExport,
  btExportHistory,
  exportBtHistoryJson,
  exportBtHistoryCsv,
  clearBtExportHistory,
  onClose,
  btHistoryTotal = 0,
  btHistoryLoading = false,
  btHistoryCanLoadMore = false,
  onLoadMoreBtHistory,
  historyProjectTypeFilter = "all",
  onHistoryProjectTypeFilterChange,
  historyCqtScenarioFilter = "all",
  onHistoryCqtScenarioFilterChange,
}: BtExportSummaryBannerProps) {
  // Item 23: Paginação de histórico BT
  const historyPagination = usePagination(btExportHistory, 5);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!latestBtExport && btExportHistory.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-[56rem]">
      <div className="rounded-2xl border border-cyan-500/25 bg-white/98 dark:bg-slate-950/98 shadow-[0_20px_48px_rgba(6,182,212,0.12),0_8px_16px_rgba(0,0,0,0.10)] backdrop-blur-xl overflow-hidden">
        {/* Header bar — clicável para colapsar/expandir */}
        <div
          className={`flex items-center justify-between gap-4 bg-gradient-to-r from-cyan-500/5 to-transparent px-4 py-2.5 cursor-pointer select-none${isCollapsed ? "" : " border-b border-cyan-500/15"}`}
          onClick={() => setIsCollapsed((v) => !v)}
          title={isCollapsed ? "Expandir resumo" : "Minimizar resumo"}
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              Resumo BT Exportado
            </span>
            {isCollapsed && (
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-normal normal-case tracking-normal">
                (clique para expandir)
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={exportBtHistoryJson}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              <Download size={10} /> JSON
            </button>
            <button
              onClick={exportBtHistoryCsv}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              <Download size={10} /> CSV
            </button>
            <button
              onClick={clearBtExportHistory}
              className="rounded-lg border border-rose-400/30 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
            >
              Limpar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed((v) => !v);
              }}
              aria-label={
                isCollapsed ? "Expandir resumo BT" : "Minimizar resumo BT"
              }
              title={isCollapsed ? "Expandir" : "Minimizar"}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              {isCollapsed ? (
                <ChevronUp size={11} />
              ) : (
                <ChevronDown size={11} />
              )}
            </button>
            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Fechar resumo BT exportado"
                title="Fechar"
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-rose-400/40 dark:border-rose-500/30 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
        {!isCollapsed && <div className="border-t border-cyan-500/15" />}

        {!isCollapsed && latestBtExport && (
          <div className="px-4 py-3 text-xs text-slate-800 dark:text-cyan-100">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-semibold text-slate-500 dark:text-slate-400">
                Ponto crítico:
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {latestBtExport.criticalPoleId}
              </span>
              <span className="text-slate-500 dark:text-slate-500">|</span>
              <span className="text-slate-600 dark:text-slate-400">
                CLT acum.:{" "}
                <strong className="text-slate-800 dark:text-white">
                  {latestBtExport.criticalAccumulatedClients}
                </strong>
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                Demanda:{" "}
                <strong className="text-slate-800 dark:text-white">
                  {latestBtExport.criticalAccumulatedDemandKva.toFixed(2)} kVA
                </strong>
              </span>
            </div>
            {((latestBtExport.totalPoles ?? 0) > 0 ||
              (latestBtExport.totalEdges ?? 0) > 0 ||
              (latestBtExport.totalTransformers ?? 0) > 0) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-cyan-100/80">
                <span>
                  Postes{" "}
                  <strong className="text-slate-800 dark:text-white">
                    {latestBtExport.verifiedPoles ?? 0}/
                    {latestBtExport.totalPoles ?? 0}
                  </strong>
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span>
                  Condutores{" "}
                  <strong className="text-slate-800 dark:text-white">
                    {latestBtExport.verifiedEdges ?? 0}/
                    {latestBtExport.totalEdges ?? 0}
                  </strong>
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span>
                  Trafos{" "}
                  <strong className="text-slate-800 dark:text-white">
                    {latestBtExport.verifiedTransformers ?? 0}/
                    {latestBtExport.totalTransformers ?? 0}
                  </strong>
                </span>
              </div>
            )}
            {latestBtExport.cqt && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50/60 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500">
                  CQT {latestBtExport.cqt.scenario?.toUpperCase() ?? "-"}
                </span>
                <span>
                  DMDI{" "}
                  <span className={cqtSeverityClass(latestBtExport.cqt.dmdi)}>
                    {cqtSeverityBadge(latestBtExport.cqt.dmdi)}{" "}
                    {latestBtExport.cqt.dmdi?.toFixed(3) ?? "-"}
                  </span>
                </span>
                <span>
                  P31{" "}
                  <span className={cqtSeverityClass(latestBtExport.cqt.p31)}>
                    {cqtSeverityBadge(latestBtExport.cqt.p31)}{" "}
                    {latestBtExport.cqt.p31?.toFixed(3) ?? "-"}
                  </span>
                </span>
                <span>
                  P32{" "}
                  <span className={cqtSeverityClass(latestBtExport.cqt.p32)}>
                    {cqtSeverityBadge(latestBtExport.cqt.p32)}{" "}
                    {latestBtExport.cqt.p32?.toFixed(3) ?? "-"}
                  </span>
                </span>
                <span>
                  K10{" "}
                  <span className="font-medium">
                    {latestBtExport.cqt.k10QtMttr?.toFixed(6) ?? "-"}
                  </span>
                </span>
                {typeof latestBtExport.cqt.parityPassed === "number" &&
                  typeof latestBtExport.cqt.parityFailed === "number" && (
                    <span>
                      Paridade{" "}
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {latestBtExport.cqt.parityPassed} OK
                      </span>
                      {" / "}
                      <span
                        className={
                          latestBtExport.cqt.parityFailed > 0
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : ""
                        }
                      >
                        {latestBtExport.cqt.parityFailed} falhas
                      </span>
                    </span>
                  )}
              </div>
            )}
            <a
              href={latestBtExport.btContextUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 underline underline-offset-2 hover:text-cyan-600 dark:hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded"
            >
              Abrir metadata BT (JSON)
            </a>
          </div>
        )}

        {!isCollapsed && btExportHistory.length > 0 && (
          <div className="mt-3 border-t border-cyan-500/20 pt-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                Histórico ({historyPagination.totalItems}/
                {btHistoryTotal > 0
                  ? btHistoryTotal
                  : historyPagination.totalItems}
                )
              </div>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={historyProjectTypeFilter}
                  onChange={(event) =>
                    onHistoryProjectTypeFilterChange?.(
                      event.target.value as "all" | "ramais" | "clandestino",
                    )
                  }
                  aria-label="Filtro de tipo de projeto do histórico BT"
                  title="Filtrar histórico por tipo de projeto"
                  className="rounded border border-cyan-500/30 bg-white dark:bg-slate-900 px-1 py-0.5 text-slate-800 dark:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="ramais">Ramais</option>
                  <option value="clandestino">Clandestino</option>
                </select>
                <select
                  value={historyCqtScenarioFilter}
                  onChange={(event) =>
                    onHistoryCqtScenarioFilterChange?.(
                      event.target.value as "all" | "atual" | "proj1" | "proj2",
                    )
                  }
                  aria-label="Filtro de cenário CQT do histórico BT"
                  title="Filtrar histórico por cenário CQT"
                  className="rounded border border-cyan-500/30 bg-white dark:bg-slate-900 px-1 py-0.5 text-slate-800 dark:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                >
                  <option value="all">CQT: todos</option>
                  <option value="atual">CQT atual</option>
                  <option value="proj1">CQT proj1</option>
                  <option value="proj2">CQT proj2</option>
                </select>
              </div>
            </div>
            {historyPagination.items.map((entry, index) => (
              <div
                key={`${entry.exportedAt}-${entry.criticalPoleId}-${index}`}
                className="text-sm text-slate-700 dark:text-cyan-100/90"
              >
                {new Date(entry.exportedAt).toLocaleString("pt-BR")} |{" "}
                {entry.projectType.toUpperCase()} | {entry.criticalPoleId} |{" "}
                {entry.criticalAccumulatedDemandKva.toFixed(2)}
                {(entry.totalPoles ?? 0) > 0 ||
                (entry.totalEdges ?? 0) > 0 ||
                (entry.totalTransformers ?? 0) > 0
                  ? ` | V ${entry.verifiedPoles ?? 0}/${entry.totalPoles ?? 0} P, ${entry.verifiedEdges ?? 0}/${entry.totalEdges ?? 0} A, ${entry.verifiedTransformers ?? 0}/${entry.totalTransformers ?? 0} T`
                  : ""}
              </div>
            ))}
            <PaginationControls
              currentPage={historyPagination.currentPage}
              totalPages={historyPagination.totalPages}
              totalItems={historyPagination.totalItems}
              onPreviousPage={historyPagination.previousPage}
              onNextPage={historyPagination.nextPage}
              onGoToPage={historyPagination.goToPage}
              className="text-cyan-300 border-cyan-500/40"
            />
            {onLoadMoreBtHistory && btHistoryCanLoadMore && (
              <button
                onClick={onLoadMoreBtHistory}
                disabled={btHistoryLoading}
                className="mt-2 w-full rounded border border-cyan-500/40 px-2 py-1 text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              >
                {btHistoryLoading
                  ? "Carregando..."
                  : "Carregar mais do servidor"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
