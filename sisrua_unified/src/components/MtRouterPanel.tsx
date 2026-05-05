/**
 * MtRouterPanel – Painel de Roteamento MT sobre malha viária.
 *
 * Permite ao usuário:
 *   1. Importar KMZ com source, terminais e corredores viários
 *   2. Selecionar interativamente o ponto de origem e terminais no mapa
 *   3. Executar o cálculo de roteamento via POST /api/dg/mt-router
 *   4. Visualizar o resultado (distância total, terminais alcançados)
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
} from "lucide-react";
import type {
  MtRouterState,
  MtSelectionMode,
  MtRouterResult,
  MtTerminal,
} from "../hooks/useMtRouter";

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MtRouterPanelProps {
  state: MtRouterState;
  onSetSelectionMode: (mode: MtSelectionMode) => void;
  onRemoveTerminal: (id: string) => void;
  onSetMaxSnapDistance: (m: number) => void;
  onUploadKmz: (file: File) => void;
  onCalculate: () => void;
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

function TerminalRow({ terminal, onRemove }: { terminal: MtTerminal; onRemove: () => void }) {
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

function ResultCard({ result }: { result: MtRouterResult }) {
  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        result.feasible
          ? "border-emerald-300/50 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          : "border-red-300/50 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/20"
      }`}
    >
      <div className="flex items-center gap-2">
        {result.feasible ? (
          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
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
          {result.feasible ? "Roteamento Viável" : "Roteamento Inviável"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="text-zinc-500 dark:text-zinc-400">Terminais conectados</div>
        <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">
          {result.connectedTerminals}
        </div>

        <div className="text-zinc-500 dark:text-zinc-400">Comprimento total</div>
        <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">
          {(result.totalEdgeLengthMeters / 1000).toFixed(2)} km
        </div>

        <div className="text-zinc-500 dark:text-zinc-400">Segmentos de rota</div>
        <div className="font-bold text-zinc-800 dark:text-zinc-200 text-right">
          {result.edges.length}
        </div>
      </div>

      {result.unreachableTerminals.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200/60 p-2 dark:bg-amber-950/20 dark:border-amber-800/30">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
            Terminais não alcançados
          </div>
          {result.unreachableTerminals.map((id) => (
            <div key={id} className="text-[11px] text-amber-800 dark:text-amber-300 font-mono">
              • {id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

const MtRouterPanel: React.FC<MtRouterPanelProps> = ({
  state,
  onSetSelectionMode,
  onRemoveTerminal,
  onSetMaxSnapDistance,
  onUploadKmz,
  onCalculate,
  onReset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadKmz(file);
      // Reset input so same file can be re-uploaded
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
            MT Router
          </span>
        </div>
        <button
          onClick={onReset}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          title="Limpar tudo"
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
          title="Selecionar arquivo KMZ ou KML"
          aria-label="Selecionar arquivo KMZ ou KML"
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
          {state.isParsingKmz ? "Processando KMZ…" : "Importar KMZ / KML"}
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
                state.selectionMode === "picking_source" ? "idle" : "picking_source",
              )
            }
            title="Clique no mapa para definir origem MT"
          >
            <Navigation size={10} />
            Origem
          </ModeButton>
          <ModeButton
            active={state.selectionMode === "picking_terminals"}
            onClick={() =>
              onSetSelectionMode(
                state.selectionMode === "picking_terminals" ? "idle" : "picking_terminals",
              )
            }
            title="Clique no mapa para adicionar terminais"
          >
            <Crosshair size={10} />
            Terminais
          </ModeButton>
        </div>

        {state.selectionMode !== "idle" && (
          <div className="rounded-lg bg-blue-50 border border-blue-200/60 px-2 py-1.5 dark:bg-blue-950/20 dark:border-blue-800/30">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
              {state.selectionMode === "picking_source"
                ? "Clique no mapa para definir o ponto de origem da MT"
                : "Clique no mapa para adicionar terminais. Clique em 'Terminais' novamente para parar."}
            </span>
          </div>
        )}
      </div>

      {/* ── Origem selecionada ── */}
      <div>
        <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1">
          Origem MT
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
            Não definida — importe KMZ ou selecione no mapa
          </div>
        )}
      </div>

      {/* ── Terminais ── */}
      <div>
        <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mb-1">
          Terminais ({state.terminals.length})
        </div>
        {state.terminals.length === 0 ? (
          <div className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
            Nenhum terminal — importe KMZ ou adicione no mapa
          </div>
        ) : (
          <div className="max-h-28 overflow-y-auto space-y-0.5 rounded-lg bg-zinc-50 p-1.5 dark:bg-zinc-800/50">
            {state.terminals.map((t) => (
              <TerminalRow key={t.id} terminal={t} onRemove={() => onRemoveTerminal(t.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Corredores ── */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500 dark:text-zinc-400">Corredores viários</span>
        <span
          className={`font-bold ${
            state.roadCorridors.length > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-400"
          }`}
        >
          {state.roadCorridors.length} segmentos
        </span>
      </div>

      {/* ── Snap distance ── */}
      <div>
        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
          Snap max (m)
        </label>
        <input
          type="number"
          min={10}
          max={1000}
          step={10}
          value={state.maxSnapDistanceMeters}
          onChange={(e) => onSetMaxSnapDistance(Number(e.target.value))}
          title="Distância máxima de snap em metros"
          aria-label="Snap max (m)"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
      </div>

      {/* ── Erro ── */}
      {state.error && (
        <div className="flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-200/60 px-2 py-1.5 dark:bg-red-950/10 dark:border-red-800/30">
          <XCircle size={11} className="text-red-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-red-700 dark:text-red-400">{state.error}</span>
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
            Calculando…
          </>
        ) : (
          <>
            <Route size={12} />
            Calcular Roteamento MT
          </>
        )}
      </button>

      {/* ── Resultado ── */}
      {state.result && <ResultCard result={state.result} />}
    </div>
  );
};

export default MtRouterPanel;
