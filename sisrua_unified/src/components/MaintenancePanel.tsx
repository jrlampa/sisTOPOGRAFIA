/**
 * MaintenancePanel.tsx — Painel de Saúde da Rede e IA Preditiva (T3-133).
 */

import React, { useState } from "react";
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

  return (
    <div className="flex flex-col gap-4 p-4 glass-premium rounded-xl border border-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-fuchsia-400" />
          Saúde da Rede (IA)
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading || !transformer}
          className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
          Análise IA
        </button>
      </div>

      {!transformer && (
        <p className="text-xs text-slate-500 text-center py-4">
          Selecione um transformador para auditoria preditiva.
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-[10px] text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500 space-y-4">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-black">Risk Score</div>
              <div className={`text-2xl font-mono font-black ${getRiskColor(result.riskLevel)}`}>
                {result.healthScore}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-black">Nível de Risco</div>
              <div className={`text-sm font-bold uppercase ${getRiskColor(result.riskLevel)}`}>
                {result.riskLevel}
              </div>
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-2 text-slate-400 uppercase text-[9px] font-black">
              <ShieldAlert className="w-3 h-3" />
              Diagnóstico Cognitivo
            </div>
            <p className="text-xs leading-relaxed text-slate-200 italic">
              "{result.rationale}"
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-[9px] text-slate-500 uppercase font-black px-1">Ações Recomendadas</div>
            {result.suggestedActions.map((action, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-100">
                <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400 shrink-0" />
                {action}
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !loading && transformer && (
        <div className="flex flex-col items-center justify-center py-6 text-center opacity-40">
          <AlertTriangle className="w-8 h-8 mb-2" />
          <p className="text-[10px] font-bold uppercase tracking-tighter">Motor Preditivo em Standby</p>
        </div>
      )}
    </div>
  );
};
