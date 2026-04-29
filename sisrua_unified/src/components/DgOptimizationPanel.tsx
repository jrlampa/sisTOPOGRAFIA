/**
 * DgOptimizationPanel – Painel de Design Generativo (Frente 3).
 *
 * Permite executar otimização DG da rede BT, visualizar o score e
 * os resultados elétricos, e aplicar a sugestão total ou parcial.
 *
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – Frente 3
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Zap, CheckCircle, XCircle, Info, Eye, EyeOff } from "lucide-react";
import type {
  DgOptimizationOutput,
  DgScenario,
  DgConstraintCode,
} from "../hooks/useDgOptimization";
import { DgWizardModal, DgWizardParams } from "./DgWizardModal";
import type { BtPoleNode, BtTransformer } from "../types";
import { motion, AnimatePresence } from "framer-motion";

const DG_WIZARD_FULL_MODE_ENABLED =
  String(import.meta.env.VITE_DG_WIZARD_FULL_MODE ?? "true") !== "false";

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
  const widthStep = Math.round(pct / 5);
  const widthClassByStep = [
    "w-[0%]",
    "w-[5%]",
    "w-[10%]",
    "w-[15%]",
    "w-[20%]",
    "w-[25%]",
    "w-[30%]",
    "w-[35%]",
    "w-[40%]",
    "w-[45%]",
    "w-[50%]",
    "w-[55%]",
    "w-[60%]",
    "w-[65%]",
    "w-[70%]",
    "w-[75%]",
    "w-[80%]",
    "w-[85%]",
    "w-[90%]",
    "w-[95%]",
    "w-[100%]",
  ] as const;
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full rounded-full bg-zinc-200 dark:bg-zinc-700 h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${color} ${widthClassByStep[widthStep]}`}
      />
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
    <div className="flex justify-between text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={
          warn
            ? "font-bold text-red-600 dark:text-red-400"
            : "font-semibold text-zinc-800 dark:text-zinc-200"
        }
      >
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
      <div className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
        Motivos de descarte
      </div>
      {entries.map(([code, count]) => (
        <div key={code} className="flex justify-between text-xs">
          <span className="text-zinc-600 dark:text-zinc-400">
            {CONSTRAINT_LABELS[code]}
          </span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            {count}×
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface DgOptimizationPanelProps {
  hasPoles: boolean;
  poles: BtPoleNode[];
  currentTransformer?: BtTransformer;
  currentTotalCableLengthMeters?: number;
  hasTransformer: boolean;
  hasProjectedPoles?: boolean;
  isOptimizing: boolean;
  result: DgOptimizationOutput | null;
  error: string | null;
  /** Índice da alternativa ativa: −1 = melhor, 0..N = alternatives[N]. */
  activeAltIndex: number;
  onSetActiveAltIndex: (index: number) => void;
  onRun: (wizardParams?: DgWizardParams) => void;
  onAcceptAll: (scenario: DgScenario) => void;
  onAcceptTrafoOnly: (scenario: DgScenario) => void;
  onDiscard: () => void;
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function DgOptimizationPanel({
  hasPoles,
  poles,
  currentTransformer,
  currentTotalCableLengthMeters,
  hasTransformer,
  hasProjectedPoles = false,
  isOptimizing,
  result,
  error,
  activeAltIndex,
  onSetActiveAltIndex,
  onRun,
  onAcceptAll,
  onAcceptTrafoOnly,
  onDiscard,
}: DgOptimizationPanelProps) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [acceptanceConfirmed, setAcceptanceConfirmed] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(true); // Default to true for UX-07

  const canRunFull = hasPoles && !isOptimizing;

  const rec = result?.recommendation ?? null;
  // Cenário exibido: melhor ou alternativa selecionada
  const active: DgScenario | null =
    rec == null
      ? null
      : activeAltIndex === -1
        ? rec.bestScenario
        : (rec.alternatives[activeAltIndex] ?? null);

  useEffect(() => {
    setAcceptanceConfirmed(false);
    if (active) setIsPreviewActive(true);
  }, [active?.scenarioId]);

  const cableDeltaMeters = useMemo(() => {
    if (!active || currentTotalCableLengthMeters == null) return null;
    return (
      active.electricalResult.totalCableLengthMeters -
      currentTotalCableLengthMeters
    );
  }, [active, currentTotalCableLengthMeters]);

  const trafoShiftMeters = useMemo(() => {
    if (!active || !currentTransformer) return null;
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const lat1 = toRad(currentTransformer.lat);
    const lat2 = toRad(active.trafoPositionLatLon.lat);
    const dLat = toRad(active.trafoPositionLatLon.lat - currentTransformer.lat);
    const dLon = toRad(active.trafoPositionLatLon.lon - currentTransformer.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, [active, currentTransformer]);

  const handleMainAction = () => {
    // Se não tem trafo OU tem postes projetados, abre wizard
    if (DG_WIZARD_FULL_MODE_ENABLED && (!hasTransformer || hasProjectedPoles)) {
      setIsWizardOpen(true);
    } else {
      onRun();
    }
  };

  const handleExecuteWizard = (params: DgWizardParams) => {
    setIsWizardOpen(false);
    onRun(params);
  };

  return (
    <div className="rounded-xl border-2 border-violet-700/30 bg-violet-50 p-3 space-y-3 dark:border-violet-500/35 dark:bg-violet-950/20">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-violet-700 dark:text-violet-300" />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-violet-800 dark:text-violet-200">
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

      {/* Pré-requisito: sem poste */}
      {!hasPoles && (
        <p className="text-xs text-violet-700 dark:text-violet-300">
          Adicione ao menos 1 poste para otimizar.
        </p>
      )}

      {/* Botão executar */}
      {!result && (
        <button
          onClick={handleMainAction}
          disabled={!canRunFull}
          className="w-full rounded-xl border-2 border-violet-700/40 bg-violet-700 py-2 text-xs font-black text-white transition-all hover:bg-violet-800 disabled:opacity-40 dark:border-violet-400/40 dark:bg-violet-700 dark:hover:bg-violet-600"
        >
          {isOptimizing ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              Otimizando…
            </span>
          ) : DG_WIZARD_FULL_MODE_ENABLED &&
            (hasProjectedPoles || !hasTransformer) ? (
            "PROJETAR REDE (WIZARD)"
          ) : (
            "OTIMIZAR REDE"
          )}
        </button>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:border-red-700/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Resultado: sem solução viável */}
      {result && !rec && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <Info size={11} />
            Nenhuma solução viável encontrada.
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Candidatos avaliados: {result.totalCandidatesEvaluated} · Viáveis:{" "}
            {result.totalFeasible}
          </div>
        </div>
      )}

      {/* Resultado: cenário ativo */}
      {active && (
        <div className="space-y-3">
          {/* Preview Toggle (UX-07) */}
          <button
            onClick={() => setIsPreviewActive(!isPreviewActive)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 py-2 text-xs font-black uppercase tracking-widest transition-all ${
              isPreviewActive 
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
                : "border-slate-300 text-slate-500"
            }`}
          >
            {isPreviewActive ? <Eye size={12} /> : <EyeOff size={12} />}
            {isPreviewActive ? "Modo Preview Ativo" : "Ativar Preview no Mapa"}
          </button>

          {/* Navegação entre cenários (melhor + alternativas) */}
          {rec && rec.alternatives.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onSetActiveAltIndex(-1)}
                className={`rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                  activeAltIndex === -1
                    ? "bg-violet-700 text-white"
                    : "border border-violet-400/60 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                }`}
              >
                Melhor
              </button>
              {rec.alternatives.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onSetActiveAltIndex(i)}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                    activeAltIndex === i
                      ? "bg-violet-700 text-white"
                      : "border border-violet-400/60 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                  }`}
                >
                  Alt. {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Score */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Score DG</span>
              <span className="font-black text-violet-700 dark:text-violet-300">
                {active.objectiveScore.toFixed(1)} / 100
              </span>
            </div>
            <ScoreBar score={active.objectiveScore} />
          </div>

          {/* Resultados elétricos */}
          <div className="space-y-1">
            {active.metadata?.selectedKva && (
              <ElectricalResultRow
                label="Trafo Dimensionado"
                value={`${active.metadata.selectedKva} kVA`}
              />
            )}
            <ElectricalResultRow
              label="CQT máx."
              value={`${(active.electricalResult.cqtMaxFraction * 100).toFixed(1)}%`}
              warn={active.electricalResult.cqtMaxFraction > 0.08}
            />
            <ElectricalResultRow
              label="Utilização trafo"
              value={`${(active.electricalResult.trafoUtilizationFraction * 100).toFixed(1)}%`}
              warn={active.electricalResult.trafoUtilizationFraction > 0.95}
            />
            <ElectricalResultRow
              label="Cabo total"
              value={`${active.electricalResult.totalCableLengthMeters.toFixed(0)} m`}
            />
          </div>

          {/* Meta: candidatos / descartados */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {result?.totalCandidatesEvaluated ?? 0} candidatos ·{" "}
            {rec?.discardedCount ?? 0} descartados
          </div>

          {rec && <DiscardReasonList summary={rec.discardReasonSummary} />}

          {(currentTransformer || currentTotalCableLengthMeters != null) && (
            <div className="space-y-1 rounded-lg border border-violet-300/40 bg-white/70 p-2 dark:border-violet-600/40 dark:bg-zinc-900/30">
              <div className="text-xs uppercase font-bold tracking-wider text-violet-700 dark:text-violet-300">
                Comparativo Atual x Sugerido
              </div>
              {currentTransformer && (
                <ElectricalResultRow
                  label="Realocação do trafo"
                  value={
                    trafoShiftMeters == null
                      ? "-"
                      : `${trafoShiftMeters.toFixed(1)} m`
                  }
                />
              )}
              {currentTotalCableLengthMeters != null && (
                <ElectricalResultRow
                  label="Cabo total (delta)"
                  value={
                    cableDeltaMeters == null
                      ? "-"
                      : `${cableDeltaMeters > 0 ? "+" : ""}${cableDeltaMeters.toFixed(1)} m`
                  }
                  warn={cableDeltaMeters != null && cableDeltaMeters > 0}
                />
              )}
            </div>
          )}

          <label className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-xs transition-all cursor-pointer ${
            acceptanceConfirmed 
              ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300" 
              : "border-zinc-200 bg-white/80 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
          }`}>
            <input
              type="checkbox"
              checked={acceptanceConfirmed}
              onChange={(e) => setAcceptanceConfirmed(e.target.checked)}
              aria-label="Confirmo aplicação consciente do cenário"
              className="accent-emerald-600"
            />
            <span className="font-bold">Confirmo aplicação consciente após revisar o comparativo.</span>
          </label>

          {/* Botões de aceitação */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onAcceptTrafoOnly(active)}
              disabled={!acceptanceConfirmed || !isPreviewActive}
              className="rounded-xl border-2 border-violet-700/40 py-2 text-xs font-black text-violet-800 transition-all hover:bg-violet-100 disabled:opacity-40 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-900/30"
            >
              {hasTransformer ? "SÓ REALOCAR" : "SÓ NOVO TRAFO"}
            </button>
            <button
              onClick={() => onAcceptAll(active)}
              disabled={!acceptanceConfirmed || !isPreviewActive}
              className="relative overflow-hidden rounded-xl border-2 border-violet-700/40 bg-violet-700 py-2 text-xs font-black text-white transition-all hover:bg-violet-800 disabled:opacity-40 dark:border-violet-400/40 dark:bg-violet-700 dark:hover:bg-violet-600"
            >
              <span className="flex items-center justify-center gap-1">
                <CheckCircle size={10} />
                ACEITAR TUDO
              </span>
            </button>
          </div>
          
          {!isPreviewActive && (
            <p className="text-center text-xs font-bold text-amber-600 animate-pulse">
              Ative o Modo Preview para habilitar a aplicação.
            </p>
          )}
        </div>
      )}

      <DgWizardModal
        isOpen={isWizardOpen}
        poles={poles}
        onClose={() => setIsWizardOpen(false)}
        onExecute={handleExecuteWizard}
      />
    </div>
  );
}
