import { Download } from 'lucide-react';
import type { BtExportSummary, BtExportHistoryEntry } from '../types';

interface BtExportSummaryBannerProps {
  latestBtExport: BtExportSummary | BtExportHistoryEntry | null;
  btExportHistory: BtExportHistoryEntry[];
  exportBtHistoryJson: () => void;
  exportBtHistoryCsv: () => void;
  clearBtExportHistory: () => void;
}

export function BtExportSummaryBanner({
  latestBtExport,
  btExportHistory,
  exportBtHistoryJson,
  exportBtHistoryCsv,
  clearBtExportHistory,
}: BtExportSummaryBannerProps) {
  if (!latestBtExport && btExportHistory.length === 0) {
    return null;
  }

  return (
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
          <div className="mb-1 font-semibold uppercase tracking-wide text-cyan-300">
            Histórico (últimas 5 de {btExportHistory.length})
          </div>
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
  );
}
