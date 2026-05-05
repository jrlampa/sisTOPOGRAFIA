/**
 * MtRouterPanel – Painel de Roteamento MT sobre malha viária.
 *
 * Permite ao usuário:
 *   1. Importar KMZ com source, terminais e corredores viários
 *   2. Selecionar interativamente o ponto de origem e terminais no mapa
 *   3. Configurar o padrão de rede MT (condutor + estrutura) — BIM metadata
 *   4. Executar o cálculo de roteamento via POST /api/dg/mt-router
 *   5. Visualizar resultado (total + distância por perna — orçamentação)
 *   6. Aplicar o traçado ao projeto (Persistência — "Aplicar Projeto MT")
 *
 * Referência: STRATEGIC_ROADMAP_2026 – MT Router Phase 2
 */

import React, { useRef } from "react";
import {
  Route,
  MapPin,
  Crosshair,
  UploadCloud,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCcw,
  Navigation,
  Save,
  ChevronRight,
} from "lucide-react";
import type {
  MtRouterState,
  MtSelectionMode,
  MtRouterResult,
  MtTerminal,
  MtNetworkProfile,
} from "../hooks/useMtRouter";
import { MT_NETWORK_PROFILES } from "../hooks/useMtRouter";
import { getMtRouterText } from "../i18n/mtRouterText";
import type { AppLocale } from "../types";

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MtRouterPanelProps {
  state: MtRouterState;
  locale?: AppLocale;
  onSetSelectionMode: (mode: MtSelectionMode) => void;
  onRemoveTerminal: (id: string) => void;
  onSetMaxSnapDistance: (m: number) => void;
  onSetNetworkProfile: (profile: MtNetworkProfile) => void;
  onSetMtCqtParams: (params: {
    voltageKv: number;
    cqtLimitFraction: number;
  }) => void;
  onUploadKmz: (file: File) => void;
  onCalculate: () => void;
  onApply: () => void;
  onReset: () => void;
}

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all
        ${
          active
            ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        }`}
    >
      {children}
    </button>
  );
}

function TerminalRow({
  terminal,
  onRemove,
}: {
  terminal: MtTerminal;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs text-zinc-600 dark:text-zinc-300">
      <span className="flex items-center gap-1">
        <MapPin size={10} className="text-cyan-500" />
        <span className="font-mono">
          {terminal.name ?? terminal.id} ({terminal.position.lat.toFixed(4)},{" "}
          {terminal.position.lon.toFixed(4)})
        </span>
      </span>
      <button
        onClick={onRemove}
        className="ml-2 text-zinc-400 hover:text-red-500 transition-colors"
        title="Remover terminal"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

function ResultCard({
  result,
  t,
  onApply,
  isApplying,
}: {
  result: MtRouterResult;
  t: ReturnType<typeof getMtRouterText>;
  onApply: () => void;
  isApplying: boolean;
}) {
  const criticalPoles = result.poleDiagnostics.filter(
    (pole) => pole.severity !== "normal",
  );

  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        result.feasible
          ? "border-emerald-300/50 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          : "border-red-300/50 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/20"
      }`}
    >
      {/* ── Status ── */}
      <div className="flex items-center gap-2">
        {result.feasible ? (
          <CheckCircle2
            size={14}
            className="text-emerald-600 dark:text-emerald-400"
          />
        ) : (
          <XCircle size={14} className="text-red-600 dark:text-red-400" />
        )}
        <span
          className={`text-xs font-black uppercase tracking-wider ${
            result.feasible
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {result.feasible ? t.resultFeasible : t.resultInfeasible}
        </span>
      </div>

      {/* ── Métricas totais ── */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="text-zinc-500 dark:text-zinc-400">
          {t.resultTerminals}
        </div>
        <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">
          {result.connectedTerminals}
        </div>

        <div className="text-zinc-500 dark:text-zinc-400">
          {t.resultTotalLength}
        </div>
        <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">
          {(result.totalEdgeLengthMeters / 1000).toFixed(2)} km
        </div>

        <div className="text-zinc-500 dark:text-zinc-400">
          {t.resultSegments}
        </div>
        <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">
          {result.edges.length}
        </div>
      </div>

      {/* ── Distância por perna (segmentada) ── */}
      {result.paths.length > 0 && (
        <div className="rounded-lg bg-white/60 border border-zinc-200/60 p-2 space-y-1 dark:bg-zinc-900/40 dark:border-zinc-700/40">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
            {t.resultSegmentedTitle}
          </div>
          {result.paths.map((path) => (
            <div
              key={path.terminalId}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                <ChevronRight size={9} className="text-cyan-500 shrink-0" />
                <span className="font-mono">{path.terminalId}</span>
              </span>
              <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
                {path.totalDistanceMeters >= 1000
                  ? `${(path.totalDistanceMeters / 1000).toFixed(2)} km`
                  : `${path.totalDistanceMeters.toFixed(0)} m`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Terminais não alcançados ── */}
      {result.unreachableTerminals.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-2 dark:bg-amber-950/20 dark:border-amber-800/30">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
            {t.resultUnreachable}
          </div>
          {result.unreachableTerminals.map((id) => (
            <div
              key={id}
              className="text-[11px] text-amber-800 dark:text-amber-300 font-mono"
            >
              • {id}
            </div>
          ))}
        </div>
      )}

      {(result.engineeringWarnings.length > 0 || criticalPoles.length > 0) && (
        <div className="rounded-lg border border-orange-200/60 bg-orange-50/70 p-2 dark:border-orange-800/30 dark:bg-orange-950/20">
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-300">
            {t.resultEngineering}
          </div>
          {criticalPoles.length > 0 && (
            <div className="mb-2 text-[11px] text-orange-900 dark:text-orange-200">
              <span className="font-black">{t.resultCriticalPoles}:</span>{" "}
              {criticalPoles.length}
            </div>
          )}
          <div className="space-y-1">
            {result.engineeringWarnings.slice(0, 5).map((warning, index) => (
              <div
                key={`${warning}-${index}`}
                className="text-[11px] text-orange-900 dark:text-orange-200"
              >
                • {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-sky-200/60 bg-sky-50/70 p-2 dark:border-sky-800/30 dark:bg-sky-950/20">
        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
          {t.resultCqtReady}
        </div>
        <div className="text-[11px] text-sky-900 dark:text-sky-200">
          {result.mtCqtReadiness.note}
        </div>
        {result.mtCqtReadiness.pendingInputs.length > 0 && (
          <div className="mt-1 text-[10px] text-sky-800/80 dark:text-sky-200/80">
            Inputs pendentes: {result.mtCqtReadiness.pendingInputs.join(", ")}
          </div>
        )}
      </div>

      {/* ── Botão Aplicar ── */}
      {result.feasible && result.mtTopologyDraft && (
        <button
          onClick={onApply}
          disabled={isApplying}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all mt-1
            ${
              isApplying
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600"
                : "bg-emerald-600 text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-700 hover:shadow-emerald-500/50"
            }`}
        >
          {isApplying ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              {t.btnApplying}
            </>
          ) : (
            <>
              <Save size={12} />
              {t.btnApply}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

const MtRouterPanel: React.FC<MtRouterPanelProps> = ({
  state,
  locale = "pt-BR",
  onSetSelectionMode,
  onRemoveTerminal,
  onSetMaxSnapDistance,
  onSetNetworkProfile,
  onSetMtCqtParams,
  onUploadKmz,
  onCalculate,
  onApply,
  onReset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getMtRouterText(locale);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadKmz(file);
      e.target.value = "";
    }
  };

  const isReady =
    state.source !== null &&
    state.terminals.length > 0 &&
    state.roadCorridors.length > 0 &&
    !state.isCalculating;

  return (
    <div className="space-y-3 text-sm">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route size={14} className="text-blue-500" />
          <span className="font-black text-xs uppercase tracking-wider text-blue-700 dark:text-blue-300">
            {t.title}
          </span>
        </div>
        <button
          onClick={onReset}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          title={t.btnReset}
        >
          <RefreshCcw size={12} />
        </button>
      </div>

      {/* ── Upload KMZ ── */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".kmz,.kml"
          className="hidden"
          title={t.btnImportKmz}
          aria-label={t.btnImportKmz}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={state.isParsingKmz}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 py-2 text-xs font-bold text-blue-600 transition-all hover:bg-blue-100/60 hover:border-blue-400 dark:border-blue-800/50 dark:bg-blue-950/10 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
        >
          {state.isParsingKmz ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <UploadCloud size={12} />
          )}
          {state.isParsingKmz ? t.btnParsingKmz : t.btnImportKmz}
        </button>
        {state.kmzWarnings.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {state.kmzWarnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-1 text-[10px] text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle size={9} className="mt-0.5 shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Seleção interativa ── */}
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
          Seleção no mapa
        </div>
        <div className="flex gap-2">
          <ModeButton
            active={state.selectionMode === "picking_source"}
            onClick={() =>
              onSetSelectionMode(
                state.selectionMode === "picking_source"
                  ? "idle"
                  : "picking_source",
              )
            }
            title={t.hintPickSource}
          >
            <Navigation size={10} />
            {t.btnPickSource}
          </ModeButton>
          <ModeButton
            active={state.selectionMode === "picking_terminals"}
            onClick={() =>
              onSetSelectionMode(
                state.selectionMode === "picking_terminals"
                  ? "idle"
                  : "picking_terminals",
              )
            }
            title={t.hintPickTerminals}
          >
            <Crosshair size={10} />
            {t.btnPickTerminals}
          </ModeButton>
        </div>

        {state.selectionMode !== "idle" && (
          <div className="rounded-lg bg-blue-50 border border-blue-200/60 px-2 py-1.5 dark:bg-blue-950/20 dark:border-blue-800/30">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
              {state.selectionMode === "picking_source"
                ? t.hintPickSource
                : t.hintPickTerminals}
            </span>
          </div>
        )}
      </div>

      {/* ── Origem selecionada ── */}
      <div>
        <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1">
          {t.labelSource}
        </div>
        {state.source ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
            <Navigation size={10} className="text-blue-500 shrink-0" />
            <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
              {state.source.lat.toFixed(5)}, {state.source.lon.toFixed(5)}
            </span>
          </div>
        ) : (
          <div className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
            {t.sourceEmpty}
          </div>
        )}
      </div>

      {/* ── Terminais ── */}
      <div>
        <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1">
          {t.labelTerminals} ({state.terminals.length})
        </div>
        {state.terminals.length === 0 ? (
          <div className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
            {t.terminalsEmpty}
          </div>
        ) : (
          <div className="max-h-28 overflow-y-auto space-y-0.5 rounded-lg bg-zinc-50 p-1.5 dark:bg-zinc-800/50">
            {state.terminals.map((t_) => (
              <TerminalRow
                key={t_.id}
                terminal={t_}
                onRemove={() => onRemoveTerminal(t_.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Corredores ── */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500 dark:text-zinc-400">
          {t.labelCorridors}
        </span>
        <span
          className={`font-bold ${
            state.roadCorridors.length > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-400"
          }`}
        >
          {t.corridorCount(state.roadCorridors.length)}
        </span>
      </div>

      {/* ── Snap distance ── */}
      <div>
        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
          {t.labelSnapMax}
        </label>
        <input
          type="number"
          min={10}
          max={1000}
          step={10}
          value={state.maxSnapDistanceMeters}
          onChange={(e) => onSetMaxSnapDistance(Number(e.target.value))}
          title={t.labelSnapMax}
          aria-label={t.labelSnapMax}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
      </div>

      {/* ── Padrão de rede MT (BIM metadata) ── */}
      <div>
        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
          {t.labelNetworkProfile}
        </label>
        <select
          value={`${state.networkProfile.conductorId}||${state.networkProfile.structureType}`}
          onChange={(e) => {
            const [conductorId, structureType] = e.target.value.split("||");
            onSetNetworkProfile({ conductorId, structureType });
          }}
          aria-label={t.labelNetworkProfile}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {MT_NETWORK_PROFILES.map((p) => (
            <option
              key={`${p.conductorId}||${p.structureType}`}
              value={`${p.conductorId}||${p.structureType}`}
            >
              {p.conductorId} — Estrutura {p.structureType}
            </option>
          ))}
        </select>
      </div>

      {/* ── Parâmetros CQT MT ── */}
      <div>
        <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1.5">
          {t.labelCqtParams}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {t.labelVoltageKv}
            </label>
            <input
              type="number"
              min={0.1}
              max={500}
              step={0.1}
              value={state.mtCqtParams.voltageKv}
              onChange={(e) =>
                onSetMtCqtParams({
                  ...state.mtCqtParams,
                  voltageKv: Number(e.target.value),
                })
              }
              aria-label={t.labelVoltageKv}
              className="mt-0.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {t.labelCqtLimitPct}
            </label>
            <input
              type="number"
              min={0.01}
              max={100}
              step={0.01}
              value={+(state.mtCqtParams.cqtLimitFraction * 100).toFixed(4)}
              onChange={(e) =>
                onSetMtCqtParams({
                  ...state.mtCqtParams,
                  cqtLimitFraction: Number(e.target.value) / 100,
                })
              }
              aria-label={t.labelCqtLimitPct}
              className="mt-0.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
        </div>
      </div>

      {/* ── Erro ── */}
      {state.error && (
        <div className="flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-200/60 px-2 py-1.5 dark:bg-red-950/10 dark:border-red-800/30">
          <XCircle size={11} className="text-red-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-red-700 dark:text-red-400">
            {state.error}
          </span>
        </div>
      )}

      {/* ── Botão calcular ── */}
      <button
        onClick={onCalculate}
        disabled={!isReady}
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all
          ${
            isReady
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/30 hover:bg-blue-700 hover:shadow-blue-500/50"
              : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600"
          }`}
      >
        {state.isCalculating ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            {t.btnCalculating}
          </>
        ) : (
          <>
            <Route size={12} />
            {t.btnCalculate}
          </>
        )}
      </button>

      {/* ── Resultado ── */}
      {state.result && (
        <ResultCard
          result={state.result}
          t={t}
          onApply={onApply}
          isApplying={state.isApplying}
        />
      )}
    </div>
  );
};

export default MtRouterPanel;
