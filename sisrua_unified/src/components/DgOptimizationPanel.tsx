/**
 * DgOptimizationPanel – Painel de Design Generativo (Frente 3).
 *
 * Permite executar otimização DG da rede BT, visualizar o score e
 * os resultados elétricos, e aplicar a sugestão total ou parcial.
 *
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – Frente 3
 */

import React from "react";
import { Loader2, Zap, CheckCircle, XCircle, Info } from "lucide-react";
import type {
  DgOptimizationOutput,
  DgScenario,
  DgConstraintCode,
} from "../hooks/useDgOptimization";

// ─── Labels em pt-BR ───────────────────────────────────────────────────────────

const CONSTRAINT_LABELS: Record<DgConstraintCode, string> = {
  MAX_SPAN_EXCEEDED: "Vão máximo excedido",
  INSIDE_EXCLUSION_ZONE: "Dentro de zona de exclusão",
  OUTSIDE_ROAD_CORRIDOR: "Fora do corredor viário",
  CQT_LIMIT_EXCEEDED: "Limite CQT excedido",
  TRAFO_OVERLOAD: "Sobrecarga do trafo",
  NON_RADIAL_TOPOLOGY: "Topologia não radial",
};

// ─── Subcomponentes internos ───────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full rounded-full bg-zinc-200 dark:bg-zinc-700 h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ElectricalResultRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={warn ? "font-bold text-red-600 dark:text-red-400" : "font-semibold text-zinc-800 dark:text-zinc-200"}>
        {value}
      </span>
    </div>
  );
}

function DiscardReasonList({
  summary,
}: {
  summary: Partial<Record<DgConstraintCode, number>>;
}) {
  const entries = Object.entries(summary) as [DgConstraintCode, number][];
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 space-y-0.5">
      <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
        Motivos de descarte
      </div>
      {entries.map(([code, count]) => (
        <div key={code} className="flex justify-between text-[10px]">
          <span className="text-zinc-600 dark:text-zinc-400">{CONSTRAINT_LABELS[code]}</span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{count}×</span>
        </div>
      ))}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface DgOptimizationPanelProps {
  hasPoles: boolean;
  hasTransformer: boolean;
  isOptimizing: boolean;
  result: DgOptimizationOutput | null;
  error: string | null;
  onRun: () => void;
  onAcceptAll: (scenario: DgScenario) => void;
  onAcceptTrafoOnly: (scenario: DgScenario) => void;
  onDiscard: () => void;
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function DgOptimizationPanel({
  hasPoles,
  hasTransformer,
  isOptimizing,
  result,
  error,
  onRun,
  onAcceptAll,
  onAcceptTrafoOnly,
  onDiscard,
}: DgOptimizationPanelProps) {
  const canRun = hasPoles && hasTransformer && !isOptimizing;
  const rec = result?.recommendation ?? null;
  const best: DgScenario | null = rec?.bestScenario ?? null;

  return (
    <div className="rounded-xl border-2 border-violet-700/30 bg-violet-50 p-3 space-y-3 dark:border-violet-500/35 dark:bg-violet-950/20">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-violet-700 dark:text-violet-300" />
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-800 dark:text-violet-200">
            Design Generativo
          </span>
        </div>
        {result && (
          <button
            onClick={onDiscard}
            aria-label="Descartar resultado DG"
            className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <XCircle size={13} />
          </button>
        )}
      </div>

      {/* Pré-requisito: sem poste ou sem trafo */}
      {(!hasPoles || !hasTransformer) && (
        <p className="text-[10px] text-violet-700 dark:text-violet-300">
          {!hasPoles
            ? "Adicione ao menos 1 poste para otimizar."
            : "Adicione 1 transformador para otimizar."}
        </p>
      )}

      {/* Botão executar */}
      {!result && (
        <button
          onClick={onRun}
          disabled={!canRun}
          className="w-full rounded-xl border-2 border-violet-700/40 bg-violet-700 py-2 text-[10px] font-black text-white transition-all hover:bg-violet-800 disabled:opacity-40 dark:border-violet-400/40 dark:bg-violet-700 dark:hover:bg-violet-600"
        >
          {isOptimizing ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              Otimizando…
            </span>
          ) : (
            "OTIMIZAR REDE"
          )}
        </button>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-[10px] text-red-700 dark:bg-red-950/30 dark:border-red-700/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Resultado: sem solução viável */}
      {result && !best && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-400">
            <Info size={11} />
            Nenhuma solução viável encontrada.
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Candidatos avaliados: {result.totalCandidatesEvaluated} · Viáveis: {result.totalFeasible}
          </div>
          {rec && <DiscardReasonList summary={rec.discardReasonSummary} />}
        </div>
      )}

      {/* Resultado: melhor cenário */}
      {best && (
        <div className="space-y-3">
          {/* Score */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500 dark:text-zinc-400">Score DG</span>
              <span className="font-black text-violet-700 dark:text-violet-300">
                {best.objectiveScore.toFixed(1)} / 100
              </span>
            </div>
            <ScoreBar score={best.objectiveScore} />
          </div>

          {/* Resultados elétricos */}
          <div className="space-y-1">
            <ElectricalResultRow
              label="CQT máx."
              value={`${(best.electricalResult.cqtMaxFraction * 100).toFixed(1)}%`}
              warn={best.electricalResult.cqtMaxFraction > 0.08}
            />
            <ElectricalResultRow
              label="Utilização trafo"
              value={`${(best.electricalResult.trafoUtilizationFraction * 100).toFixed(1)}%`}
              warn={best.electricalResult.trafoUtilizationFraction > 0.95}
            />
            <ElectricalResultRow
              label="Cabo total"
              value={`${best.electricalResult.totalCableLengthMeters.toFixed(0)} m`}
            />
          </div>

          {/* Meta: candidatos / descartados */}
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {result.totalCandidatesEvaluated} candidatos · {rec?.discardedCount ?? 0} descartados
          </div>

          {rec && <DiscardReasonList summary={rec.discardReasonSummary} />}

          {/* Botões de aceitação */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onAcceptTrafoOnly(best)}
              className="rounded-xl border-2 border-violet-700/40 py-2 text-[10px] font-black text-violet-800 transition-all hover:bg-violet-100 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-900/30"
            >
              SÓ TRAFO
            </button>
            <button
              onClick={() => onAcceptAll(best)}
              className="rounded-xl border-2 border-violet-700/40 bg-violet-700 py-2 text-[10px] font-black text-white transition-all hover:bg-violet-800 dark:bg-violet-700 dark:hover:bg-violet-600"
            >
              <span className="flex items-center justify-center gap-1">
                <CheckCircle size={10} />
                ACEITAR TUDO
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
