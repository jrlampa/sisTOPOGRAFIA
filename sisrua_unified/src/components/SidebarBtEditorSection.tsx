import React, { Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Navigation, 
  Move, 
  MapPin, 
  GitCommit, 
  Zap, 
  AlertTriangle,
  RefreshCcw,
  Plus
} from "lucide-react";
import {
  FormFieldMessage,
  getValidationInputClassName,
} from "./FormFieldFeedback";
import type {
  DgOptimizationOutput,
  DgScenario,
} from "../hooks/useDgOptimization";
import type {
  MtRouterState,
  MtSelectionMode,
  MtNetworkProfile,
} from "../hooks/useMtRouter";
import type {
  AppSettings,
  BtEditorMode,
  BtNetworkScenario,
  BtTopology,
  BtProjectType,
  MtTopology,
} from "../types";
import type {
  BtDerivedSummary,
  BtPoleAccumulatedDemand,
  BtClandestinoDisplay,
} from "../services/btDerivedService";
import type { BtTransformerDerived } from "../services/btDerivedService";
import type { PendingNormalClassificationPole } from "../utils/btNormalization";
import type { AppLocale } from "../types";
import { getSidebarBtEditorText } from "../i18n/sidebarBtEditorText";
import { useTelescopicRemediation } from "../hooks/useTelescopicRemediation";
import type {
  BtEdgeChangeFlag,
  BtPoleChangeFlag,
  BtTransformerChangeFlag,
} from "../utils/btNormalization";
import { getCoordinateInputFeedback } from "../utils/validation";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import type { CriticalConfirmationConfig } from "./BtModals";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { useTopology } from "../contexts/TopologyContext";

const BtTopologyPanel = React.lazy(() =>
  lazyWithRetry(() => import("./BtTopologyPanel")),
);
const DgOptimizationPanel = React.lazy(() =>
  lazyWithRetry(() =>
    import("./DgOptimizationPanel").then((module) => ({
      default: module.DgOptimizationPanel,
    })),
  ),
);
const MtRouterPanel = React.lazy(() => lazyWithRetry(() => import("./MtRouterPanel")));

import { SidebarBulkEditSection } from "./SidebarBulkEditSection";

type TransformerDebugById = Record<
  string,
  { assignedClients: number; estimatedDemandKva: number }
>;

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-900/50 p-6 text-xs font-black uppercase tracking-widest text-slate-400 backdrop-blur-xl shadow-2xl">
    <Loader2 size={16} className="animate-spin text-indigo-500" />
    {label}
  </div>
);

interface EditorToolButtonProps {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  colorClass: string;
  testId?: string;
}

function EditorToolButton({ active, onClick, icon: Icon, label, colorClass, testId }: EditorToolButtonProps) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border transition-all p-3 ${
        active 
          ? `bg-white dark:bg-white/10 shadow-xl ring-2 ${colorClass} border-transparent scale-105 z-10 glass-shine` 
          : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-300"
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-110"}`}>
        <Icon size={20} className={active ? colorClass.replace("ring-", "text-").replace("/50", "") : ""} />
      </div>
      <span className={`text-[9px] font-black uppercase tracking-tighter ${active ? "text-white" : "text-slate-500"}`}>
        {label}
      </span>
    </button>
  );
}

