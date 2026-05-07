import React, { Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  LineChart,
  Network,
  ChevronRight,
  ChevronLeft,
  Zap,
} from "lucide-react";
import type { AppLocale } from "../types";
import { getSidebarWorkspaceText } from "../i18n/sidebarWorkspaceText";
import { trackWorkflowStage } from "../utils/analytics";

// ─── Lazy imports (Audit P1: Internal Routing Optimization) ──────────────

const SidebarAnalysisResults = lazy(() =>
  import("./SidebarAnalysisResults").then((m) => ({
    default: m.SidebarAnalysisResults,
  })),
);
const SidebarBtEditorSection = lazy(() =>
  import("./SidebarBtEditorSection").then((m) => ({
    default: m.SidebarBtEditorSection,
  })),
);
const SidebarMtEditorSection = lazy(() =>
  import("./SidebarMtEditorSection").then((m) => ({
    default: m.SidebarMtEditorSection,
  })),
);
const SidebarSelectionControls = lazy(() =>
  import("./SidebarSelectionControls").then((m) => ({
    default: m.SidebarSelectionControls,
  })),
);

type SidebarWorkspaceProps = {
  locale: AppLocale;
  isCollapsed: boolean;
  onToggleCollapse: (collapsed: boolean) => void;
  isSidebarDockedForRamalModal: boolean;
  selectionControlsProps: any;
  btEditorSectionProps: any;
  mtEditorSectionProps: any;
  analysisResultsProps: any;
};

