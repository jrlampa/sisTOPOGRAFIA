import React, { Suspense, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  FormFieldMessage,
  getValidationInputClassName,
} from "./FormFieldFeedback";
import { DgOptimizationPanel } from "./DgOptimizationPanel";
import MtRouterPanel from "./MtRouterPanel";
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

const BtTopologyPanel = React.lazy(() =>
  lazyWithRetry(() => import("./BtTopologyPanel")),
);

import { SidebarBulkEditSection } from "./SidebarBulkEditSection";

type TransformerDebugById = Record<
  string,
  { assignedClients: number; estimatedDemandKva: number }
>;

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-amber-800/25 bg-amber-50 p-4 text-xs font-semibold uppercase tracking-wide text-amber-900 shadow-[4px_4px_0_rgba(124,45,18,0.16)] dark:border-amber-500/45 dark:bg-zinc-900 dark:text-amber-100 dark:shadow-[4px_4px_0_rgba(251,146,60,0.22)]">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

export interface SidebarBtEditorSectionProps {
  locale: AppLocale;
  settings: AppSettings;
  setBtNetworkScenario: (scenario: BtNetworkScenario) => void;
  setBtEditorMode: (mode: BtEditorMode) => void;
  btNetworkScenario: BtNetworkScenario;
  btEditorMode: BtEditorMode;
  btTopology: BtTopology;
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
  updateBtTopology: (topology: BtTopology) => void;
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
  mtTopology: MtTopology;
}

