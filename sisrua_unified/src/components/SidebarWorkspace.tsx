import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  LineChart,
  Network,
} from "lucide-react";
import { SidebarAnalysisResults } from "./SidebarAnalysisResults";
import { SidebarBtEditorSection } from "./SidebarBtEditorSection";
import { SidebarSelectionControls } from "./SidebarSelectionControls";

import { SidebarMtEditorSection } from "./SidebarMtEditorSection";

type WorkflowStage = "capture" | "network" | "mt" | "analysis";

const STAGE_ORDER: WorkflowStage[] = ["capture", "network", "mt", "analysis"];

type Props = {
  isSidebarDockedForRamalModal: boolean;
  isCollapsed?: boolean;
  selectionControlsProps: React.ComponentProps<typeof SidebarSelectionControls>;
  btEditorSectionProps: React.ComponentProps<typeof SidebarBtEditorSection>;
  mtEditorSectionProps: React.ComponentProps<typeof SidebarMtEditorSection>;
  analysisResultsProps: React.ComponentProps<typeof SidebarAnalysisResults>;
};

export function SidebarWorkspace({
  isSidebarDockedForRamalModal,
  isCollapsed = false,
  selectionControlsProps,
  btEditorSectionProps,
  mtEditorSectionProps,
  analysisResultsProps,
}: Props) {
  const hasAreaSelection = Boolean(selectionControlsProps.center?.label);
  const hasBtTopology =
    (btEditorSectionProps.btTopology?.poles?.length ?? 0) > 0 ||
    (btEditorSectionProps.btTopology?.edges?.length ?? 0) > 0 ||
    (btEditorSectionProps.btTopology?.transformers?.length ?? 0) > 0;
  const hasMtTopology =
    (mtEditorSectionProps.mtTopology?.poles?.length ?? 0) > 0 ||
    (mtEditorSectionProps.mtTopology?.edges?.length ?? 0) > 0;
  const hasAnalysis = Boolean(analysisResultsProps.stats);

  const [activeStage, setActiveStage] = React.useState<WorkflowStage>(
    hasAnalysis
      ? "analysis"
      : hasMtTopology
        ? "mt"
        : hasBtTopology
          ? "network"
          : "capture",
  );

  const sidebarRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (hasAnalysis) {
      setActiveStage("analysis");
      return;
    }
    if (hasMtTopology && activeStage === "network") {
      setActiveStage("mt");
      return;
    }
    if (hasBtTopology && activeStage === "capture") {
      setActiveStage("network");
    }
  }, [hasAnalysis, hasMtTopology, hasBtTopology, activeStage]);

  // PageUp / PageDown: navigate between workflow stage cards
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "PageDown" && e.key !== "PageUp") return;
      const sidebar = sidebarRef.current;
      if (!sidebar || !sidebar.contains(document.activeElement)) return;
      const target = e.target as HTMLElement;
      // Let select/textarea handle page keys natively
      if (target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
      e.preventDefault();
      setActiveStage((prev) => {
        const currentIdx = STAGE_ORDER.indexOf(prev);
        const nextIdx =
          e.key === "PageDown"
            ? Math.min(currentIdx + 1, STAGE_ORDER.length - 1)
            : Math.max(currentIdx - 1, 0);
        if (nextIdx === currentIdx) return prev;
        requestAnimationFrame(() => {
          sidebar
            .querySelector(`[data-card-stage="${STAGE_ORDER[nextIdx]}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return STAGE_ORDER[nextIdx];
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-scroll sidebar so focused inputs never hide below the bottom edge
  React.useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target === sidebar) return;
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    };
    sidebar.addEventListener("focusin", handleFocusIn);
    return () => sidebar.removeEventListener("focusin", handleFocusIn);
  }, []);

  const workflowStages: Array<{
    key: WorkflowStage;
    label: string;
    helper: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    done: boolean;
  }> = [
    {
      key: "capture",
      label: "1. Área",
      helper: "Seleção e parâmetros",
      icon: Compass,
      done: hasAreaSelection,
    },
    {
      key: "network",
      label: "2. BT",
      helper: "Baixa Tensão (n1-n4)",
      icon: Network,
      done: hasBtTopology,
    },
    {
      key: "mt",
      label: "3. MT",
      helper: "Média Tensão (n1-n4)",
      icon: Network,
      done: hasMtTopology,
    },
    {
      key: "analysis",
      label: "4. Análise",
      helper: "Insights e exportação",
      icon: LineChart,
      done: hasAnalysis,
    },
  ];

  const nextStage =
    activeStage === "capture"
      ? "network"
      : activeStage === "network"
        ? "mt"
        : activeStage === "mt"
          ? "analysis"
          : null;

  const nextStageDisabled =
    (activeStage === "capture" && !hasAreaSelection) ||
    (activeStage === "network" && !hasBtTopology) ||
    (activeStage === "mt" && !hasMtTopology);

  const guidanceText =
    activeStage === "capture"
      ? "Defina a área-alvo e o modo de seleção para liberar a etapa BT."
      : activeStage === "network"
        ? "Construa ou revise a topologia BT para habilitar a MT."
        : activeStage === "mt"
          ? "Modele as estruturas de MT (n1-n4) para habilitar análise e DXF."
          : "Execute a análise e finalize com a exportação técnica.";

  return (
    <motion.aside
      ref={sidebarRef}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`app-sidebar z-20 flex flex-col gap-4 overflow-y-auto border-r transition-all duration-300 scrollbar-hide xl:shrink-0 ${
        isSidebarDockedForRamalModal || isCollapsed
          ? "w-0 p-0 opacity-0 pointer-events-none border-r-0"
          : "w-full max-h-[56vh] p-4 opacity-100 xl:max-h-none xl:max-w-[420px]"
      }`}
      aria-hidden={isSidebarDockedForRamalModal || isCollapsed}
    >
      <div className="glass-card px-4 pb-4 pt-3 md:px-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Workflow
            </p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Estação de trabalho guiada
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {workflowStages.filter((stage) => stage.done).length}/4
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {workflowStages.map((stage) => {
            const Icon = stage.icon;
            const isActive = stage.key === activeStage;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setActiveStage(stage.key)}
                className={`rounded-2xl border-2 px-2 py-2 text-left transition-all ${
                  isActive
                    ? "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-950/25 dark:text-cyan-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                }`}
                title={stage.helper}
              >
                <div className="mb-1 flex items-center justify-between">
                  <Icon size={13} className="shrink-0" />
                  {stage.done && (
                    <CheckCircle2
                      size={12}
                      className="text-emerald-600 dark:text-emerald-300"
                    />
                  )}
                </div>
                <p className="text-[10px] font-black uppercase tracking-wide">
                  {stage.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-4 md:p-5" data-card-stage="capture">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Etapa 1
            </p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Captura da área
            </p>
          </div>
          {hasAreaSelection && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-950/25 dark:text-emerald-200">
              OK
            </span>
          )}
        </div>
        <div
          className={activeStage !== "capture" ? "opacity-95" : undefined}
          aria-label="Conteúdo da etapa captura"
        >
          <SidebarSelectionControls {...selectionControlsProps} />
        </div>
      </div>

      <div className="glass-card p-4 md:p-5" data-card-stage="network">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Etapa 2
            </p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Edição da rede BT
            </p>
          </div>
          {hasBtTopology && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-950/25 dark:text-emerald-200">
              OK
            </span>
          )}
        </div>
        <div
          className={activeStage !== "network" ? "opacity-95" : undefined}
          role="region"
          aria-label="Conteúdo da etapa BT"
        >
          <SidebarBtEditorSection {...btEditorSectionProps} />
        </div>
      </div>

      <div className="glass-card p-4 md:p-5" data-card-stage="mt">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Etapa 3
            </p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Edição da rede MT
            </p>
          </div>
          {hasMtTopology && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-950/25 dark:text-emerald-200">
              OK
            </span>
          )}
        </div>
        <div
          className={activeStage !== "mt" ? "opacity-95" : undefined}
          role="region"
          aria-label="Conteúdo da etapa MT"
        >
          <SidebarMtEditorSection {...mtEditorSectionProps} />
        </div>
      </div>

      <div className="glass-card mb-1 p-4 md:p-5" data-card-stage="analysis">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Etapa 4
            </p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Análise e exportação
            </p>
          </div>
          {hasAnalysis && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-950/25 dark:text-emerald-200">
              OK
            </span>
          )}
        </div>
        <div
          className={activeStage !== "analysis" ? "opacity-95" : undefined}
          role="region"
          aria-label="Conteúdo da etapa análise"
        >
          <SidebarAnalysisResults {...analysisResultsProps} />
        </div>
      </div>

      <div className="glass-card sticky bottom-0 z-10 mt-auto p-3 backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Próxima ação
          </p>
          <span
            className="text-[9px] font-semibold text-slate-400 dark:text-slate-600 select-none"
            title="Use PageUp/PageDown para navegar entre etapas"
          >
            PgUp / PgDn
          </span>
        </div>
        <p className="mt-1 mb-3 text-xs font-medium text-slate-700 dark:text-slate-200">
          {guidanceText}
        </p>
        <button
          type="button"
          disabled={!nextStage || nextStageDisabled}
          onClick={() => {
            if (nextStage) {
              setActiveStage(nextStage);
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {nextStage ? "Avançar etapa" : "Fluxo concluído"}
          {nextStage && <ArrowRight size={13} />}
        </button>
      </div>
    </motion.aside>
  );
}
