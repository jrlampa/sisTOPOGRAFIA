import { Download, X } from "lucide-react";
import { usePagination, PaginationControls } from "../hooks/usePagination";
import type { BtExportSummary, BtExportHistoryEntry } from "../types";

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

  if (!latestBtExport && btExportHistory.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-500/30 bg-white/95 dark:bg-slate-950/95 px-4 py-3 text-xs text-slate-800 dark:text-cyan-100 shadow-xl backdrop-blur-md w-[calc(100vw-2rem)] max-w-[56rem]">
      <div className="flex items-center justify-between gap-4">
        <div className="font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
          Resumo BT Exportado
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportBtHistoryJson}
            className="inline-flex items-center gap-1 rounded border border-cyan-500/40 px-2 py-0.5 text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            <Download size={10} /> JSON
          </button>
          <button
            onClick={exportBtHistoryCsv}
            className="inline-flex items-center gap-1 rounded border border-cyan-500/40 px-2 py-0.5 text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            <Download size={10} /> CSV
          </button>
          <button
            onClick={clearBtExportHistory}
            className="rounded border border-cyan-500/40 px-2 py-0.5 text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            Limpar
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fechar resumo BT exportado"
              title="Fechar"
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-cyan-500/40 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {latestBtExport && (
        <>
          <div className="mt-1">
            Ponto crítico: {latestBtExport.criticalPoleId} | CLT acum.:{" "}
            {latestBtExport.criticalAccumulatedClients} | Demanda acum.:{" "}
            {latestBtExport.criticalAccumulatedDemandKva.toFixed(2)}
          </div>
          {((latestBtExport.totalPoles ?? 0) > 0 ||
            (latestBtExport.totalEdges ?? 0) > 0 ||
            (latestBtExport.totalTransformers ?? 0) > 0) && (
            <div className="mt-1 text-slate-700 dark:text-cyan-100/90">
              Verificação Atual: Postes {latestBtExport.verifiedPoles ?? 0}/
              {latestBtExport.totalPoles ?? 0} | Condutores{" "}
              {latestBtExport.verifiedEdges ?? 0}/
              {latestBtExport.totalEdges ?? 0} | Trafos{" "}
              {latestBtExport.verifiedTransformers ?? 0}/
              {latestBtExport.totalTransformers ?? 0}
            </div>
          )}
          {latestBtExport.cqt && (
            <div className="mt-1 text-slate-700 dark:text-cyan-100/90">
              CQT {latestBtExport.cqt.scenario?.toUpperCase() ?? "-"}: DMDI{" "}
              {latestBtExport.cqt.dmdi?.toFixed(3) ?? "-"} | P31{" "}
              {latestBtExport.cqt.p31?.toFixed(3) ?? "-"} | P32{" "}
              {latestBtExport.cqt.p32?.toFixed(3) ?? "-"} | K10{" "}
              {latestBtExport.cqt.k10QtMttr?.toFixed(6) ?? "-"}
              {typeof latestBtExport.cqt.parityPassed === "number" &&
              typeof latestBtExport.cqt.parityFailed === "number"
                ? ` | Paridade ${latestBtExport.cqt.parityPassed} OK / ${latestBtExport.cqt.parityFailed} falhas`
                : ""}
            </div>
          )}
          <a
            href={latestBtExport.btContextUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-cyan-700 dark:text-cyan-300 underline underline-offset-2 hover:text-cyan-600 dark:hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded"
          >
            Abrir metadata BT (JSON)
          </a>
        </>
      )}

      {btExportHistory.length > 0 && (
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
              {btHistoryLoading ? "Carregando..." : "Carregar mais do servidor"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
