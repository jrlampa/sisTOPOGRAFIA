/**
 * CompliancePanel.tsx — Painel consolidado de conformidade ambiental, urbana, solar, vegetal e fundiária (T2).
 */

import React from "react";
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

  return (
    <div className="flex flex-col gap-4 p-4 glass-premium rounded-xl max-h-[70vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          {t.title}
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading || !topology.poles.length}
          className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          title={t.analyzeBtn}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-200">
          {error}
        </div>
      )}

      {!result && !loading && (
        <p className="text-sm text-slate-400 text-center py-4 italic">
          Clique no ícone de atualização para iniciar a auditoria técnica.
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Fundiário (Item 107) */}
          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <MapIcon className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-semibold">{t.landTitle}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">{t.landConflicts}:</span>
              <span
                className={`font-bold ${landConflictCount > 0 ? "text-amber-400" : "text-green-400"}`}
              >
                {landConflictCount}
              </span>
            </div>
            {landConflictCount > 0 && (
              <div className="mt-2 space-y-1">
                {landConflicts.slice(0, 2).map((c: any) => (
                  <div
                    key={c.poleId}
                    className="flex items-center justify-between text-[10px] bg-sky-900/20 p-1.5 rounded border border-sky-500/20"
                  >
                    <span className="text-sky-200 truncate max-w-[120px]">
                      {c.propertyName}
                    </span>
                    <span className="text-amber-300 font-bold uppercase">
                      {t.pending}
                    </span>
                  </div>
                ))}
                <button className="w-full mt-1 flex items-center justify-center gap-1 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] font-black uppercase text-slate-400 transition-colors">
                  <FileText className="w-3 h-3" />
                  Gerar Memorial Descritivo
                </button>
              </div>
            )}
          </div>

          {/* Ambiental */}
          {flags.enableEnvironmentalAudit && (
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold">
                  {t.environmentalTitle}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">{t.riskLevel}:</span>
                <span
                  className={`font-bold ${result.environmental?.riskLevel === "ALTO" ? "text-red-400" : "text-green-400"}`}
                >
                  {result.environmental?.riskLevel === "ALTO"
                    ? t.riskHigh
                    : t.riskLow}
                </span>
              </div>
            </div>
          )}

          {/* Vegetação */}
          {flags.enableEnvironmentalAudit && (
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <TreeDeciduous className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold">
                  {t.vegetationTitle}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">{t.operationalRisk}:</span>
                <span
                  className={`font-bold ${result.vegetation?.riscoOperacional === "alto" ? "text-red-400" : result.vegetation?.riscoOperacional === "medio" ? "text-amber-400" : "text-green-400"}`}
                >
                  {result.vegetation?.riscoOperacional.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Urbano */}
          {flags.enableNbr9050 && (
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Accessibility className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold">{t.urbanTitle}</span>
              </div>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-slate-400">{t.scoreAcessibilidade}:</span>
                <span className="font-mono font-bold text-amber-400">
                  {result.urban?.score}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${result.urban?.score}%` }}
                />
              </div>
            </div>
          )}

          {/* Solar */}
          {flags.enableSolarShading && (
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold">{t.solarTitle}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {result.solar?.results
                  .filter((r: any) => r.nivelRiscoTermico === "alto")
                  .slice(0, 2)
                  .map((r: any) => (
                    <div
                      key={r.ativoId}
                      className="bg-white/5 p-1.5 rounded text-[10px]"
                    >
                      <div className="text-slate-300 font-bold">
                        {r.ativoId}
                      </div>
                      <div className="text-red-400">
                        {t.thermalRisk}: {t.riskHigh}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
