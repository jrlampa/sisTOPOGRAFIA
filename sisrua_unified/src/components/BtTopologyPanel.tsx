import React, { useCallback, useMemo } from "react";
import { Copy } from "lucide-react";
import type {
  BtNetworkScenario,
  BtTopology,
  BtProjectType,
  AppLocale,
  MtTopology,
} from "../types";
import { getBtTopologyPanelText } from "../i18n/btTopologyPanelText";
import type {
  BtDerivedSummary,
  BtPoleAccumulatedDemand,
  BtClandestinoDisplay,
  BtTransformerDerived,
} from "../services/btDerivedService";
import BtTopologyPanelStats from "./BtTopologyPanel/BtTopologyPanelStats";
import BtTopologyPanelBulkImportModal from "./BtTopologyPanel/BtTopologyPanelBulkImportModal";
import { useBtTopologyPanelBulkImport } from "./BtTopologyPanel/useBtTopologyPanelBulkImport";
import type { CriticalConfirmationConfig } from "./BtModals";
import BtUnifiedDashboard from "./BtTopologyPanel/BtUnifiedDashboard";
import { BtTopologyProvider } from "./BtTopologyPanel/BtTopologyContext";

interface BtTopologyPanelProps {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario?: BtNetworkScenario;
  onTopologyChange: (next: BtTopology) => void;
  onSelectedPoleChange?: (poleId: string) => void;
  onSelectedTransformerChange?: (transformerId: string) => void;
  onSelectedEdgeChange?: (edgeId: string) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtRenameTransformer?: (id: string, title: string) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    nodeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
  onBtSetTransformerChangeFlag?: (
    transformerId: string,
    transformerChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onRequestCriticalConfirmation?: (config: CriticalConfirmationConfig) => void;
  transformerDebugById: Record<
    string,
    { assignedClients: number; estimatedDemandKva: number }
  >;
  projectType: BtProjectType;
  onProjectTypeChange: (next: BtProjectType) => void;
  clandestinoAreaM2: number;
  onClandestinoAreaChange: (next: number) => void;
  pointDemandKva?: number;
  criticalPoleId?: string | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  clandestinoDisplay: BtClandestinoDisplay;
  transformersDerived: BtTransformerDerived[];
  selectedPoleId?: string;
  selectedPoleIds?: string[];
  selectedEdgeId?: string;
  selectedTransformerId?: string;
  onSetSelectedPoleId?: (id: string) => void;
  onSetSelectedPoleIds?: (ids: string[]) => void;
  onSetSelectedEdgeId?: (id: string) => void;
  onSetSelectedTransformerId?: (id: string) => void;
  mtTopology: MtTopology;
  isCalculating?: boolean;
}

const BtTopologyPanel: React.FC<BtTopologyPanelProps> = (props) => {
  const {
    locale,
    btTopology,
    btNetworkScenario = "asis",
    onTopologyChange,
    onSelectedPoleChange,
    onSelectedTransformerChange,
    onSelectedEdgeChange,
    onBtRenamePole,
    onBtRenameTransformer,
    onBtSetPoleChangeFlag,
    onBtTogglePoleCircuitBreak,
    onBtSetTransformerChangeFlag,
    onBtSetEdgeChangeFlag,
    accumulatedByPole,
    summary,
    clandestinoDisplay,
    transformersDerived,
    transformerDebugById,
    projectType,
    onProjectTypeChange,
    clandestinoAreaM2,
    onClandestinoAreaChange,
    selectedPoleId = "",
    selectedPoleIds = [],
    selectedEdgeId = "",
    selectedTransformerId = "",
    onSetSelectedPoleId,
    onSetSelectedPoleIds,
    onSetSelectedEdgeId,
    onSetSelectedTransformerId,
    mtTopology,
    isCalculating = false,
  } = props;

  const bulkImport = useBtTopologyPanelBulkImport({
    btTopology,
    onTopologyChange,
    onSelectedPoleChange,
    onProjectTypeChange,
    onClandestinoAreaChange,
  });

  const t = getBtTopologyPanelText(locale);
  const spanLengthsM = useMemo(
    () => btTopology.edges.map((e) => e.lengthMeters ?? 0).filter(Boolean),
    [btTopology.edges],
  );

  React.useEffect(() => {
    if (btTopology.poles.length === 0) {
      onSetSelectedPoleId?.("");
      return;
    }
    if (!btTopology.poles.some((pole) => pole.id === selectedPoleId)) {
      const nextPoleId = btTopology.poles[0].id;
      onSetSelectedPoleId?.(nextPoleId);
      onSelectedPoleChange?.(nextPoleId);
    }
  }, [
    btTopology.poles,
    selectedPoleId,
    onSelectedPoleChange,
    onSetSelectedPoleId,
  ]);

  React.useEffect(() => {
    if (btTopology.transformers.length === 0) {
      onSetSelectedTransformerId?.("");
      return;
    }
    if (!btTopology.transformers.some((t) => t.id === selectedTransformerId)) {
      const nextTransformerId = btTopology.transformers[0].id;
      onSetSelectedTransformerId?.(nextTransformerId);
      onSelectedTransformerChange?.(nextTransformerId);
    }
  }, [
    btTopology.transformers,
    selectedTransformerId,
    onSelectedTransformerChange,
    onSetSelectedTransformerId,
  ]);

  React.useEffect(() => {
    if (btTopology.edges.length === 0) {
      onSetSelectedEdgeId?.("");
      return;
    }
    if (!btTopology.edges.some((edge) => edge.id === selectedEdgeId)) {
      const nextEdgeId = btTopology.edges[0].id;
      onSetSelectedEdgeId?.(nextEdgeId);
      onSelectedEdgeChange?.(nextEdgeId);
    }
  }, [
    btTopology.edges,
    selectedEdgeId,
    onSelectedEdgeChange,
    onSetSelectedEdgeId,
  ]);

  const selectTransformer = useCallback((id: string) => {
    onSetSelectedTransformerId?.(id);
    onSelectedTransformerChange?.(id);
  }, [onSelectedTransformerChange, onSetSelectedTransformerId]);

  const selectEdge = useCallback((id: string) => {
    onSetSelectedEdgeId?.(id);
    onSelectedEdgeChange?.(id);
  }, [onSelectedEdgeChange, onSetSelectedEdgeId]);

  const selectedPole = useMemo(
    () => btTopology.poles.find((p) => p.id === selectedPoleId) ?? null,
    [btTopology.poles, selectedPoleId],
  );
  const selectedTransformer = useMemo(
    () =>
      btTopology.transformers.find((t) => t.id === selectedTransformerId) ??
      null,
    [btTopology.transformers, selectedTransformerId],
  );
  const selectedEdge = useMemo(
    () => btTopology.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [btTopology.edges, selectedEdgeId],
  );

  const updatePole = useCallback((poleId: string, updater: (pole: any) => any) => {
    onTopologyChange({
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? updater(pole) : pole,
      ),
    });
  }, [btTopology, onTopologyChange]);

