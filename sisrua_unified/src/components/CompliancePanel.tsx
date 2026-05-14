/**
 * CompliancePanel.tsx — Painel consolidado de conformidade ambiental, urbana, solar, vegetal e fundiária (T2).
 */

import React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useCompliance } from "../hooks/useCompliance";
import { complianceText, type ComplianceLocale } from "../i18n/complianceText";
import {
  ShieldCheck,
  Leaf,
  Accessibility,
  Sun,
  TreeDeciduous,
  Map as MapIcon,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import type { BtTopology } from "../types";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";

interface CompliancePanelProps {
  topology: BtTopology;
  osmData?: any[];
  locale?: string;
}

export const CompliancePanel: React.FC<CompliancePanelProps> = ({
  topology,
  osmData = [],
  locale = "pt-BR",
}) => {
  const { flags } = useFeatureFlags();
  const { runAnalysis, loading, result, error } = useCompliance();
  const t =
    complianceText[locale as ComplianceLocale] || complianceText["pt-BR"];
  const landConflictCount = result?.land?.totalConflitos ?? 0;
  const landConflicts = result?.land?.conflicts ?? [];

  const handleAnalyze = () => {
    runAnalysis(topology, osmData);
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col gap-4 p-4 glass-premium rounded-2xl border border-white/5 bg-slate-900/30 backdrop-blur-2xl shadow-xl max-h-[75vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md rounded-t-lg -mt-4 pt-4">
        <h3 className="text-sm font-black flex items-center gap-2 tracking-tight uppercase text-white/80">
          <div className="p-1.5 bg-cyan-500/20 rounded-lg text-cyan-400 ring-1 ring-cyan-500/30">
            <ShieldCheck className="w-4 h-4" />
          </div>
          {t.title}
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading || !topology.poles.length}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-95 ring-1 ring-white/10"
          title={t.analyzeBtn}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${loading ? "animate-spin text-cyan-400" : ""}`} />
        </button>
      </div>

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

        {!result && !loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 opacity-50"
          >
             <ShieldCheck className="w-8 h-8 text-slate-400 mb-3" />
             <p className="text-[10px] font-black uppercase tracking-widest text-center text-slate-400">
               Clique no ícone de atualização para iniciar a auditoria técnica ESG.
             </p>
          </motion.div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            {/* Fundiário (Item 107) */}
            <motion.div variants={itemVariants} className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-sky-500/30 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <MapIcon className="w-16 h-16 text-sky-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3 text-sky-400 uppercase text-[9px] font-black tracking-widest">
                  <MapIcon className="w-3 h-3" />
                  {t.landTitle}
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.landConflicts}:</span>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${landConflictCount > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                    {landConflictCount === 0 && <CheckCircle2 className="w-3 h-3" />}
                    <span className="text-xl font-mono font-black tracking-tighter">{landConflictCount}</span>
                  </div>
                </div>
                {landConflictCount > 0 && (
                  <div className="mt-4 space-y-2">
                    {landConflicts.slice(0, 2).map((c: any) => (
                      <div
                        key={c.poleId}
                        className="flex items-center justify-between text-[10px] bg-amber-500/5 p-2 rounded-xl border border-amber-500/20"
                      >
                        <span className="text-amber-200/80 truncate max-w-[120px] font-medium">
                          {c.propertyName}
                        </span>
                        <span className="text-amber-400 font-black uppercase tracking-widest text-[8px] bg-amber-500/10 px-1.5 py-0.5 rounded">
                          {t.pending}
                        </span>
                      </div>
                    ))}
                    <button className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl text-[9px] font-black uppercase text-sky-400 transition-all hover:scale-[1.02] active:scale-95">
                      <FileText className="w-3 h-3" />
                      Gerar Memorial Descritivo
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Ambiental */}
            {flags.enableEnvironmentalAudit && (
              <motion.div variants={itemVariants} className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Leaf className="w-16 h-16 text-emerald-400" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 text-emerald-400 uppercase text-[9px] font-black tracking-widest">
                    <Leaf className="w-3 h-3" />
                    {t.environmentalTitle}
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.riskLevel}:</span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded font-black uppercase tracking-widest border ${result.environmental?.riskLevel === "ALTO" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}
                    >
                      {result.environmental?.riskLevel === "ALTO"
                        ? t.riskHigh
                        : t.riskLow}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Vegetação */}
            {flags.enableVegetationAnalysis && (
              <motion.div variants={itemVariants} className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TreeDeciduous className="w-16 h-16 text-emerald-400" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 text-emerald-400 uppercase text-[9px] font-black tracking-widest">
                    <TreeDeciduous className="w-3 h-3" />
                    {t.vegetationTitle}
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.operationalRisk}:</span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded font-black uppercase tracking-widest border ${result.vegetation?.riscoOperacional === "alto" ? "bg-red-500/10 border-red-500/30 text-red-400" : result.vegetation?.riscoOperacional === "medio" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}
                    >
                      {result.vegetation?.riscoOperacional.toUpperCase()}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Urbano */}
            {flags.enableNbr9050 && (
              <motion.div variants={itemVariants} className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Accessibility className="w-16 h-16 text-amber-400" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 text-amber-400 uppercase text-[9px] font-black tracking-widest">
                    <Accessibility className="w-3 h-3" />
                    {t.urbanTitle}
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.scoreAcessibilidade}</span>
                    <span className="text-xl font-mono font-black text-amber-400 tracking-tighter drop-shadow-md">
                      {result.urban?.score}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      style={{ width: `${result.urban?.score}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Solar */}
            {flags.enableSolarShading && (
              <motion.div variants={itemVariants} className="p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-yellow-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Sun className="w-16 h-16 text-yellow-400" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 text-yellow-400 uppercase text-[9px] font-black tracking-widest">
                    <Sun className="w-3 h-3" />
                    {t.solarTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {result.solar?.results
                      .filter((r: any) => r.nivelRiscoTermico === "alto" || r.nivelRiscoTermico === "critico")
                      .slice(0, 2)
                      .map((r: any) => (
                        <div
                          key={r.ativoId}
                          className="bg-red-500/10 p-2 rounded-xl border border-red-500/20 text-[10px] flex flex-col gap-1"
                        >
                          <div className="text-white/80 font-bold uppercase tracking-widest text-[8px]">
                            {r.ativoId}
                          </div>
                          <div className="text-red-400 font-black">
                            {t.riskHigh}
                          </div>
                        </div>
                      ))}
                    {result.solar?.results.filter((r: any) => r.nivelRiscoTermico === "alto" || r.nivelRiscoTermico === "critico").length === 0 && (
                       <div className="col-span-2 text-center py-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-1.5">
                         <CheckCircle2 className="w-3 h-3" /> Térmico OK
                       </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