export interface SidebarBtEditorSectionProps {
  locale: AppLocale;
  settings: AppSettings;
  dgTopology?: BtTopology;
  btAccumulatedByPole: BtPoleAccumulatedDemand[];
  btSummary: BtDerivedSummary;
  btPointDemandKva: number;
  btTransformerDebugById: TransformerDebugById;
  btPoleCoordinateInput: string;
  setBtPoleCoordinateInput: (v: string) => void;
  handleBtInsertPoleByCoordinates: () => void;
  clearPendingBtEdge: () => void;
  pendingNormalClassificationPoles: PendingNormalClassificationPole[];
  handleResetBtTopology: () => void;
  updateProjectType: (type: BtProjectType) => void;
  updateClandestinoAreaM2: (area: number) => void;
  handleBtSelectedPoleChange: (poleId: string) => void;
  handleBtSelectedTransformerChange: (id: string) => void;
  handleBtSelectedEdgeChange: (edgeId: string) => void;
  handleBtRenamePole: (poleId: string, title: string) => void;
  handleBtRenameTransformer: (id: string, title: string) => void;
  handleBtSetEdgeChangeFlag: (edgeId: string, flag: BtEdgeChangeFlag) => void;
  handleBtSetPoleChangeFlag: (poleId: string, flag: BtPoleChangeFlag) => void;
  handleBtTogglePoleCircuitBreak: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
  handleBtSetTransformerChangeFlag: (
    id: string,
    flag: BtTransformerChangeFlag,
  ) => void;
  btClandestinoDisplay: BtClandestinoDisplay;
  btTransformersDerived: BtTransformerDerived[];
  requestCriticalConfirmation: (config: CriticalConfirmationConfig) => void;
  onTriggerTelescopicAnalysis?: () => void;
  // Design Generativo (Frente 3)
  isDgOptimizing?: boolean;
  dgResult?: DgOptimizationOutput | null;
  dgError?: string | null;
  dgActiveAltIndex?: number;
  onRunDgOptimization?: (wizardParams?: any) => void;
  onAcceptDgAll?: (scenario: DgScenario) => void;
  onAcceptDgTrafoOnly?: (scenario: DgScenario) => void;
  onClearDgResult?: () => void;
  onSetDgActiveAltIndex?: (index: number) => void;
  dgIsPreviewActive?: boolean;
  onSetDgIsPreviewActive?: (active: boolean) => void;
  // MT Router (Phase 2)
  mtRouterState?: MtRouterState;
  onMtRouterSetSelectionMode?: (mode: MtSelectionMode) => void;
  onMtRouterRemoveTerminal?: (id: string) => void;
  onMtRouterSetMaxSnapDistance?: (m: number) => void;
  onMtRouterSetNetworkProfile?: (profile: MtNetworkProfile) => void;
  onMtRouterSetMtCqtParams?: (params: {
    voltageKv: number;
    cqtLimitFraction: number;
  }) => void;
  onMtRouterUploadKmz?: (file: File) => void;
  onMtRouterCalculate?: () => void;
  onMtRouterApplyProject?: () => void;
  onMtRouterReset?: () => void;
  // Hoisted selection state
  selectedPoleId?: string;
  selectedPoleIds?: string[];
  selectedEdgeId?: string;
  selectedTransformerId?: string;
  onSetSelectedPoleId?: (id: string) => void;
  onSetSelectedPoleIds?: (ids: string[]) => void;
  onSetSelectedEdgeId?: (id: string) => void;
  onSetSelectedTransformerId?: (id: string) => void;
}