export function SidebarBtEditorSection({
  locale,
  settings,
  setBtNetworkScenario,
  setBtEditorMode,
  btNetworkScenario,
  btEditorMode,
  btTopology,
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
  updateBtTopology,
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
  mtTopology,
}: SidebarBtEditorSectionProps) {
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
    <>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-sm font-black uppercase tracking-[0.2em] text-amber-900/80 dark:text-amber-100/60">
            {t.editorTitle}
          </label>
          <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
            {(settings.projectType ?? "ramais").toUpperCase()} /{" "}
            {btNetworkScenario === "asis"
              ? t.scenarioActual
              : t.scenarioProject}
          </span>
        </div>

        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Seleção de cenário de rede"
        >
          <button
            onClick={() => {
              setBtNetworkScenario("asis");
              setBtEditorMode("none");
            }}
            aria-pressed={btNetworkScenario === "asis"}
            className={`rounded-xl border-2 py-2 text-xs font-black transition-all ${btNetworkScenario === "asis" ? "border-cyan-600 bg-cyan-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnActualNetwork}
          </button>
          <button
            onClick={() => {
              setBtNetworkScenario("projeto");
              onTriggerTelescopicAnalysis?.();
            }}
            aria-pressed={btNetworkScenario === "projeto"}
            className={`rounded-xl border-2 py-2 text-xs font-black transition-all ${btNetworkScenario === "projeto" ? "border-fuchsia-600 bg-fuchsia-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnNewNetwork}
          </button>
        </div>

        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="Modos de edição de topologia"
        >
          <button
            onClick={() => setBtEditorMode("none")}
            aria-pressed={btEditorMode === "none"}
            className={`rounded-xl border-2 py-2 text-xs font-black transition-all ${btEditorMode === "none" ? "border-slate-900 bg-slate-900 text-slate-100 dark:border-slate-700 dark:bg-zinc-800" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnNavigate}
          </button>
          <button
            onClick={() => setBtEditorMode("move-pole")}
            aria-pressed={btEditorMode === "move-pole"}
            className={`rounded-xl border-2 py-2 text-xs font-black transition-all ${btEditorMode === "move-pole" ? "border-amber-600 bg-amber-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnMove}
          </button>
          <button
            onClick={() => setBtEditorMode("add-pole")}
            aria-pressed={btEditorMode === "add-pole"}
            className={`rounded-xl border-2 py-2 text-xs font-black transition-all ${btEditorMode === "add-pole" ? "border-blue-600 bg-blue-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnAddPole}
          </button>
          <button
            onClick={() => {
              clearPendingBtEdge();
              setBtEditorMode("add-edge");
            }}
            aria-pressed={btEditorMode === "add-edge"}
            className={`rounded-xl border-2 py-2 text-xs font-black transition-all ${btEditorMode === "add-edge" ? "border-emerald-600 bg-emerald-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnAddEdge}
          </button>
          <button
            onClick={() => setBtEditorMode("add-transformer")}
            aria-pressed={btEditorMode === "add-transformer"}
            className={`rounded-xl border-2 py-2 text-xs font-black transition-all ${btEditorMode === "add-transformer" ? "border-violet-600 bg-violet-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnAddTransformer}
          </button>
        </div>

        {btEditorMode === "add-pole" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBtInsertPoleByCoordinates();
            }}
            aria-labelledby="bt-add-pole-title"
            className="rounded-xl border-2 border-blue-700/35 bg-blue-50 p-2.5 space-y-2 transition-all dark:border-blue-500/40 dark:bg-blue-950/25"
          >
            <div
              id="bt-add-pole-title"
              className="text-xs font-bold text-blue-800 dark:text-blue-200 uppercase tracking-widest"
            >
              {t.insertPoleCoordinatesTitle}
            </div>
            <div className="relative group">
              <input
                id="bt-coordinate-input"
                type="text"
                value={btPoleCoordinateInput}
                onChange={(e) => {
                  setBtPoleCoordinateInput(e.target.value);
                }}
                placeholder="-22.9068 -43.1729 ou 23K 635806 7462003"
                aria-label="Coordenadas do poste"
                aria-describedby="bt-coordinate-feedback"
                className={`w-full rounded-xl border-2 border-blue-700/25 bg-white p-2.5 text-xs font-semibold text-blue-950 shadow-inner transition-all outline-none placeholder-blue-600 dark:border-blue-500/45 dark:bg-zinc-950 dark:text-blue-100 dark:placeholder-blue-300/60 ${getValidationInputClassName(coordinateValidation.state, settings.theme === "dark" ? "dark" : "light")}`}
              />
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center"
                aria-hidden="true"
              >
                {btPoleCoordinateInput &&
                  (coordinateValidation.state === "success" ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  ))}
              </div>
            </div>
            <FormFieldMessage
              id="bt-coordinate-feedback"
              tone={coordinateValidation.state}
              message={coordinateValidation.message}
              palette={settings.theme === "dark" ? "dark" : "light"}
            />
            <button
              type="submit"
              disabled={!coordinateValidation.isValid}
              className="w-full rounded-lg border border-blue-500 bg-blue-600 px-2 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.insertPoleCoordinatesBtn}
            </button>
          </form>
        )}

        {btEditorMode === "move-pole" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium leading-snug text-amber-900 shadow-sm">
            <div>{t.dragPoleTitle}</div>
            <div>{t.dragPoleHelp}</div>
          </div>
        )}

        {btNetworkScenario === "asis" && (
          <div className="text-xs text-cyan-900 bg-cyan-50 border border-cyan-300 rounded-lg p-2">
            {t.actualNetworkActiveMsg}
          </div>
        )}
        {settings.projectType === "clandestino" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
            {t.clandestineAreaMsg(settings.clandestinoAreaM2 ?? 0)}
          </div>
        )}
        {settings.projectType !== "clandestino" &&
          pendingNormalClassificationPoles.length > 0 && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-300">
              {t.pendingClassificationMsg(
                pendingNormalClassificationPoles.length,
              )}
            </div>
          )}

        <button
          onClick={handleResetBtTopology}
          className="w-full rounded-xl border border-rose-300 py-2 text-xs font-bold text-rose-700 transition-all hover:bg-rose-50 dark:border-rose-700/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
          title={t.resetBtTopologyTitle}
        >
          {t.resetBtTopologyBtn}
        </button>
      </div>

      {selectedPoleIds.length > 1 && (
        <SidebarBulkEditSection
          selectedPoleIds={selectedPoleIds}
          onSetPoleChangeFlag={handleBtSetPoleChangeFlag}
          onClearSelection={() => onSetSelectedPoleIds?.([])}
        />
      )}

      <div className="mx-2 h-px bg-amber-800/20 dark:bg-amber-500/30" />

      <Suspense fallback={<InlineSuspenseFallback label={t.loadingBtPanel} />}>
        <BtTopologyPanel
          locale={locale}
          btTopology={btTopology}
          accumulatedByPole={btAccumulatedByPole}
          summary={btSummary}
          pointDemandKva={btPointDemandKva}
          projectType={settings.projectType ?? "ramais"}
          btNetworkScenario={btNetworkScenario}
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
          mtTopology={mtTopology}
        />
      </Suspense>

      {/* Design Generativo – painel de otimização (Frente 3) */}
      {onRunDgOptimization && (
        <>
          <div className="mx-2 h-px bg-amber-800/20 dark:bg-amber-500/30" />
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
        </>
      )}

      {/* MT Router – roteamento de rede MT sobre malha viária */}
      {mtRouterState && onMtRouterCalculate && (
        <>
          <div className="mx-2 h-px bg-amber-800/20 dark:bg-amber-500/30" />
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
            onUploadKmz={onMtRouterUploadKmz ?? (() => undefined)}
            onCalculate={onMtRouterCalculate}
            onApply={onMtRouterApplyProject ?? (() => undefined)}
            onReset={onMtRouterReset ?? (() => undefined)}
          />
        </>
      )}
    </>
  );
}
