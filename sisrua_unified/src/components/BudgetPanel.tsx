/**
 * BudgetPanel.tsx — Painel de orçamentação automática SINAPI e FinOps (T2).
 */

import React from "react";
import { useBudget } from "../hooks/useBudget";
import { budgetText, type BudgetLocale } from "../i18n/budgetText";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  PieChart,
  RefreshCcw,
} from "lucide-react";
import type { BtTopology } from "../types";

interface BudgetPanelProps {
  topology: BtTopology;
  tenantId: string;
  projetoId: string;
  locale?: string;
}

export const BudgetPanel: React.FC<BudgetPanelProps> = ({
  topology,
  tenantId,
  projetoId,
  locale = "pt-BR",
}) => {
  const { calculateBudget, loading, result, error } = useBudget();
  const t = budgetText[locale as BudgetLocale] || budgetText["pt-BR"];

  const handleCalculate = () => {
    calculateBudget(topology, tenantId, projetoId);
  };

  const formatBrl = (val: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "BRL",
    }).format(val);

  return (
    <div className="flex flex-col gap-4 p-4 glass-premium rounded-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-400" />
          {t.title}
        </h3>
        <button
          onClick={handleCalculate}
          disabled={loading || !topology.poles.length}
          className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          title={t.calculateBtn}
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-200">
          {error}
        </div>
      )}

      {!result && !loading && (
        <p className="text-sm text-slate-400 text-center py-4 italic">
          Clique para gerar o orçamento oficial SINAPI/ORSE.
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Custo Direto */}
          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-2 text-slate-400 uppercase text-[10px] font-black tracking-widest">
              <DollarSign className="w-3 h-3" />
              {t.directCost}
            </div>
            <div className="text-xl font-mono font-bold text-white">
              {formatBrl(result.sinapi?.custoDirectoTotal || 0)}
            </div>
          </div>

          {/* Custo Global com BDI */}
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2 text-emerald-400 uppercase text-[10px] font-black tracking-widest">
              <PieChart className="w-3 h-3" />
              {t.globalCost}
            </div>
            <div className="text-xl font-mono font-bold text-emerald-400">
              {formatBrl(result.bdi?.custoComBdi || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              BDI Aplicado: {result.bdi?.percentualBdi.toFixed(2)}%
            </div>
          </div>

          {/* ROI / Viabilidade */}
          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-3 text-slate-400 uppercase text-[10px] font-black tracking-widest">
              <TrendingUp className="w-3 h-3" />
              {t.roiTitle}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] text-slate-500 block mb-1">
                  VPL
                </span>
                <span className="text-sm font-bold text-white">
                  {formatBrl(result.roi?.vpl || 0)}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block mb-1">
                  TIR
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {result.roi?.tir.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block mb-1">
                  PAYBACK
                </span>
                <span className="text-sm font-bold text-amber-400">
                  {result.roi?.paybackSimples} {t.years}
                </span>
              </div>
              <div className="flex flex-col items-end justify-center">
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-black ${result.roi?.viavel ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                >
                  {result.roi?.viavel ? t.viable : t.notViable}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