export function SidebarBtEditorSection({
  locale,
  settings,
  dgTopology,
  btAccumulatedByPole,
  btSummary,
  btPointDemandKva,
  btTransformerDebugById,
  btPoleCoordinateInput,
  setBtPoleCoordinateInput,
  handleBtInsertPoleByCoordinates,
  clearPendingBtEdge,
  pendingNormalClassificationPoles,
  handleResetBtTopology,
  updateProjectType,
  updateClandestinoAreaM2,
  handleBtSelectedPoleChange,
  handleBtSelectedTransformerChange,
  handleBtSelectedEdgeChange,
  handleBtRenamePole,
  handleBtRenameTransformer,
  handleBtSetEdgeChangeFlag,
  handleBtSetPoleChangeFlag,
  handleBtTogglePoleCircuitBreak,
  handleBtSetTransformerChangeFlag,
  btClandestinoDisplay,
  btTransformersDerived,
  requestCriticalConfirmation,
  onTriggerTelescopicAnalysis,
  isDgOptimizing = false,
  dgResult = null,
  dgError = null,
  dgActiveAltIndex = -1,
  onRunDgOptimization,
  onAcceptDgAll,
  onAcceptDgTrafoOnly,
  onClearDgResult,
  onSetDgActiveAltIndex,
  dgIsPreviewActive = true,
  onSetDgIsPreviewActive,
  mtRouterState,
  onMtRouterSetSelectionMode,
  onMtRouterRemoveTerminal,
  onMtRouterSetMaxSnapDistance,
  onMtRouterSetNetworkProfile,
  onMtRouterSetMtCqtParams,
  onMtRouterUploadKmz,
  onMtRouterCalculate,
  onMtRouterApplyProject,
  onMtRouterReset,
  selectedPoleId = "",
  selectedPoleIds = [],
  selectedEdgeId = "",
  selectedTransformerId = "",
  onSetSelectedPoleId,
  onSetSelectedPoleIds,
  onSetSelectedEdgeId,
  onSetSelectedTransformerId,
}: SidebarBtEditorSectionProps) {
  const { flags } = useFeatureFlags();
  const { 
    btTopology, 
    btNetworkScenario, 
    btEditorMode, 
    setBtNetworkScenario, 
    setBtEditorMode,
    updateBtTopology 
  } = useTopology();

  const effectiveDgTopology = dgTopology ?? btTopology;

  const currentTotalCableLengthMeters = useMemo(() => {
    return effectiveDgTopology.edges.reduce(
      (sum, edge) => sum + (edge.lengthMeters ?? 0),
      0,
    );
  }, [effectiveDgTopology.edges]);

  const coordinateValidation = getCoordinateInputFeedback(
    btPoleCoordinateInput,
  );

  const t = getSidebarBtEditorText(locale);

  const { applyTelescopicUpgrade } = useTelescopicRemediation();

  const handleRemediateCqt = () => {
    const criticalPoleId = btAccumulatedByPole[0]?.poleId;
    if (!criticalPoleId) return;

    const remediatedTopology = applyTelescopicUpgrade(
      btTopology,
      criticalPoleId,
    );
    if (remediatedTopology !== btTopology) {
      updateBtTopology(remediatedTopology);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Scenario Selection */}
      <div className="p-1 bg-white/5 rounded-2xl border border-white/5 shadow-inner flex gap-1">
        <button
          onClick={() => {
            setBtNetworkScenario({ mode: 'ramal' });
            setBtEditorMode({ mode: 'none' });
          }}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            btNetworkScenario?.mode === 'ramal'
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" 
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {t.btnActualNetwork}
        </button>
        <button
          onClick={() => {
            setBtNetworkScenario({ mode: 'clandestino' }); // Assuming 'projeto' mapping here
            onTriggerTelescopicAnalysis?.();
          }}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            btNetworkScenario?.mode === 'clandestino'
              ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/20" 
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {t.btnNewNetwork}
        </button>
      </div>

      {/* Toolbox Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Toolbox</span>
          <div className="h-px flex-1 mx-4 bg-gradient-to-r from-white/5 to-transparent" />
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <EditorToolButton 
            active={btEditorMode.mode === "none"} 
            onClick={() => setBtEditorMode({ mode: 'none' })} 
            icon={Navigation} 
            label={t.btnNavigate} 
            colorClass="ring-slate-500/50" 
          />
          <EditorToolButton 
            active={btEditorMode.mode === "move-pole"} 
            onClick={() => setBtEditorMode({ mode: 'move-pole' })} 
            icon={Move} 
            label={t.btnMove} 
            colorClass="ring-amber-500/50" 
          />
          <EditorToolButton 
            testId="btn-add-pole"
            active={btEditorMode.mode === "add-pole"} 
            onClick={() => setBtEditorMode({ mode: 'add-pole' })} 
            icon={MapPin} 
            label={t.btnAddPole} 
            colorClass="ring-blue-500/50" 
          />
          <EditorToolButton 
            active={btEditorMode.mode === "add-edge"} 
            onClick={() => { clearPendingBtEdge(); setBtEditorMode({ mode: 'add-edge' }); }} 
            icon={GitCommit} 
            label={t.btnAddEdge} 
            colorClass="ring-emerald-500/50" 
          />
          <EditorToolButton 
            active={btEditorMode.mode === "add-transformer"} 
            onClick={() => setBtEditorMode({ mode: 'add-transformer' })} 
            icon={Zap} 
            label={t.btnAddTransformer} 
            colorClass="ring-violet-500/50" 
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {btEditorMode.mode === "add-pole" && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={(e) => {
              e.preventDefault();
              handleBtInsertPoleByCoordinates();
            }}
            className="rounded-[2rem] border border-blue-500/20 bg-blue-500/5 p-5 space-y-4 shadow-2xl shadow-blue-500/5"
          >
            <div className="flex items-center gap-2 text-blue-400">
               <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <Plus size={14} strokeWidth={3} />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest">{t.insertPoleCoordinatesTitle}</span>
            </div>

            <div className="relative">
              <input
                id="bt-coordinate-input"
                type="text"
                autoFocus
                value={btPoleCoordinateInput}
                onChange={(e) => setBtPoleCoordinateInput(e.target.value)}
                placeholder="-22.9068, -43.1729"
                className={`w-full rounded-2xl border-2 bg-slate-950/50 p-4 text-xs font-mono font-bold text-white shadow-inner transition-all outline-none ring-offset-slate-900 focus:ring-2 focus:ring-blue-500/40 ${getValidationInputClassName(coordinateValidation.state, "dark")}`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {btPoleCoordinateInput && (
                  <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${coordinateValidation.state === "success" ? "bg-emerald-500 shadow-emerald-500" : "bg-rose-500 shadow-rose-500"}`} />
                )}
              </div>
            </div>

            <FormFieldMessage
              tone={coordinateValidation.state}
              message={coordinateValidation.message}
              palette="dark"
            />

            <button
              type="submit"
              disabled={!coordinateValidation.isValid}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all active:scale-95"
            >
              {t.insertPoleCoordinatesBtn}
            </button>
          </motion.form>
        )}

        {btEditorMode.mode === "move-pole" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3"
          >
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div className="space-y-1">
              <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{t.dragPoleTitle}</div>
              <p className="text-[10px] font-bold text-amber-200/60 leading-relaxed uppercase">{t.dragPoleHelp}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contextual Messages */}
      {btNetworkScenario?.mode === 'ramal' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black uppercase text-cyan-400 tracking-widest">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          {t.actualNetworkActiveMsg}
        </div>
      )}

      {selectedPoleIds.length > 1 && (
        <SidebarBulkEditSection
          selectedPoleIds={selectedPoleIds}
          onSetPoleChangeFlag={handleBtSetPoleChangeFlag}
          onClearSelection={() => onSetSelectedPoleIds?.([])}
        />
      )}

      <div className="h-px bg-white/5" />

      <Suspense fallback={<InlineSuspenseFallback label={t.loadingBtPanel} />}>
        <BtTopologyPanel
          locale={locale}
          btTopology={btTopology}
          accumulatedByPole={btAccumulatedByPole}
          summary={btSummary}
          pointDemandKva={btPointDemandKva}
          projectType={settings.projectType ?? "ramais"}
          btNetworkScenario={btNetworkScenario?.mode === 'clandestino' ? 'projeto' : 'asis'}
          clandestinoAreaM2={settings.clandestinoAreaM2 ?? 0}
          transformerDebugById={btTransformerDebugById}
          onTopologyChange={updateBtTopology}
          onSelectedPoleChange={handleBtSelectedPoleChange}
          onSelectedTransformerChange={handleBtSelectedTransformerChange}
          onSelectedEdgeChange={handleBtSelectedEdgeChange}
          onProjectTypeChange={updateProjectType}
          onClandestinoAreaChange={updateClandestinoAreaM2}
          onBtRenamePole={handleBtRenamePole}
          onBtRenameTransformer={handleBtRenameTransformer}
          onBtSetEdgeChangeFlag={handleBtSetEdgeChangeFlag}
          onBtSetPoleChangeFlag={handleBtSetPoleChangeFlag}
          onBtTogglePoleCircuitBreak={handleBtTogglePoleCircuitBreak}
          onBtSetTransformerChangeFlag={handleBtSetTransformerChangeFlag}
          clandestinoDisplay={btClandestinoDisplay}
          transformersDerived={btTransformersDerived}
          onRequestCriticalConfirmation={requestCriticalConfirmation}
          selectedPoleId={selectedPoleId}
          selectedPoleIds={selectedPoleIds}
          selectedEdgeId={selectedEdgeId}
          selectedTransformerId={selectedTransformerId}
          onSetSelectedPoleId={onSetSelectedPoleId}
          onSetSelectedPoleIds={onSetSelectedPoleIds}
          onSetSelectedEdgeId={onSetSelectedEdgeId}
          onSetSelectedTransformerId={onSetSelectedTransformerId}
          mtTopology={useTopology().mtTopology}
        />
      </Suspense>

      {/* Dangerous Actions Area */}
      <div className="pt-6 border-t border-white/5 space-y-4">
         <button
          data-testid="btn-reset-bt"
          onClick={handleResetBtTopology}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.25em] active:scale-95"
        >
          <RefreshCcw size={14} />
          {t.resetBtTopologyBtn}
        </button>
      </div>

      {/* Design Generativo & MT Router (Hidden if not active) */}
      <AnimatePresence>
        {flags.enableDgWizard && onRunDgOptimization && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-4"
          >
            <div className="h-px bg-white/5 mb-6" />
            <Suspense fallback={<InlineSuspenseFallback label={t.loadingBtPanel} />}>
              <DgOptimizationPanel
                locale={locale}
                hasPoles={effectiveDgTopology.poles.length > 0}
                poles={effectiveDgTopology.poles}
                currentTransformer={effectiveDgTopology.transformers[0]}
                currentTotalCableLengthMeters={currentTotalCableLengthMeters}
                hasTransformer={effectiveDgTopology.transformers.length > 0}
                hasProjectedPoles={effectiveDgTopology.poles.some(
                  (p) => p.nodeChangeFlag === "new",
                )}
                isOptimizing={isDgOptimizing}
                result={dgResult}
                error={dgError}
                activeAltIndex={dgActiveAltIndex}
                onSetActiveAltIndex={onSetDgActiveAltIndex ?? (() => undefined)}
                isPreviewActive={dgIsPreviewActive}
                onSetIsPreviewActive={onSetDgIsPreviewActive ?? (() => undefined)}
                onRun={onRunDgOptimization}
                onAcceptAll={onAcceptDgAll ?? (() => undefined)}
                onAcceptTrafoOnly={onAcceptDgTrafoOnly ?? (() => undefined)}
                onDiscard={onClearDgResult ?? (() => undefined)}
                onRemediateCqt={handleRemediateCqt}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {mtRouterState && onMtRouterCalculate && (
        <div className="pt-4">
          <div className="h-px bg-white/5 mb-6" />
          <Suspense fallback={<InlineSuspenseFallback label={t.loadingBtPanel} />}>
            <MtRouterPanel
              state={mtRouterState}
              onSetSelectionMode={onMtRouterSetSelectionMode ?? (() => undefined)}
              onRemoveTerminal={onMtRouterRemoveTerminal ?? (() => undefined)}
              onSetMaxSnapDistance={
                onMtRouterSetMaxSnapDistance ?? (() => undefined)
              }
              onSetNetworkProfile={
                onMtRouterSetNetworkProfile ?? (() => undefined)
              }
              onSetMtCqtParams={onMtRouterSetMtCqtParams ?? (() => undefined)}
              onUploadKmz={onMtRouterUploadKmz ?? (() => undefined)}
              onCalculate={onMtRouterCalculate}
              onApply={onMtRouterApplyProject ?? (() => undefined)}
              onReset={onMtRouterReset ?? (() => undefined)}
            />
          </Suspense>
        </div>
      )}
    </motion.div>
  );
}
