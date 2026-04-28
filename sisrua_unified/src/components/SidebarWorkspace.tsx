import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  LineChart,
  Network,
} from "lucide-react";
import { SidebarAnalysisResults } from "./SidebarAnalysisResults";
import { SidebarBtEditorSection } from "./SidebarBtEditorSection";
import { SidebarMtEditorSection } from "./SidebarMtEditorSection";
import { SidebarSelectionControls } from "./SidebarSelectionControls";
import type { AppLocale } from "../types";
import { getSidebarWorkspaceText } from "../i18n/sidebarWorkspaceText";
import { trackWorkflowStage } from "../utils/analytics";

type SidebarWorkspaceProps = {
  locale: AppLocale;
  isCollapsed: boolean;
  isSidebarDockedForRamalModal: boolean;
  selectionControlsProps: React.ComponentProps<typeof SidebarSelectionControls>;
  btEditorSectionProps: React.ComponentProps<typeof SidebarBtEditorSection>;
  mtEditorSectionProps: React.ComponentProps<typeof SidebarMtEditorSection>;
  analysisResultsProps: React.ComponentProps<typeof SidebarAnalysisResults>;
};

export function SidebarWorkspace({
  locale,
  isCollapsed,
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
    // Only celebrate progression, not initial mount
    if (activeStage > 1) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1500);
      
      // Track UX-20: Stage transition
      const now = Date.now();
      const durationMs = now - stageEntryTimeRef.current;
      trackWorkflowStage(activeStage - 1, activeStage, durationMs);
      stageEntryTimeRef.current = now;

      return () => clearTimeout(timer);
    }
  }, [activeStage]);

  const t = getSidebarWorkspaceText(locale);

  if (isCollapsed) return null;

  const STAGES = [
    {
      id: 1,
      label: t.stage1Label,
      helper: t.stage1Helper,
      icon: Compass,
      component: <SidebarSelectionControls {...selectionControlsProps} />,
    },
    {
      id: 2,
      label: t.stage2Label,
      helper: t.stage2Helper,
      icon: Network,
      component: <SidebarBtEditorSection {...btEditorSectionProps} />,
    },
    {
      id: 3,
      label: t.stage3Label,
      helper: t.stage3Helper,
      icon: ZapIcon,
      component: <SidebarMtEditorSection {...mtEditorSectionProps} />,
    },
    {
      id: 4,
      label: t.stage4Label,
      helper: t.stage4Helper,
      icon: LineChart,
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

  const guidanceText =
    activeStage === 1
      ? t.guidanceCapture
      : activeStage === 2
        ? t.guidanceNetwork
        : activeStage === 3
          ? t.guidanceMt
          : t.guidanceAnalysis;

  return (
    <motion.aside
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`sidebar-workspace relative flex h-full w-full flex-col border-r bg-slate-50/50 p-4 backdrop-blur-xl transition-all dark:border-white/5 dark:bg-slate-900/50 xl:w-[380px] ${
        isSidebarDockedForRamalModal ? "opacity-50 pointer-events-none grayscale-[0.5]" : ""
      }`}
    >
      <div className="mb-6 flex items-center justify-between px-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">
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
              onClick={() => setActiveStage(s.id)}
              title={s.helper}
              className={`group relative flex flex-col items-center gap-2 rounded-xl py-3 transition-all ${
                isActive
                  ? "bg-white shadow-lg shadow-slate-200/50 dark:bg-white/10 dark:shadow-none"
                  : "hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  isActive
                    ? "bg-blue-600 text-white scale-110 shadow-md shadow-blue-600/20"
                    : isDone
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                }`}
              >
                {isDone ? <CheckCircle2 size={16} strokeWidth={3} /> : <Icon size={16} strokeWidth={2.5} />}
              </div>
              <span
                className={`text-[9px] font-black uppercase tracking-widest ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                Etapa {s.id}
              </span>
              {isActive && (
                <motion.div
                  layoutId="active-bar"
                  className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-blue-600"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
        <div key={activeStage} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="h-8 w-1 rounded-full bg-blue-600" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {currentStage?.label}
              </p>
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {currentStage?.helper}
              </p>
            </div>
          </div>
          {currentStage?.component}
        </div>
      </div>

      {/* Workflow CTA */}
      <div className="glass-card mt-2 p-5 backdrop-blur-md border-blue-500/20 shadow-xl shadow-blue-500/5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500 dark:text-blue-400">
            {t.nextActionTag}
          </p>
          <span
            className="rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-400 dark:bg-white/5 dark:text-slate-600 select-none"
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
          className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-4 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none min-h-[56px]"
        >
          <span className="relative z-10">{nextStage ? t.advanceStep : t.flowCompleted}</span>
          {nextStage && <ArrowRight size={16} className="relative z-10" />}
          
          {/* Animated shine effect */}
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          <style>{`
            @keyframes shimmer {
              100% { transform: translateX(100%); }
            }
          `}</style>
        </motion.button>
      </div>
    </motion.aside>
  );
}

// Helper to use Zap icon without importing it again (was missing in previous turn)
const ZapIcon = ({ size, className, strokeWidth }: any) => (
  <svg 
    width={size} 
    height={size} 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth={strokeWidth} 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
