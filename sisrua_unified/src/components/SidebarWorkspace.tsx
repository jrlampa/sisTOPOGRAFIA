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

type WorkflowStage = "capture" | "network" | "analysis";

type Props = {
  isSidebarDockedForRamalModal: boolean;
  isCollapsed?: boolean;
  selectionControlsProps: React.ComponentProps<typeof SidebarSelectionControls>;
  btEditorSectionProps: React.ComponentProps<typeof SidebarBtEditorSection>;
  analysisResultsProps: React.ComponentProps<typeof SidebarAnalysisResults>;
};

export function SidebarWorkspace({
  isSidebarDockedForRamalModal,
  isCollapsed = false,
  selectionControlsProps,
  btEditorSectionProps,
  analysisResultsProps,
}: Props) {
  const hasAreaSelection = Boolean(selectionControlsProps.center?.label);
  const hasBtTopology =
    (btEditorSectionProps.btTopology?.poles?.length ?? 0) > 0 ||
    (btEditorSectionProps.btTopology?.edges?.length ?? 0) > 0 ||
    (btEditorSectionProps.btTopology?.transformers?.length ?? 0) > 0;
  const hasAnalysis = Boolean(analysisResultsProps.stats);

  const [activeStage, setActiveStage] = React.useState<WorkflowStage>(
    hasAnalysis ? "analysis" : hasBtTopology ? "network" : "capture",
  );

  React.useEffect(() => {
    if (hasAnalysis) {
      setActiveStage("analysis");
      return;
    }
    if (hasBtTopology && activeStage === "capture") {
      setActiveStage("network");
    }
  }, [hasAnalysis, hasBtTopology, activeStage]);

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
      helper: "Modelagem da rede",
      icon: Network,
      done: hasBtTopology,
    },
    {
      key: "analysis",
      label: "3. Análise",
      helper: "Insights e exportação",
      icon: LineChart,
      done: hasAnalysis,
    },
  ];

  const nextStage: WorkflowStage | null =
    activeStage === "capture"
      ? "network"
      : activeStage === "network"
        ? "analysis"
        : null;

  const nextStageDisabled =
    (activeStage === "capture" && !hasAreaSelection) ||
    (activeStage === "network" && !hasBtTopology);

  const guidanceText =
    activeStage === "capture"
      ? "Defina a área-alvo e o modo de seleção para liberar a etapa BT."
      : activeStage === "network"
        ? "Construa ou revise a topologia BT para habilitar análise e DXF."
        : "Execute a análise e finalize com a exportação técnica.";

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`app-sidebar border-r-2 flex flex-col gap-4 overflow-y-auto z-20 shadow-2xl transition-all duration-300 scrollbar-hide xl:shrink-0 ${
        isSidebarDockedForRamalModal || isCollapsed
          ? "w-0 p-0 opacity-0 pointer-events-none border-r-0"
          : "w-full max-h-[56vh] xl:max-h-none xl:max-w-[460px] p-3 md:p-4 opacity-100"
      }`}
      aria-hidden={isSidebarDockedForRamalModal || isCollapsed}
    >
      <div className="app-section rounded-3xl px-4 pb-4 pt-3 md:px-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-fuchsia-500 via-cyan-500 to-emerald-500" />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-200">
              Workflow Operacional
            </p>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
              Estação de trabalho guiada
            </p>
          </div>
          <span className="rounded-full border-2 border-amber-700/35 bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:border-amber-400/45 dark:bg-zinc-900 dark:text-amber-100">
            {workflowStages.filter((stage) => stage.done).length}/3
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
                    ? "border-cyan-600 bg-cyan-100 text-cyan-900 dark:border-cyan-400/60 dark:bg-cyan-950/40 dark:text-cyan-100"
                    : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-zinc-900 dark:text-amber-100 dark:hover:bg-zinc-800"
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

      <div className="app-section rounded-3xl p-4 md:p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-200">
              Etapa 1
            </p>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
              Captura da área
            </p>
          </div>
          {hasAreaSelection && (
            <span className="rounded-full border border-emerald-600/35 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-950/25 dark:text-emerald-200">
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

      <div className="app-section rounded-3xl p-4 md:p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-200">
              Etapa 2
            </p>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
              Edição da rede BT
            </p>
          </div>
          {hasBtTopology && (
            <span className="rounded-full border border-emerald-600/35 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-950/25 dark:text-emerald-200">
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

      <div className="app-section mb-1 rounded-3xl p-4 md:p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-200">
              Etapa 3
            </p>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
              Análise e exportação
            </p>
          </div>
          {hasAnalysis && (
            <span className="rounded-full border border-emerald-600/35 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-950/25 dark:text-emerald-200">
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

      <div className="sticky bottom-0 z-10 mt-auto rounded-2xl border-2 border-fuchsia-700/30 bg-fuchsia-50/95 p-3 shadow-[4px_4px_0_rgba(124,45,18,0.16)] backdrop-blur-sm dark:border-fuchsia-500/40 dark:bg-zinc-900/95 dark:shadow-[4px_4px_0_rgba(251,146,60,0.22)]">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-700 dark:text-fuchsia-200">
          Próxima ação
        </p>
        <p className="mb-3 mt-1 text-xs font-medium text-fuchsia-900 dark:text-fuchsia-100">
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
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-black/15 bg-gradient-to-r from-fuchsia-600 via-blue-600 to-cyan-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {nextStage ? "Avançar etapa" : "Fluxo concluído"}
          {nextStage && <ArrowRight size={13} />}
        </button>
      </div>
    </motion.aside>
  );
}
