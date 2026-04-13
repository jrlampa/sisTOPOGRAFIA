import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import {
  FormFieldMessage,
  getValidationInputClassName,
} from "./FormFieldFeedback";
import type {
  AppSettings,
  BtEditorMode,
  BtNetworkScenario,
  BtTopology,
} from "../types";
import type {
  BtDerivedSummary,
  BtPoleAccumulatedDemand,
  BtClandestinoDisplay,
  BtTransformerDerived,
} from "../services/btDerivedService";
import type { PendingNormalClassificationPole } from "../utils/btNormalization";
import type {
  BtEdgeChangeFlag,
  BtPoleChangeFlag,
  BtTransformerChangeFlag,
} from "../utils/btNormalization";
import { getCoordinateInputFeedback } from "../utils/validation";
import type { CriticalConfirmationConfig } from "./BtModals";

const BtTopologyPanel = React.lazy(() => import("./BtTopologyPanel"));

type TransformerDebugById = Record<
  string,
  { assignedClients: number; estimatedDemandKw: number }
>;

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

export interface SidebarBtEditorSectionProps {
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
  updateProjectType: (type: "ramais" | "clandestino") => void;
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
}

export function SidebarBtEditorSection({
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
}: SidebarBtEditorSectionProps) {
  const coordinateValidation = getCoordinateInputFeedback(
    btPoleCoordinateInput,
  );

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Editor BT
          </label>
          <span className="text-[9px] text-slate-400 uppercase">
            {(settings.projectType ?? "ramais").toUpperCase()} /{" "}
            {btNetworkScenario === "asis" ? "ATUAL" : "PROJETO"}
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
            className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btNetworkScenario === "asis" ? "bg-cyan-700 text-white border-cyan-500" : "text-slate-400 border-white/5 hover:text-slate-200"}`}
          >
            REDE ATUAL
          </button>
          <button
            onClick={() =>
              updateSettings({ ...settings, btNetworkScenario: "projeto" })
            }
            className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btNetworkScenario === "projeto" ? "bg-indigo-700 text-white border-indigo-500" : "text-slate-400 border-white/5 hover:text-slate-200"}`}
          >
            REDE NOVA
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "none" })
            }
            className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === "none" ? "bg-slate-800 text-slate-100 border-white/10" : "text-slate-500 border-white/5 hover:text-slate-300"}`}
          >
            NAVEGAR
          </button>
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "move-pole" })
            }
            className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === "move-pole" ? "bg-amber-600 text-white border-amber-500" : "text-slate-500 border-white/5 hover:text-slate-300"}`}
          >
            MOVER
          </button>
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "add-pole" })
            }
            className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === "add-pole" ? "bg-blue-600 text-white border-blue-500" : "text-slate-500 border-white/5 hover:text-slate-300"}`}
          >
            + POSTE
          </button>
          <button
            onClick={() => {
              clearPendingBtEdge();
              updateSettings({ ...settings, btEditorMode: "add-edge" });
            }}
            className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === "add-edge" ? "bg-emerald-600 text-white border-emerald-500" : "text-slate-500 border-white/5 hover:text-slate-300"}`}
          >
            + CONDUTOR
          </button>
          <button
            onClick={() =>
              updateSettings({ ...settings, btEditorMode: "add-transformer" })
            }
            className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${btEditorMode === "add-transformer" ? "bg-violet-600 text-white border-violet-500" : "text-slate-500 border-white/5 hover:text-slate-300"}`}
          >
            + TRAFO
          </button>
        </div>

        {btEditorMode === "add-pole" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBtInsertPoleByCoordinates();
            }}
            className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 space-y-2 transition-all"
          >
            <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider">
              Inserir poste por coordenadas
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
                className={`w-full rounded-lg border bg-slate-900/90 p-2.5 text-[11px] font-mono transition-all outline-none shadow-[0_0_10px_rgba(15,23,42,0.18)] ${getValidationInputClassName(coordinateValidation.state)}`}
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
              INSERIR POR COORDENADA
            </button>
          </form>
        )}

        {btEditorMode === "move-pole" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium leading-snug text-amber-900 shadow-sm">
            <div>Arraste fino de poste:</div>
            <div>Clique e segure no poste para ajustar a posicao no mapa.</div>
          </div>
        )}

        {btNetworkScenario === "asis" && (
          <div className="text-[10px] text-cyan-900 bg-cyan-50 border border-cyan-300 rounded-lg p-2">
            Rede Atual ativa: você pode navegar e lançar poste, condutor e trafo
            na topologia existente.
          </div>
        )}
        {settings.projectType === "clandestino" && (
          <div className="text-[10px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-lg p-2">
            Área clandestina: {settings.clandestinoAreaM2 ?? 0} m²
          </div>
        )}
        {settings.projectType !== "clandestino" &&
          pendingNormalClassificationPoles.length > 0 && (
            <div className="text-[10px] text-rose-300 bg-rose-900/20 border border-rose-500/30 rounded-lg p-2">
              Classificação pendente em{" "}
              {pendingNormalClassificationPoles.length} poste(s). DXF bloqueado
              até classificar.
            </div>
          )}

        <button
          onClick={handleResetBtTopology}
          className="w-full text-[10px] font-bold py-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 transition-all"
          title="Remover toda a topologia BT"
        >
          ZERAR BT (LIMPAR TUDO)
        </button>
      </div>

      <div className="h-px bg-white/5 mx-2" />

      <Suspense
        fallback={<InlineSuspenseFallback label="Carregando painel BT" />}
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
    </>
  );
}
