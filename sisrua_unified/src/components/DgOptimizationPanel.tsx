/**
 * DgOptimizationPanel – Painel de Design Generativo (Frente 3).
 *
 * Permite executar otimização DG da rede BT, visualizar o score e
 * os resultados elétricos, e aplicar a sugestão total ou parcial.
 *
 * Referência: docs/DG_IMPLEMENTATION_ADDENDUM_2026.md – Frente 3
 */

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Zap, CheckCircle, XCircle, Info, Eye, EyeOff, RotateCcw } from "lucide-react";
import type {
  DgOptimizationOutput,
  DgScenario,
  DgConstraintCode,
} from "../hooks/useDgOptimization";
import { DgWizardModal, DgWizardParams } from "./DgWizardModal";
import { BtPoleNode, BtTransformer, AppLocale } from "../types";
import { Skeleton } from "./Skeleton";



const DG_WIZARD_FULL_MODE_ENABLED =
  String(import.meta.env.VITE_DG_WIZARD_FULL_MODE ?? "true") !== "false";

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
  onRemediate,
}: {
  summary: Partial<Record<DgConstraintCode, number>>;
  onRemediate?: (code: DgConstraintCode) => void;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(summary) as [DgConstraintCode, number][];
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5 rounded-lg bg-amber-50/50 p-2 border border-amber-200/40 dark:bg-amber-950/10 dark:border-amber-900/20">
      <div className="text-[10px] uppercase font-black tracking-widest text-amber-700 dark:text-amber-400">
        Motivos de descarte & Soluções
      </div>
      {entries.map(([code, count]) => (
        <div key={code} className="space-y-1">
          <div className="flex justify-between text-xs items-start">
            <div className="flex flex-col flex-1">
              <span className="font-bold text-amber-900 dark:text-amber-200 leading-tight">
                {t(`dgConstraints.${code}`, code)}
              </span>
              <p className="text-[10px] leading-tight text-amber-800/80 dark:text-amber-300/60 italic mt-0.5">
                {t(`dgTips.${code}`, "")}
              </p>
            </div>
            <span className="font-black text-amber-700 dark:text-amber-400 ml-2">
              {count}×
            </span>
          </div>
          
          {code === "CQT_LIMIT_EXCEEDED" && onRemediate && (
            <button
              onClick={() => onRemediate(code)}
              className="w-full mt-1.5 py-1 px-2 bg-amber-200 text-amber-900 text-[9px] font-black uppercase tracking-widest rounded-md hover:bg-amber-300 transition-all border border-amber-400/30 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Zap size={10} className="fill-current" />
              Remediar: Upgrade Telescópico
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function DgOptimizationSkeleton({ stage }: { stage: string }) {
  const [logIdx, setLogIdx] = useState(0);
  const logs = useMemo(() => [
    "Analisando combinações de vãos...",
    "Validando restrições técnicas...",
    "Otimizando queda de tensão...",
    "Processando 1.200 cenários...",
    "Calculando score de engenharia...",
  ], []);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLogIdx((prev) => (prev + 1) % logs.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [logs.length]);

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Skeleton className="h-9 w-full rounded-lg bg-violet-200 dark:bg-violet-900/30" />
        <div className="flex flex-col items-center justify-center gap-1 py-1">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-violet-600" />
            <span className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">
              {stage}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 italic animate-pulse">
            {logs[logIdx]}
          </span>
        </div>
      </div>
      
      <div className="space-y-3 px-1 opacity-60">
        <div className="space-y-1">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Skeleton className="h-9 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}

function DgScenarioMatrix({
  best,
  alternatives,
  selectedIndex,
  onSelect,
  onHover,
  locale: _locale,
}: {
  best: DgScenario;
  alternatives: DgScenario[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
  locale: AppLocale;
}) {
  const { t } = useTranslation();
  const all = [best, ...alternatives];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/50">
      <table className="w-full text-left text-[10px] border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
            <th className="px-2 py-1.5 font-black uppercase tracking-tighter text-slate-400">
              {t("dgPanel.matrix.scenario")}
            </th>
            <th className="px-2 py-1.5 font-black uppercase tracking-tighter text-slate-400 text-right">
              {t("dgPanel.matrix.cableTotal")}
            </th>
            <th className="px-2 py-1.5 font-black uppercase tracking-tighter text-slate-400 text-right">
              {t("dgPanel.matrix.cqtMax")}
            </th>
            <th className="px-2 py-1.5 font-black uppercase tracking-tighter text-slate-400 text-right">
              {t("dgPanel.matrix.score")}
            </th>
          </tr>
        </thead>
        <tbody onMouseLeave={() => onHover(null)}>
          {all.map((s, i) => {
            const idx = i - 1; // -1 para best, 0..N para alts
            const isSelected = selectedIndex === idx;
            return (
              <tr
                key={s.scenarioId}
                onClick={() => onSelect(idx)}
                onMouseEnter={() => onHover(idx)}
                className={`cursor-pointer transition-colors border-b border-slate-50 dark:border-white/5 last:border-0 ${
                  isSelected
                    ? "bg-violet-50 text-violet-900 dark:bg-violet-900/20 dark:text-violet-200"
                    : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
                }`}
              >
                <td className="px-2 py-1.5 font-bold">
                  {idx === -1 ? t("dgPanel.best") : `${t("dgPanel.alt", { index: idx + 1 })}`}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {s.electricalResult.totalCableLengthMeters.toFixed(0)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-bold">
                  {(s.electricalResult.cqtMaxFraction * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-black text-violet-600 dark:text-violet-400">
                  {s.objectiveScore.toFixed(0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  isPreviewActive: boolean;
  onSetIsPreviewActive: (active: boolean) => void;
  onRun: (wizardParams?: DgWizardParams) => void;
  onAcceptAll: (scenario: DgScenario) => void;
  onAcceptTrafoOnly: (scenario: DgScenario) => void;
  onDiscard: () => void;
  onRemediateCqt?: () => void;
  locale: AppLocale;
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
  isPreviewActive,
  onSetIsPreviewActive,
  onRun,
  onAcceptAll,
  onAcceptTrafoOnly,
  onDiscard,
  onRemediateCqt,
  locale,
}: DgOptimizationPanelProps) {
  const { t } = useTranslation();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [acceptanceConfirmed, setAcceptanceConfirmed] = useState(false);
  const [progressStage, setProgressStage] = useState(0);

  // UX-04: Persistência do índice clicado para o Quick Preview (Hover)
  const [actualSelectedIndex, setActualSelectedIndex] = useState(activeAltIndex);

  // Sincroniza estado local se o prop mudar externamente (ex: undo/redo)
  useEffect(() => {
    setActualSelectedIndex(activeAltIndex);
  }, [activeAltIndex]);

  const PROGRESS_STAGES = [
    t("dgPanel.progressStages.generating"),
    t("dgPanel.progressStages.calculating"),
    t("dgPanel.progressStages.evaluating"),
    t("dgPanel.progressStages.optimizing"),
    t("dgPanel.progressStages.finishing"),
  ];

  useEffect(() => {
    if (isOptimizing) {
      const interval = setInterval(() => {
        setProgressStage((prev) => (prev + 1) % PROGRESS_STAGES.length);
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setProgressStage(0);
    }
  }, [isOptimizing, PROGRESS_STAGES.length]);

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
    if (active) onSetIsPreviewActive(true);
  }, [active?.scenarioId, active, onSetIsPreviewActive]);

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

  if (isOptimizing) {
    return (
      <div className="rounded-xl border-2 border-violet-700/30 bg-violet-50 p-3 dark:border-violet-500/35 dark:bg-violet-950/20">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap size={12} className="text-violet-700 dark:text-violet-300" />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-violet-800 dark:text-violet-200">
            {t("dgPanel.title")}
          </span>
        </div>
        <DgOptimizationSkeleton stage={PROGRESS_STAGES[progressStage]} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-violet-700/30 bg-violet-50 p-3 space-y-3 dark:border-violet-500/35 dark:bg-violet-950/20">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-violet-700 dark:text-violet-300" />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-violet-800 dark:text-violet-200">
            {t("dgPanel.title")}
          </span>
        </div>
        {result && (
          <button
            onClick={onDiscard}
            title="Descartar e Fechar"
            aria-label={t("common.close")}
            className="rounded p-1 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
          >
            <XCircle size={14} />
          </button>
        )}
      </div>

      {/* Pré-requisito: sem poste */}
      {!hasPoles && (
        <p className="text-xs text-violet-700 dark:text-violet-300">
          {t("dgPanel.addPolesNote")}
        </p>
      )}

      {/* Botão executar */}
      {!result && (
        <button
          onClick={handleMainAction}
          disabled={!canRunFull}
          className="w-full rounded-xl border-2 border-violet-700/40 bg-violet-700 py-2 text-xs font-black text-white transition-all hover:bg-violet-800 disabled:opacity-40 dark:border-violet-400/40 dark:bg-violet-700 dark:hover:bg-violet-600 min-h-[44px]"
        >
          {DG_WIZARD_FULL_MODE_ENABLED &&
            (hasProjectedPoles || !hasTransformer) ? (
            t("dgPanel.btnProjectWizard")
          ) : (
            t("dgPanel.btnOptimizeNetwork")
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
            {t("dgPanel.noSolution")}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("dgPanel.candidatesEvaluated", { count: result.totalCandidatesEvaluated })} · {t("dgPanel.feasible")}:{" "}
            {result.totalFeasible}
          </div>
          <div className="pt-2">
             <button
              onClick={() => onRun()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all rounded-xl shadow-sm"
            >
              <RotateCcw size={14} />
              Reanalisar
            </button>
          </div>
        </div>
      )}

      {/* Resultado: cenário ativo */}
      {active && (
        <div className="space-y-3">
          {/* Preview Toggle (UX-07) */}
          <button
            onClick={() => onSetIsPreviewActive(!isPreviewActive)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 py-2 text-xs font-black uppercase tracking-widest transition-all ${
              isPreviewActive 
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
                : "border-slate-300 text-slate-500"
            }`}
          >
            {isPreviewActive ? <Eye size={12} /> : <EyeOff size={12} />}
            {isPreviewActive ? t("dgPanel.previewActive") : t("dgPanel.previewInactive")}
          </button>

          {/* Matriz de Decisão (UX: Comparativo Multi-Cenário) */}
          {rec && (
            <DgScenarioMatrix 
              best={rec.bestScenario}
              alternatives={rec.alternatives}
              selectedIndex={actualSelectedIndex}
              locale={locale}
              onSelect={(idx) => {
                setActualSelectedIndex(idx);
                onSetActiveAltIndex(idx);
              }}
              onHover={(idx) => {
                // Quick Preview: muda no mapa ao passar o mouse, mas volta ao selecionado no leave
                onSetActiveAltIndex(idx !== null ? idx : actualSelectedIndex);
              }}
            />
          )}

          {/* Score */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">{t("dgPanel.score")}</span>
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
                label={t("dgPanel.trafoSized")}
                value={`${active.metadata.selectedKva} kVA`}
              />
            )}
            <ElectricalResultRow
              label={t("dgPanel.cqtMax")}
              value={`${(active.electricalResult.cqtMaxFraction * 100).toFixed(1)}%`}
              warn={active.electricalResult.cqtMaxFraction > 0.08}
            />
            <ElectricalResultRow
              label={t("dgPanel.trafoUtilization")}
              value={`${(active.electricalResult.trafoUtilizationFraction * 100).toFixed(1)}%`}
              warn={active.electricalResult.trafoUtilizationFraction > 0.95}
            />
            <ElectricalResultRow
              label={t("dgPanel.cableTotal")}
              value={`${active.electricalResult.totalCableLengthMeters.toFixed(0)} m`}
            />
          </div>

          {/* Meta: candidatos / descartados */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("dgPanel.candidatesEvaluated", { count: result?.totalCandidatesEvaluated ?? 0 })} ·{" "}
            {t("dgPanel.discarded", { count: rec?.discardedCount ?? 0 })}
          </div>

          {rec && (
            <DiscardReasonList 
              summary={rec.discardReasonSummary} 
              onRemediate={(code) => {
                if (code === "CQT_LIMIT_EXCEEDED") onRemediateCqt?.();
              }}
            />
          )}

          {(currentTransformer || currentTotalCableLengthMeters != null) && (
            <div className="space-y-1 rounded-lg border border-violet-300/40 bg-white/70 p-2 dark:border-violet-600/40 dark:bg-zinc-900/30">
              <div className="text-xs uppercase font-bold tracking-wider text-violet-700 dark:text-violet-300">
                {t("dgPanel.comparisonTitle")}
              </div>
              {currentTransformer && (
                <ElectricalResultRow
                  label={t("dgPanel.trafoShift")}
                  value={
                    trafoShiftMeters == null
                      ? "-"
                      : `${trafoShiftMeters.toFixed(1)} m`
                  }
                />
              )}
              {currentTotalCableLengthMeters != null && (
                <ElectricalResultRow
                  label={t("dgPanel.cableDelta")}
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
              aria-label={t("dgPanel.confirmApplication")}
              className="accent-emerald-600"
            />
            <span className="font-bold">{t("dgPanel.confirmApplication")}</span>
          </label>

          {/* Botões de aceitação */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onAcceptTrafoOnly(active)}
              disabled={!acceptanceConfirmed || !isPreviewActive}
              className="rounded-xl border-2 border-violet-700/40 py-2 text-xs font-black text-violet-800 transition-all hover:bg-violet-100 disabled:opacity-40 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-900/30"
            >
              {hasTransformer ? t("dgPanel.btnRelocateOnly") : t("dgPanel.btnNewTrafoOnly")}
            </button>
            <button
              onClick={() => onAcceptAll(active)}
              disabled={!acceptanceConfirmed || !isPreviewActive}
              className="relative overflow-hidden rounded-xl border-2 border-violet-700/40 bg-violet-700 py-2 text-xs font-black text-white transition-all hover:bg-violet-800 disabled:opacity-40 dark:border-violet-400/40 dark:bg-violet-700 dark:hover:bg-violet-600"
            >
              <span className="flex items-center justify-center gap-1">
                <CheckCircle size={10} />
                {t("dgPanel.btnAcceptAll")}
              </span>
            </button>
          </div>
          
          {!isPreviewActive && (
            <p className="text-center text-xs font-bold text-amber-600 animate-pulse">
              {t("dgPanel.activatePreviewNote")}
            </p>
          )}

          {/* Ações Adicionais (UX: Reanalisar) */}
          <div className="pt-2 border-t border-violet-100 dark:border-violet-900/30">
            <button
              onClick={() => onRun()}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all rounded-lg"
            >
              <RotateCcw size={12} />
              Reanalisar (Gerar Novo Cenário)
            </button>
          </div>
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
