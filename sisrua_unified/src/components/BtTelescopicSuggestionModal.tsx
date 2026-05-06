/**
 * BtTelescopicSuggestionModal – REDE NOVA Intelligence
 *
 * Exibe sugestões de substituição telescópica de condutores para terminais
 * com queda de tensão excessiva (< 117 V).
 */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Zap, TrendingDown } from "lucide-react";
import type { TelescopicSuggestion, TelescopicAnalysisOutput } from "../../server/services/bt/btTypes";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BtTelescopicSuggestionModalProps {
  output: TelescopicAnalysisOutput | null;
  onApply: (output: TelescopicAnalysisOutput) => void;
  onCancel: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function voltageColor(v: number): string {
  if (v >= 117) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 110) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function satBadge(pct: number): { label: string; cls: string } {
  if (pct > 100) return { label: "Sobrecarga", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" };
  if (pct > 80) return { label: "Atenção", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  return { label: "OK", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
}

// ─── Sub-componente: card de terminal ─────────────────────────────────────────

function TerminalCard({ suggestion }: { suggestion: TelescopicSuggestion }) {
  const { terminalNodeId, pathEdges, projectedVoltageEndV, saturationPct, requiresTransformerUpgrade } = suggestion;
  const sat = satBadge(saturationPct);
  const approved = projectedVoltageEndV >= 117;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
      {/* Cabeçalho do terminal */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-xs text-slate-700 dark:text-slate-300 truncate">
          Terminal: {terminalNodeId}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${sat.cls}`}>
            {sat.label} {saturationPct.toFixed(0)}%
          </span>
          {approved ? (
            <CheckCircle size={14} className="text-emerald-500" />
          ) : (
            <AlertTriangle size={14} className="text-amber-500" />
          )}
        </div>
      </div>

      {/* Tensão projetada */}
      <div className="flex items-center gap-1.5 text-xs">
        <TrendingDown size={13} className="text-slate-400" />
        <span className="text-slate-500 dark:text-slate-400">Tensão na ponta:</span>
        <span className={`font-bold ${voltageColor(projectedVoltageEndV)}`}>
          {projectedVoltageEndV.toFixed(1)} V
        </span>
        {!approved && (
          <span className="text-rose-500 dark:text-rose-400 font-semibold">(ainda &lt; 117 V)</span>
        )}
      </div>

      {/* Aviso de troca de trafo */}
      {requiresTransformerUpgrade && (
        <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 px-2 py-1.5">
          <AlertTriangle size={13} className="shrink-0 text-rose-500" />
          <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
            Transformador em sobrecarga — substituição necessária
          </span>
        </div>
      )}

      {/* Condutores sugeridos por trecho */}
      {pathEdges.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Trechos (Trafo → Ponta)
          </p>
          <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
            {pathEdges.map((edge, idx) => (
              <div
                key={`${edge.edgeId}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 px-2 py-1"
              >
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                  {edge.edgeId}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Zap size={10} className="text-fuchsia-500" />
                  <span className="text-xs font-bold text-fuchsia-700 dark:text-fuchsia-300">
                    {edge.suggestedConductorId}
                  </span>
                  <span className="text-xs text-slate-400">
                    {edge.lengthM.toFixed(0)} m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pathEdges.length === 0 && (
        <p className="text-xs text-rose-500 dark:text-rose-400">
          Orçamento de tensão esgotado — necessária troca de transformador.
        </p>
      )}
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function BtTelescopicSuggestionModal({
  output,
  onApply,
  onCancel,
}: BtTelescopicSuggestionModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!output) return;
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [output, onCancel]);

  const allApproved = output?.suggestions.every((s) => s.projectedVoltageEndV >= 117) ?? true;
  const hasUpgradeNeeded = output?.suggestions.some((s) => s.requiresTransformerUpgrade) ?? false;

  return (
    <AnimatePresence>
      {output && (
        <div className="fixed inset-0 z-[990] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Painel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bt-telescopic-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg rounded-2xl border border-fuchsia-500/20 bg-white dark:bg-slate-900 p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh]"
          >
            {/* Título */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-fuchsia-500/10 p-2.5">
                <Zap size={20} className="text-fuchsia-500" />
              </div>
              <div>
                <h2
                  id="bt-telescopic-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Análise Telescópica — REDE NOVA
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {output.suggestions.length === 0
                    ? "Todos os terminais aprovados (≥ 117 V)."
                    : `${output.suggestions.length} terminal(is) com queda excessiva detectado(s).`}
                </p>
              </div>
            </div>

            {/* Aviso global de troca de trafo */}
            {hasUpgradeNeeded && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 px-3 py-2">
                <AlertTriangle size={16} className="shrink-0 text-rose-500" />
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  Um ou mais transformadores estão sobrecarregados. Avalie substituição.
                </span>
              </div>
            )}

            {/* Lista de sugestões */}
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {output.suggestions.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-3">
                  <CheckCircle size={16} className="text-emerald-500" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                    Nenhum terminal reprovado. Nenhuma substituição necessária.
                  </span>
                </div>
              ) : (
                output.suggestions.map((s) => (
                  <TerminalCard key={s.terminalNodeId} suggestion={s} />
                ))
              )}
            </div>

            {/* Resumo Lmax */}
            {Object.keys(output.lmaxByConductor).length > 0 && (
              <details className="rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <summary className="cursor-pointer px-3 py-2 font-bold text-slate-600 dark:text-slate-400 select-none">
                  Comprimento máximo por condutor (Lmax)
                </summary>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 px-3 pb-3 pt-1 max-h-40 overflow-y-auto">
                  {Object.entries(output.lmaxByConductor)
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, lmax]) => (
                      <div key={id} className="flex justify-between gap-1">
                        <span className="text-slate-600 dark:text-slate-400 truncate font-mono">{id}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">{lmax} m</span>
                      </div>
                    ))}
                </div>
              </details>
            )}

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-700 py-2.5 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => onApply(output)}
                className={`flex-1 rounded-xl border-2 py-2.5 text-xs font-black uppercase tracking-wide text-white transition-colors ${
                  allApproved
                    ? "border-fuchsia-600 bg-fuchsia-600 hover:bg-fuchsia-500"
                    : "border-amber-600 bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {output.suggestions.length === 0 ? "Aplicar ao Projeto" : "Aplicar Sugestões"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
