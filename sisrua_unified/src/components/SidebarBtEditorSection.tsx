import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import {
  FormFieldMessage,
  getValidationInputClassName,
} from "./FormFieldFeedback";
import { DgOptimizationPanel } from "./DgOptimizationPanel";
import type {
  DgOptimizationOutput,
  DgScenario,
} from "../hooks/useDgOptimization";
import type {
  AppSettings,
  BtEditorMode,
  BtNetworkScenario,
  BtTopology,
  BtProjectType,
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
  updateSettings: (s: AppSettings) => void;
  btNetworkScenario: BtNetworkScenario;
  btEditorMode: BtEditorMode;
  btTopology: BtTopology;
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
  onRunDgOptimization?: () => void;
  onAcceptDgAll?: (scenario: DgScenario) => void;
  onAcceptDgTrafoOnly?: (scenario: DgScenario) => void;
  onClearDgResult?: () => void;
  onSetDgActiveAltIndex?: (index: number) => void;
}

export function SidebarBtEditorSection({
  locale,
  settings,
  updateSettings,
  btNetworkScenario,
  btEditorMode,
  btTopology,
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
}: SidebarBtEditorSectionProps) {
  const coordinateValidation = getCoordinateInputFeedback(
    btPoleCoordinateInput,
  );

  const t = getSidebarBtEditorText(locale);

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-800 dark:text-amber-100">
            {t.editorTitle}
          </label>
          <span className="text-[9px] uppercase text-amber-700 dark:text-amber-300">
            {(settings.projectType ?? "ramais").toUpperCase()} /{" "}
            {btNetworkScenario === "asis" ? t.scenarioActual : t.scenarioProject}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() =>
              updateSettings({
                ...settings,
                btNetworkScenario: "asis",
                btEditorMode: "none",
              })
            }
            className={`rounded-xl border-2 py-2 text-[10px] font-black transition-all ${btNetworkScenario === "asis" ? "border-cyan-600 bg-cyan-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnActualNetwork}
          </button>
          <button
            onClick={() => {
              updateSettings({ ...settings, btNetworkScenario: "projeto" });
              onTriggerTelescopicAnalysis?.();
            }}
            className={`rounded-xl border-2 py-2 text-[10px] font-black transition-all ${btNetworkScenario === "projeto" ? "border-fuchsia-600 bg-fuchsia-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnNewNetwork}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "none" })
            }
            className={`rounded-xl border-2 py-2 text-[10px] font-black transition-all ${btEditorMode === "none" ? "border-slate-900 bg-slate-900 text-slate-100 dark:border-slate-700 dark:bg-zinc-800" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnNavigate}
          </button>
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "move-pole" })
            }
            className={`rounded-xl border-2 py-2 text-[10px] font-black transition-all ${btEditorMode === "move-pole" ? "border-amber-600 bg-amber-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnMove}
          </button>
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "add-pole" })
            }
            className={`rounded-xl border-2 py-2 text-[10px] font-black transition-all ${btEditorMode === "add-pole" ? "border-blue-600 bg-blue-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnAddPole}
          </button>
          <button
            onClick={() => {
              clearPendingBtEdge();
              updateSettings({ ...settings, btEditorMode: "add-edge" });
            }}
            className={`rounded-xl border-2 py-2 text-[10px] font-black transition-all ${btEditorMode === "add-edge" ? "border-emerald-600 bg-emerald-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
          >
            {t.btnAddEdge}
          </button>
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "add-transformer" })
            }
            className={`rounded-xl border-2 py-2 text-[10px] font-black transition-all ${btEditorMode === "add-transformer" ? "border-violet-600 bg-violet-600 text-white" : "border-amber-800/25 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/45 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-zinc-900"}`}
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
            className="rounded-xl border-2 border-blue-700/35 bg-blue-50 p-2.5 space-y-2 transition-all dark:border-blue-500/40 dark:bg-blue-950/25"
          >
            <div className="text-[10px] font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wider">
              {t.insertPoleCoordinatesTitle}
            </div>
            <div className="relative group">
              <input
                type="text"
                value={btPoleCoordinateInput}
                onChange={(e) => {
                  setBtPoleCoordinateInput(e.target.value);
                }}
                placeholder="-22.9068 -43.1729 ou 23K 635806 7462003"
                aria-label="Coordenadas do poste"
                aria-describedby="bt-coordinate-feedback"
                className={`w-full rounded-xl border-2 border-blue-700/25 bg-white p-2.5 text-[11px] font-mono text-blue-950 shadow-inner transition-all outline-none placeholder-blue-400 dark:border-blue-500/45 dark:bg-zinc-950 dark:text-blue-100 dark:placeholder-blue-300/60 ${getValidationInputClassName(coordinateValidation.state)}`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center">
                {btPoleCoordinateInput &&
                  (coordinateValidation.state === "success" ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  ))}
              </div>
            </div>
            <FormFieldMessage
              id="bt-coordinate-feedback"
              tone={coordinateValidation.state}
              message={coordinateValidation.message}
            />
            <button
              type="submit"
              disabled={!coordinateValidation.isValid}
              className="w-full rounded-lg border border-blue-500 bg-blue-600 px-2 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="text-[10px] text-cyan-900 bg-cyan-50 border border-cyan-300 rounded-lg p-2">
            {t.actualNetworkActiveMsg}
          </div>
        )}
        {settings.projectType === "clandestino" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
            {t.clandestineAreaMsg(settings.clandestinoAreaM2 ?? 0)}
          </div>
        )}
        {settings.projectType !== "clandestino" &&
          pendingNormalClassificationPoles.length > 0 && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-[10px] text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-300">
              {t.pendingClassificationMsg(pendingNormalClassificationPoles.length)}
            </div>
          )}

        <button
          onClick={handleResetBtTopology}
          className="w-full rounded-xl border border-rose-300 py-2 text-[10px] font-bold text-rose-700 transition-all hover:bg-rose-50 dark:border-rose-700/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
          title={t.resetBtTopologyTitle}
        >
          {t.resetBtTopologyBtn}
        </button>
      </div>

      <div className="mx-2 h-px bg-amber-800/20 dark:bg-amber-500/30" />

      <Suspense
        fallback={<InlineSuspenseFallback label={t.loadingBtPanel} />}
      >
        <BtTopologyPanel
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
        />
      </Suspense>

      {/* Design Generativo – painel de otimização (Frente 3) */}
      {onRunDgOptimization && (
        <>
          <div className="mx-2 h-px bg-amber-800/20 dark:bg-amber-500/30" />
          <DgOptimizationPanel
            hasPoles={btTopology.poles.length > 0}
            hasTransformer={btTopology.transformers.length > 0}
            isOptimizing={isDgOptimizing}
            result={dgResult}
            error={dgError}
            activeAltIndex={dgActiveAltIndex}
            onSetActiveAltIndex={onSetDgActiveAltIndex ?? (() => undefined)}
            onRun={onRunDgOptimization}
            onAcceptAll={onAcceptDgAll ?? (() => undefined)}
            onAcceptTrafoOnly={onAcceptDgTrafoOnly ?? (() => undefined)}
            onDiscard={onClearDgResult ?? (() => undefined)}
          />
        </>
      )}
    </>
  );
}
