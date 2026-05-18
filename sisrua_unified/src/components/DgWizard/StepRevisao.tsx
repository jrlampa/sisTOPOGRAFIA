import React from "react";
import { FileCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DgWizardParams } from "../DgWizardModal";

interface StepRevisaoProps {
  params: Omit<DgWizardParams, "poleOverrides">;
  poleOverrides: Record<string, number>;
}

export const StepRevisao: React.FC<StepRevisaoProps> = ({
  params,
  poleOverrides,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-emerald-500/10 p-3 dark:bg-emerald-500/5">
          <FileCheck className="text-emerald-600" size={24} />
        </div>
        <div>
          <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
            {t("dgWizard.revisao.title")}
          </h3>
          <p className="text-xs font-medium text-zinc-500">
            {t("dgWizard.revisao.description")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            {t("dgWizard.revisao.summaryCarga")}
          </p>
          <p className="text-lg font-black text-slate-700 dark:text-white">
            {(
              params.clientesPorPoste *
              params.demandaMediaClienteKva *
              params.fatorSimultaneidade
            ).toFixed(2)}{" "}
            <span className="text-xs text-slate-400">
              {t("dgWizard.demanda.unitKva")}
            </span>
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            {t("dgWizard.revisao.summaryArea")}
          </p>
          <p className="text-lg font-black text-slate-700 dark:text-white">
            {params.areaClandestinaM2}{" "}
            <span className="text-xs text-slate-400">
              {t("dgWizard.expansao.unitM2")}
            </span>
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            {t("dgWizard.revisao.summaryVan")}
          </p>
          <p className="text-lg font-black text-slate-700 dark:text-white">
            {params.maxSpanMeters}{" "}
            <span className="text-xs text-slate-400">m</span>
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            {t("dgWizard.revisao.summaryAjustes")}
          </p>
          <p className="text-lg font-black text-slate-700 dark:text-white">
            {Object.keys(poleOverrides).length}{" "}
            <span className="text-xs text-slate-400">
              {t("dgWizard.revisao.unitPostes")}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100 dark:bg-violet-900/10 dark:border-violet-900/20">
        <p className="text-xs font-black text-violet-500 uppercase tracking-widest mb-2">
          {t("dgWizard.tecnico.labelTrafosPermitidos")}
        </p>
        <div className="flex flex-wrap gap-2">
          {params.faixaKvaTrafoPermitida.map((k) => (
            <span
              key={k}
              className="px-2 py-0.5 rounded-lg bg-white border border-violet-200 text-xs font-black text-violet-600 dark:bg-zinc-800 dark:border-violet-500/30"
            >
              {k} kVA
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