  const updateTransformer = useCallback((id: string, updater: (t: any) => any) => {
    onTopologyChange({
      ...btTopology,
      transformers: btTopology.transformers.map((t) =>
        t.id === id ? updater(t) : t,
      ),
    });
  }, [btTopology, onTopologyChange]);

  const updateEdge = useCallback((id: string, updater: (e: any) => any) => {
    onTopologyChange({
      ...btTopology,
      edges: btTopology.edges.map((e) => (e.id === id ? updater(e) : e)),
    });
  }, [btTopology, onTopologyChange]);

  const updatePoleRamais = useCallback((
    poleId: string,
    ramais: BtTopology["poles"][number]["ramais"],
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, ramais }));
  }, [updatePole]);

  const updatePoleSpec = useCallback((
    poleId: string,
    spec: BtTopology["poles"][number]["poleSpec"] | undefined,
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, poleSpec: spec }));
  }, [updatePole]);

  const updatePoleConditionStatus = useCallback((
    poleId: string,
    conditionStatus: BtTopology["poles"][number]["conditionStatus"] | undefined,
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, conditionStatus }));
  }, [updatePole]);

  const updatePoleBtStructures = useCallback((
    poleId: string,
    btStructures: BtTopology["poles"][number]["btStructures"] | undefined,
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, btStructures }));
  }, [updatePole]);

  const updatePoleGeneralNotes = useCallback((
    poleId: string,
    generalNotes: string | undefined,
  ) => {
    updatePole(poleId, (pole) => ({ ...pole, generalNotes }));
  }, [updatePole]);

  const updateTransformerVerified = useCallback((id: string, verified: boolean) => {
    updateTransformer(id, (transformer) => ({ ...transformer, verified }));
  }, [updateTransformer]);

  const updateTransformerReadings = useCallback((
    id: string,
    readings: BtTopology["transformers"][number]["readings"],
  ) => {
    updateTransformer(id, (transformer) => ({ ...transformer, readings }));
  }, [updateTransformer]);

  const updateTransformerProjectPower = useCallback((
    id: string,
    projectPowerKva: number,
  ) => {
    updateTransformer(id, (transformer) => ({
      ...transformer,
      projectPowerKva,
    }));
  }, [updateTransformer]);

  const updateEdgeVerified = useCallback((id: string, verified: boolean) => {
    updateEdge(id, (edge) => ({ ...edge, verified }));
  }, [updateEdge]);

  const updateEdgeConductors = useCallback((
    id: string,
    conductors: BtTopology["edges"][number]["conductors"],
  ) => {
    updateEdge(id, (edge) => ({ ...edge, conductors }));
  }, [updateEdge]);

  const updateEdgeMtConductors = useCallback((
    id: string,
    mtConductors: BtTopology["edges"][number]["conductors"],
  ) => {
    updateEdge(id, (edge) => ({ ...edge, mtConductors }));
  }, [updateEdge]);

  const updateEdgeReplacementFromConductors = useCallback((
    id: string,
    replacementFromConductors: BtTopology["edges"][number]["conductors"],
  ) => {
    updateEdge(id, (edge) => ({ ...edge, replacementFromConductors }));
  }, [updateEdge]);

  const contextValue = useMemo(
    () => ({
      locale,
      btTopology,
      btNetworkScenario,
      projectType,
      clandestinoAreaM2,
      mtTopology,
      accumulatedByPole,
      summary,
      clandestinoDisplay,
      transformersDerived,
      transformerDebugById,
      selectedPoleId,
      selectedPoleIds,
      selectedPole,
      selectedTransformerId,
      selectedTransformer,
      selectedEdgeId,
      selectedEdge,
      isCalculating,
      onTopologyChange,
      onBtRenamePole,
      onBtSetPoleChangeFlag,
      onBtTogglePoleCircuitBreak,
      onBtRenameTransformer,
      onBtSetTransformerChangeFlag,
      onBtSetEdgeChangeFlag,
      onSetSelectedPoleId,
      onSetSelectedPoleIds,
      onSetSelectedTransformerId,
      onSetSelectedEdgeId,
      onSelectedEdgeChange: selectEdge,
      onSelectedTransformerChange: selectTransformer,
      updatePole,
      updateTransformer,
      updateEdge,
      updatePoleRamais,
      updatePoleSpec,
      updatePoleConditionStatus,
      updatePoleBtStructures,
      updatePoleGeneralNotes,
      updateTransformerVerified,
      updateTransformerReadings,
      updateTransformerProjectPower,
      updateEdgeVerified,
      updateEdgeConductors,
      updateEdgeMtConductors,
      updateEdgeReplacementFromConductors,
    }),
    [
      accumulatedByPole,
      btNetworkScenario,
      btTopology,
      clandestinoAreaM2,
      clandestinoDisplay,
      isCalculating,
      locale,
      mtTopology,
      onBtRenamePole,
      onBtRenameTransformer,
      onBtSetEdgeChangeFlag,
      onBtSetPoleChangeFlag,
      onBtSetTransformerChangeFlag,
      onBtTogglePoleCircuitBreak,
      onSetSelectedEdgeId,
      onSetSelectedPoleId,
      onSetSelectedPoleIds,
      onSetSelectedTransformerId,
      onTopologyChange,
      projectType,
      selectEdge,
      selectTransformer,
      selectedEdge,
      selectedEdgeId,
      selectedPole,
      selectedPoleId,
      selectedPoleIds,
      selectedTransformer,
      selectedTransformerId,
      summary,
      transformerDebugById,
      transformersDerived,
      updateEdge,
      updateEdgeConductors,
      updateEdgeMtConductors,
      updateEdgeReplacementFromConductors,
      updateEdgeVerified,
      updatePole,
      updatePoleBtStructures,
      updatePoleConditionStatus,
      updatePoleGeneralNotes,
      updatePoleRamais,
      updatePoleSpec,
      updateTransformer,
      updateTransformerProjectPower,
      updateTransformerReadings,
      updateTransformerVerified,
    ],
  );

  return (
    <BtTopologyProvider value={contextValue}>
      <div className="flex h-full flex-col overflow-hidden bg-slate-50/50 dark:bg-zinc-950/20">
        <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
          <BtTopologyPanelStats
            locale={locale}
            poles={summary.poles}
            transformers={summary.transformers}
            edges={summary.edges}
            totalLengthMeters={summary.totalLengthMeters}
            transformerDemandKva={summary.transformerDemandKva}
            transformerNominalKva={
              btTopology.transformers[0]?.projectPowerKva ?? 75
            }
            spanLengthsM={spanLengthsM}
            clandestinoDisplay={clandestinoDisplay}
            isClandestino={projectType === "clandestino"}
          />

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/50">
            <label
              htmlFor="bt-project-type-select"
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
            >
              {t.projectTypeTitle}
            </label>
            <select
              id="bt-project-type-select"
              className="mt-2 w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-2.5 text-xs font-black text-slate-800 focus:border-blue-200 focus:ring-4 focus:ring-blue-50 dark:border-white/5 dark:bg-zinc-950 dark:text-slate-200 dark:focus:ring-blue-900/20 outline-none transition-all"
              value={projectType}
              onChange={(e) =>
                onProjectTypeChange(e.target.value as BtProjectType)
              }
            >
              <option value="ramais">{t.projectTypeRamais}</option>
              <option value="clandestino">{t.projectTypeClandestino}</option>
            </select>

            {projectType === "clandestino" && (
              <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label
                    htmlFor="bt-clandestino-avg-area-input"
                    className="mb-1 block text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400"
                  >
                    {t.clandestinoAvgAreaLabel}
                  </label>
                  <input
                    id="bt-clandestino-avg-area-input"
                    type="number"
                    min={0}
                    step={0.1}
                    defaultValue={40}
                    className="w-full rounded-xl border-2 border-violet-100 bg-violet-50/30 p-2.5 text-xs font-black text-violet-900 focus:border-violet-200 focus:ring-4 focus:ring-violet-50 dark:border-violet-900/20 dark:bg-violet-950/10 dark:text-violet-200 outline-none transition-all"
                    title={t.clandestinoAvgAreaLabel}
                  />
                </div>

                <div>
                  <label
                    htmlFor="bt-clandestino-area-input"
                    className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400"
                  >
                    {t.clandestinoAreaTitle}
                  </label>
                  <input
                    id="bt-clandestino-area-input"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={
                      Number.isFinite(clandestinoAreaM2) ? clandestinoAreaM2 : 0
                    }
                    onChange={(e) =>
                      onClandestinoAreaChange(
                        Math.max(0, Number(e.target.value)),
                      )
                    }
                    placeholder={t.clandestinoAreaPlaceholder}
                    className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-2.5 text-xs font-bold text-slate-700 focus:border-blue-100 focus:ring-4 focus:ring-blue-50 dark:border-white/5 dark:bg-zinc-950 dark:text-slate-200 outline-none transition-all"
                  />
                  <p className="mt-1.5 text-[9px] text-slate-400 italic font-medium">
                    {t.clandestinoHint}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => bulkImport.setIsBulkRamalModalOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
            >
              <Copy size={14} aria-hidden="true" /> {t.btnBulkImport}
            </button>
          </div>

          <BtUnifiedDashboard />
        </div>

        <BtTopologyPanelBulkImportModal
          locale={locale}
          isOpen={bulkImport.isBulkRamalModalOpen}
          onClose={() => bulkImport.setIsBulkRamalModalOpen(false)}
          bulkRamalText={bulkImport.bulkRamalText}
          setBulkRamalText={bulkImport.setBulkRamalText}
          bulkRamalFeedback={bulkImport.bulkRamalFeedback}
          bulkImportReview={bulkImport.bulkImportReview}
          onApply={bulkImport.applyBulkRamalInsert}
          onFileSelect={bulkImport.importBulkRamaisFromWorkbook}
          fileInputRef={bulkImport.bulkFileInputRef}
          onReviewNext={bulkImport.handleReviewNext}
        />
      </div>
    </BtTopologyProvider>
  );
};

export default BtTopologyPanel;
