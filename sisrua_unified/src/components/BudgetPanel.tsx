/**
 * BudgetPanel.tsx — Painel de orçamentação automática SINAPI e FinOps (T2).
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="flex flex-col gap-4 p-4 glass-premium rounded-2xl border border-white/5 bg-slate-900/30 backdrop-blur-2xl shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-sm font-black flex items-center gap-2 tracking-tight uppercase text-white/80">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 ring-1 ring-emerald-500/30">
             <Calculator className="w-4 h-4" />
          </div>
          {t.title}
        </h3>
        <button
          onClick={handleCalculate}
          disabled={loading || !topology.poles.length}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-95 ring-1 ring-white/10"
          title={t.calculateBtn}
        >
          <RefreshCcw className={`w-3.5 h-3.5 text-slate-300 ${loading ? "animate-spin text-emerald-400" : ""}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-bold text-red-300 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            {error}
          </motion.div>
        )}

        {!result && !loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 opacity-50"
          >
             <PieChart className="w-8 h-8 text-slate-400 mb-3" />
             <p className="text-[10px] font-black uppercase tracking-widest text-center text-slate-400">
               Clique para gerar o orçamento oficial SINAPI/ORSE.
             </p>
          </motion.div>
        )}

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            {/* Custo Direto */}
            <div className="relative overflow-hidden p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2 mb-1 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                <DollarSign className="w-3 h-3" />
                {t.directCost}
              </div>
              <div className="text-2xl font-mono font-black text-white tracking-tighter drop-shadow-md">
                {formatBrl(result.sinapi?.custoDirectoTotal || 0)}
              </div>
            </div>

            {/* Custo Global com BDI */}
            <div className="relative overflow-hidden p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 group hover:border-emerald-500/30 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-emerald-400">
                 <PieChart className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2 mb-1 text-emerald-400 uppercase text-[9px] font-black tracking-widest">
                <PieChart className="w-3 h-3" />
                {t.globalCost}
              </div>
              <div className="text-2xl font-mono font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                {formatBrl(result.bdi?.custoComBdi || 0)}
              </div>
              <div className="text-[9px] font-bold text-emerald-500 mt-2 flex items-center gap-1 uppercase tracking-wider">
                BDI Aplicado: <span className="text-emerald-300">{result.bdi?.percentualBdi.toFixed(2)}%</span>
              </div>
            </div>

            {/* ROI / Viabilidade */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                   <TrendingUp className="w-3 h-3" />
                   {t.roiTitle}
                 </div>
                 <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${result.roi?.viavel ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"}`}>
                   {result.roi?.viavel ? t.viable : t.notViable}
                 </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-slate-950/50 rounded-xl border border-white/5">
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-0.5">
                    VPL
                  </span>
                  <span className="text-xs font-bold text-white tracking-tight">
                    {formatBrl(result.roi?.vpl || 0)}
                  </span>
                </div>
                <div className="p-2 bg-slate-950/50 rounded-xl border border-white/5">
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-0.5">
                    TIR
                  </span>
                  <span className="text-xs font-bold text-emerald-400 tracking-tight">
                    {result.roi?.tir.toFixed(2)}%
                  </span>
                </div>
                <div className="p-2 bg-slate-950/50 rounded-xl border border-white/5">
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest block mb-0.5">
                    PAYBACK
                  </span>
                  <span className="text-xs font-bold text-amber-400 tracking-tight">
                    {result.roi?.paybackSimples} <span className="text-[9px]">{t.years}</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