export function SidebarWorkspace({
  locale,
  isCollapsed,
  onToggleCollapse,
  isSidebarDockedForRamalModal,
  selectionControlsProps,
  btEditorSectionProps,
  mtEditorSectionProps,
  analysisResultsProps,
}: SidebarWorkspaceProps) {
  const [activeStage, setActiveStage] = React.useState<number>(1);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const stageEntryTimeRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    if (activeStage > 1) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1500);

      const now = Date.now();
      const durationMs = now - stageEntryTimeRef.current;
      trackWorkflowStage(activeStage - 1, activeStage, durationMs);
      stageEntryTimeRef.current = now;

      return () => clearTimeout(timer);
    }
  }, [activeStage]);

  const t = getSidebarWorkspaceText(locale);

  const STAGE_ACCENT = [
    "bg-sky-500 shadow-sky-500/25",
    "bg-indigo-600 shadow-indigo-600/25",
    "bg-violet-600 shadow-violet-600/25",
    "bg-emerald-500 shadow-emerald-500/25",
  ] as const;

  const STAGES = [
    {
      id: 1,
      label: t.stage1Label,
      helper: t.stage1Helper,
      icon: Compass,
      accent: STAGE_ACCENT[0],
      component: <SidebarSelectionControls {...selectionControlsProps} />,
    },
    {
      id: 2,
      label: t.stage2Label,
      helper: t.stage2Helper,
      icon: Network,
      accent: STAGE_ACCENT[1],
      component: <SidebarBtEditorSection {...btEditorSectionProps} />,
    },
    {
      id: 3,
      label: t.stage3Label,
      helper: t.stage3Helper,
      icon: Zap,
      accent: STAGE_ACCENT[2],
      component: <SidebarMtEditorSection {...mtEditorSectionProps} />,
    },
    {
      id: 4,
      label: t.stage4Label,
      helper: t.stage4Helper,
      icon: LineChart,
      accent: STAGE_ACCENT[3],
      component: <SidebarAnalysisResults {...analysisResultsProps} />,
    },
  ];

  const currentStage = STAGES.find((s) => s.id === activeStage);
  const nextStage = STAGES.find((s) => s.id === activeStage + 1);

  // Workflow logic
  const hasArea = !!selectionControlsProps.center;
  const hasBtPoles = btEditorSectionProps.btTopology.poles.length > 0;
  const hasMtPoles = mtEditorSectionProps.mtTopology.poles.length > 0;

  const nextStageDisabled =
    (activeStage === 1 && !hasArea) ||
    (activeStage === 2 && !hasBtPoles) ||
    (activeStage === 3 && !hasMtPoles);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "PageDown") {
        event.preventDefault();
        setActiveStage((prev) => Math.min(4, prev + 1));
      }

      if (event.key === "PageUp") {
        event.preventDefault();
        setActiveStage((prev) => Math.max(1, prev - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const guidanceText =
    activeStage === 1
      ? t.guidanceCapture
      : activeStage === 2
        ? t.guidanceNetwork
        : activeStage === 3
          ? t.guidanceMt
          : t.guidanceAnalysis;

  if (isCollapsed) {
    return (
      <motion.aside
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 64, opacity: 1 }}
        className="relative z-20 flex h-full flex-col items-center border-r bg-slate-50/40 py-3 px-1.5 backdrop-blur-2xl glass-premium dark:border-white/5 dark:bg-slate-900/40 shadow-2xl"
      >
        <button
          onClick={() => onToggleCollapse(false)}
          className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-110 transition-transform glass-shine"
          title="Expandir Painel"
        >
          <ChevronRight size={20} />
        </button>

        <div className="flex flex-1 flex-col gap-3">
          {STAGES.map((s) => {
            const isActive = activeStage === s.id;
            const isDone = activeStage > s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                data-testid={`sidebar-stage-collapsed-${s.id}`}
                onClick={() => {
                  setActiveStage(s.id);
                  onToggleCollapse(false);
                }}
                title={s.label}
                aria-label={s.label}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                  isActive
                    ? "bg-white/80 shadow-md dark:bg-white/10 glass-shine"
                    : "hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all shadow-md ${
                    isActive
                      ? `${s.accent} text-white scale-110`
                      : isDone
                        ? "bg-emerald-100 text-emerald-600 shadow-none dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-slate-200 text-slate-400 shadow-none dark:bg-slate-800 dark:text-slate-600"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 size={16} strokeWidth={3} />
                  ) : (
                    <Icon size={16} strokeWidth={2.5} />
                  )}
                </div>

                {/* Tooltip on hover */}
                <div className="absolute left-14 hidden group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-900/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl border border-white/10">
                  {s.label}
                </div>
              </button>
            );
          })}
        </div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`sidebar-workspace relative flex h-full w-full flex-col border-r bg-slate-50/30 p-4 backdrop-blur-2xl glass-premium transition-all dark:border-white/5 dark:bg-slate-900/30 xl:w-[380px] ${
        isSidebarDockedForRamalModal
          ? "opacity-50 pointer-events-none grayscale-[0.5]"
          : ""
      }`}
    >
      <div className="mb-6 flex items-center justify-between px-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">
              {t.workflowTag}
            </p>
            <AnimatePresence>
              {showCelebration && (
                <motion.div
                  initial={{ scale: 0, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40"
                >
                  <CheckCircle2 size={12} strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
            {t.workflowTitle}
          </h2>
        </div>

        <button
          onClick={() => onToggleCollapse(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          title="Recolher Painel"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Mini tabs */}
      <div className="mb-6 grid grid-cols-4 gap-1 px-1">
        {STAGES.map((s) => {
          const isActive = activeStage === s.id;
          const isDone = activeStage > s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              data-testid={`sidebar-stage-${s.id}`}
              onClick={() => setActiveStage(s.id)}
              title={s.helper}
              aria-label={s.label}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition-all ${
                isActive
                  ? "bg-white/70 shadow-md shadow-slate-200/50 dark:bg-white/10 dark:shadow-none glass-shine"
                  : "hover:bg-slate-100/60 dark:hover:bg-white/5"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  isActive
                    ? `${s.accent} text-white scale-105 shadow-md`
                    : isDone
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 size={17} strokeWidth={2.5} />
                ) : (
                  <Icon size={17} strokeWidth={2.5} />
                )}
              </div>
              <span
                className={`text-[8.5px] font-black uppercase tracking-widest leading-none ${
                  isActive
                    ? "text-slate-700 dark:text-slate-200"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {s.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="active-bar"
                  className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-current opacity-60"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
        <div
          key={activeStage}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="h-8 w-1 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                {currentStage?.label}
              </p>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {currentStage?.helper}
              </p>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="flex flex-col gap-4 p-4 animate-pulse">
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-32 w-full rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            }
          >
            {currentStage?.component}
          </Suspense>
        </div>
      </div>

      {/* Workflow CTA */}
      <div className="glass-card mt-2 p-5 backdrop-blur-md border-blue-500/20 shadow-xl shadow-blue-500/5 glass-premium">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-500 dark:text-blue-400">
            {t.nextActionTag}
          </p>
          <span
            className="rounded-lg bg-slate-100/50 px-2 py-0.5 text-xs font-black text-slate-400 dark:bg-white/5 dark:text-slate-600 select-none"
            title={t.pageNavigationHint}
            aria-label={t.pageNavigationHint}
            role="note"
          >
            PgUp / PgDn
          </span>
        </div>
        <p className="mt-2 mb-4 text-[13px] font-bold leading-relaxed text-slate-900 dark:text-slate-100">
          {guidanceText}
        </p>
        <motion.button
          whileHover={{ scale: 1.02, translateY: -2 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          disabled={!nextStage || nextStageDisabled}
          onClick={() => {
            if (nextStage) {
              setActiveStage(nextStage.id);
            }
          }}
          className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none min-h-[56px] glass-shine"
        >
          <span className="relative z-10">
            {nextStage ? t.advanceStep : t.flowCompleted}
          </span>
          {nextStage && <ArrowRight size={16} className="relative z-10" />}

          {/* Animated shine effect */}
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          <style>{`
            @keyframes shimmer {
              100% { transform: translateX(100%); }
            }
          `}</style>
        </motion.button>

        {/* Blocker hint — explains why the next stage button is disabled */}
        <AnimatePresence>
          {nextStageDisabled && nextStage && (
            <motion.p
              key={`blocker-${activeStage}`}
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 text-center leading-snug px-1"
              aria-live="polite"
            >
              {activeStage === 1 && "⚠ Defina uma área no mapa para avançar"}
              {activeStage === 2 &&
                "⚠ Adicione ao menos um poste BT para avançar"}
              {activeStage === 3 &&
                "⚠ Adicione ao menos um poste MT para avançar"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
