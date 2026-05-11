/**
 * MaintenancePanel.tsx — Painel de Saúde da Rede e IA Preditiva (T3-133).
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ShieldAlert, CheckCircle2, Loader2, Brain, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { buildApiHeaders } from "../services/apiClient";

interface PredictiveResult {
  assetId: string;
  riskLevel: "baixo" | "medio" | "alto" | "critico";
  healthScore: number;
  rationale: string;
  suggestedActions: string[];
  analyzedAt: string;
}

interface MaintenancePanelProps {
  transformer: any;
  poles: any[];
  locale?: string;
}

export const MaintenancePanel: React.FC<MaintenancePanelProps> = ({ transformer, poles, locale = "pt-BR" }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictiveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!transformer) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/maintenance/predictive/asset?locale=${locale}`, {
        method: "POST",
        headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transformer.id,
          type: "transformer",
          nominalPowerKva: transformer.projectPowerKva || 75,
          currentDemandKva: transformer.demandKva || 0,
          billedBrlMonthly: transformer.monthlyBillBrl || 0,
          ageYears: 12 // Simulado
        }),
      });

      if (!res.ok) throw new Error("Falha na comunicação com o motor de IA.");
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "baixo": return "text-emerald-400";
      case "medio": return "text-amber-400";
      case "alto": return "text-orange-500";
      case "critico": return "text-rose-500";
      default: return "text-slate-400";
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case "baixo": return "bg-emerald-500/10 border-emerald-500/20 ring-emerald-500/30";
      case "medio": return "bg-amber-500/10 border-amber-500/20 ring-amber-500/30";
      case "alto": return "bg-orange-500/10 border-orange-500/20 ring-orange-500/30";
      case "critico": return "bg-rose-500/10 border-rose-500/20 ring-rose-500/30";
      default: return "bg-white/5 border-white/10 ring-white/5";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 glass-premium rounded-2xl border border-white/5 bg-slate-900/30 backdrop-blur-2xl shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-sm font-black flex items-center gap-2 tracking-tight uppercase text-white/80">
          <div className="p-1.5 bg-fuchsia-500/20 rounded-lg text-fuchsia-400 ring-1 ring-fuchsia-500/30">
            <Activity className="w-4 h-4" />
          </div>
          Saúde da Rede (IA)
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading || !transformer}
          className="px-3 py-1.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-fuchsia-500/25 active:scale-95"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
          Análise IA
        </button>
      </div>

      {!transformer && (
        <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 text-center py-6 opacity-60">
          Selecione um transformador para auditoria preditiva.
        </p>
      )}

      <AnimatePresence mode="wait">
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-bold text-red-300 flex items-center gap-2"
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {error}
          </motion.div>
        )}

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className={`flex items-center justify-between p-4 rounded-2xl border ring-1 ${getRiskBg(result.riskLevel)} transition-colors`}>
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                   <Activity className="w-3 h-3" /> Risk Score
                </div>
                <div className={`text-3xl font-mono font-black tracking-tighter drop-shadow-lg ${getRiskColor(result.riskLevel)}`}>
                  {result.healthScore}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Nível de Risco</div>
                <div className={`text-xs px-2.5 py-1 rounded bg-black/20 font-black uppercase tracking-widest ${getRiskColor(result.riskLevel)}`}>
                  {result.riskLevel}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Brain className="w-16 h-16 text-indigo-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3 text-indigo-400 uppercase text-[9px] font-black tracking-widest">
                  <ShieldAlert className="w-3 h-3" />
                  Diagnóstico Cognitivo
                </div>
                <p className="text-xs leading-relaxed text-slate-300 italic font-medium">
                  "{result.rationale}"
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest px-1 mb-2 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 Plano de Ação Recomendado
              </div>
              {result.suggestedActions.map((action, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                  key={i} 
                  className="flex items-start gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/10 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                  {action}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {!result && !loading && transformer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 text-center opacity-40"
          >
            <Brain className="w-8 h-8 mb-3 text-fuchsia-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Motor Preditivo em Standby</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
