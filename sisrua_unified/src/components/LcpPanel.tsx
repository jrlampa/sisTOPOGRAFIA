/**
 * LcpPanel – Painel do Motor Least-Cost Path (LCP).
 *
 * Permite ao usuário:
 *   1. Selecionar interativamente a origem e terminais no mapa
 *   2. Escolher o perfil de custo (urbano, rural, corredor preferencial, etc.)
 *   3. Configurar corredores viários e postes existentes
 *   4. Executar o cálculo via POST /api/dg/lcp
 *   5. Visualizar resultado: custo ponderado, comprimento, postes reaproveitados
 *
 * Referência: T2.59 — STRATEGIC_ROADMAP_2026
 */

import React from "react";
import {
  Route,
  MapPin,
  Crosshair,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCcw,
  Navigation,
  DollarSign,
  ShieldAlert,
  Recycle,
} from "lucide-react";
import type {
  LcpRouterState,
  LcpCostProfile,
} from "../hooks/useLcp";
import { getLcpText } from "../i18n/lcpText";
import type { AppLocale } from "../types";

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface LcpPanelProps {
  state: LcpRouterState;
  locale?: AppLocale;
  onSetSelectionMode: (mode: "idle" | "pickSource" | "pickTerminal") => void;
  onRemoveTerminal: (id: string) => void;
  onSetMaxSnapDistance: (m: number) => void;
  onSetCostProfile: (profile: LcpCostProfile) => void;
  onCalculate: () => void;
  onReset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(0)} m`;
}

function fmtCost(cost: number): string {
  return cost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function LcpPanel({
  state,
  locale = "pt-BR",
  onSetSelectionMode,
  onRemoveTerminal,
  onSetMaxSnapDistance,
  onSetCostProfile,
  onCalculate,
  onReset,
}: LcpPanelProps) {
  const t = getLcpText(locale);
  const { result, error, isCalculating, selectionMode } = state;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-base">
          <Route size={16} className="text-green-600" />
          <span>{t.title}</span>
        </div>
        <button
          onClick={onReset}
          title={t.btnReset}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
        >
          <RefreshCcw size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-500">{t.subtitle}</p>

      {/* Origem */}
      <div className="border rounded p-2 bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-xs text-gray-600">{t.labelSource}</span>
          <button
            onClick={() =>
              onSetSelectionMode(
                selectionMode === "pickSource" ? "idle" : "pickSource",
              )
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors ${
              selectionMode === "pickSource"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 hover:bg-gray-100"
            }`}
          >
            <Crosshair size={11} />
            {t.btnPickSource}
          </button>
        </div>
        {selectionMode === "pickSource" && (
          <p className="text-xs text-blue-600 italic">{t.hintPickSource}</p>
        )}
        {state.source ? (
          <p className="text-xs text-gray-700 flex items-center gap-1">
            <MapPin size={11} className="text-blue-500" />
            {state.source.lat.toFixed(6)}, {state.source.lon.toFixed(6)}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">{t.sourceEmpty}</p>
        )}
      </div>

      {/* Terminais */}
      <div className="border rounded p-2 bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-xs text-gray-600">
            {t.labelTerminals}
            {state.terminals.length > 0 && (
              <span className="ml-1 text-gray-400">({state.terminals.length})</span>
            )}
          </span>
          <button
            onClick={() =>
              onSetSelectionMode(
                selectionMode === "pickTerminal" ? "idle" : "pickTerminal",
              )
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors ${
              selectionMode === "pickTerminal"
                ? "bg-purple-600 text-white border-purple-600"
                : "border-gray-300 hover:bg-gray-100"
            }`}
          >
            <Navigation size={11} />
            {t.btnPickTerminal}
          </button>
        </div>
        {selectionMode === "pickTerminal" && (
          <p className="text-xs text-purple-600 italic">{t.hintPickTerminal}</p>
        )}
        {state.terminals.length === 0 ? (
          <p className="text-xs text-gray-400 italic">{t.terminalsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {state.terminals.map((terminal) => (
              <li
                key={terminal.id}
                className="flex items-center justify-between text-xs text-gray-700"
              >
                <span className="flex items-center gap-1">
                  <MapPin size={10} className="text-purple-500" />
                  {terminal.name ?? terminal.id}
                  {terminal.demandKva != null && (
                    <span className="text-gray-400">({terminal.demandKva} kVA)</span>
                  )}
                </span>
                <button
                  onClick={() => onRemoveTerminal(terminal.id)}
                  title={t.btnRemoveTerminal}
                  aria-label={t.btnRemoveTerminal}
                  className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={10} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Corredores viários */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span className="font-medium">{t.labelRoadSegments}</span>
        <span className="text-gray-500">
          {state.roadSegments.length > 0
            ? t.roadSegmentsCount(state.roadSegments.length)
            : t.roadSegmentsEmpty}
        </span>
      </div>

      {/* Perfil de custo */}
      <div>
        <label 
          htmlFor="lcp-cost-profile-select"
          className="block text-xs font-medium text-gray-600 mb-1"
        >
          {t.labelCostProfile}
        </label>
        <select
          id="lcp-cost-profile-select"
          value={state.costProfile.id}
          onChange={(e) => {
            const found = state.availableProfiles.find((p) => p.id === e.target.value);
            if (found) onSetCostProfile(found);
          }}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
        >
          {state.availableProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Snap máximo */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
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
          className="w-20 text-xs border border-gray-300 rounded px-2 py-1"
        />
        <span className="text-xs text-gray-400">m</span>
      </div>

      {/* Botão calcular */}
      <button
        onClick={onCalculate}
        disabled={isCalculating}
        className="flex items-center justify-center gap-2 w-full py-2 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isCalculating ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t.btnCalculating}
          </>
        ) : (
          <>
            <Route size={14} />
            {t.btnCalculate}
          </>
        )}
      </button>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <ResultCard result={result} t={t} />
      )}
    </div>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({
  result,
  t,
}: {
  result: NonNullable<LcpRouterState["result"]>;
  t: ReturnType<typeof getLcpText>;
}) {
  return (
    <div
      className={`border rounded p-3 text-xs ${
        result.feasible
          ? "border-green-300 bg-green-50"
          : "border-red-300 bg-red-50"
      }`}
    >
      <div className="flex items-center gap-1.5 font-semibold mb-2">
        {result.feasible ? (
          <>
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-green-700">{t.resultFeasible}</span>
          </>
        ) : (
          <>
            <XCircle size={14} className="text-red-600" />
            <span className="text-red-700">{t.resultInfeasible}</span>
          </>
        )}
      </div>

      {result.feasible && (
        <div className="flex flex-col gap-1">
          <ResultRow label={t.resultTerminals(result.connectedTerminals, result.connectedTerminals + result.unreachableTerminals.length)}>
            <span />
          </ResultRow>
          <ResultRow label={t.resultTotalLength}>
            <span className="font-mono">{fmt(result.totalLengthMeters)}</span>
          </ResultRow>
          <ResultRow label={t.resultTotalCost}>
            <span className="font-mono">{fmtCost(result.totalWeightedCost)}</span>
          </ResultRow>
          {result.estimatedCostBrl != null && (
            <ResultRow label={t.resultEstimatedBrl}>
              <span className="flex items-center gap-1 font-mono text-green-700">
                <DollarSign size={11} />
                {fmtCost(result.estimatedCostBrl)}
              </span>
            </ResultRow>
          )}
          {result.totalExistingPolesReused > 0 && (
            <ResultRow label={t.resultPolesReused}>
              <span className="flex items-center gap-1 text-blue-600">
                <Recycle size={11} />
                {result.totalExistingPolesReused}
              </span>
            </ResultRow>
          )}

          {/* Por terminal */}
          {result.paths.length > 0 && (
            <div className="mt-2 border-t border-green-200 pt-2">
              <p className="font-medium mb-1 text-gray-600">{t.labelSegments}</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left pb-1">Terminal</th>
                    <th className="text-right pb-1">{t.colLength}</th>
                    <th className="text-right pb-1">{t.colCost}</th>
                    <th className="text-right pb-1">
                      <span className="flex items-center justify-end gap-1">
                        <Recycle size={10} />
                      </span>
                    </th>
                    <th className="text-right pb-1">
                      <span className="flex items-center justify-end gap-1">
                        <ShieldAlert size={10} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.paths.map((path) => (
                    <tr key={path.terminalId} className="border-t border-green-100">
                      <td className="py-0.5 text-gray-700 truncate max-w-[80px]">
                        {path.terminalId}
                      </td>
                      <td className="py-0.5 text-right font-mono">
                        {fmt(path.totalLengthMeters)}
                      </td>
                      <td className="py-0.5 text-right font-mono text-gray-600">
                        {fmtCost(path.totalWeightedCost)}
                      </td>
                      <td className="py-0.5 text-right text-blue-600">
                        {path.existingPolesReused > 0 ? path.existingPolesReused : "—"}
                      </td>
                      <td className="py-0.5 text-right text-orange-600">
                        {path.sensitiveCrossings > 0 ? path.sensitiveCrossings : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Não alcançados */}
          {result.unreachableTerminals.length > 0 && (
            <div className="mt-1 text-orange-700 flex items-start gap-1">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              <span>
                {t.resultUnreachable}: {result.unreachableTerminals.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {!result.feasible && result.reason && (
        <p className="text-red-600 mt-1">{result.reason}</p>
      )}
    </div>
  );
}

function ResultRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      {children}
    </div>
  );
}
