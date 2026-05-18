import React from "react";
import { Ruler } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StepTecnicoProps {
  maxSpanMeters: number;
  fatorSimultaneidade: number;
  faixaKvaTrafoPermitida: number[];
  onUpdateParam: (key: any, value: any) => void;
  onMarkTouched: (key: string) => void;
  fieldErrors: Record<string, boolean>;
}

export const StepTecnico: React.FC<StepTecnicoProps> = ({
  maxSpanMeters,
  fatorSimultaneidade,
  faixaKvaTrafoPermitida,
  onUpdateParam,
  onMarkTouched,
  fieldErrors,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-indigo-500/10 p-3 dark:bg-indigo-500/5">
          <Ruler className="text-indigo-600" size={24} />
        </div>
        <div>
          <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
            {t("dgWizard.tecnico.title")}
          </h3>
          <p className="text-xs font-medium text-zinc-500">
            {t("dgWizard.tecnico.description")}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="max-span"
            className="text-xs font-black text-zinc-500 uppercase tracking-widest"
          >
            {t("dgWizard.tecnico.labelMaxSpan")}
          </label>
          <input
            id="max-span"
            type="number"
            placeholder="40"
            value={maxSpanMeters}
            onChange={(e) =>
              onUpdateParam("maxSpanMeters", Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 transition-all"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="fator-simult"
            className="text-xs font-black text-zinc-500 uppercase tracking-widest"
          >
            {t("dgWizard.tecnico.labelFatorSimult")}
          </label>
          <input
            id="fator-simult"
            type="number"
            placeholder="0.8"
            step="0.05"
            value={fatorSimultaneidade}
            onChange={(e) =>
              onUpdateParam("fatorSimultaneidade", Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 transition-all"
          />
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">
          {t("dgWizard.tecnico.labelTrafosPermitidos")}
        </label>
        <div
          className={`flex flex-wrap gap-2 p-2 rounded-2xl border-2 transition-all ${
            fieldErrors.faixaKvaTrafoPermitida
              ? "border-rose-500 bg-rose-500/5"
              : "border-transparent"
          }`}
        >
          {[15, 30, 45, 75, 112.5, 150, 225, 300].map((kva) => {
            const isSelected = faixaKvaTrafoPermitida.includes(kva);
            return (
              <button
                key={kva}
                type="button"
                onClick={() => {
                  const current = faixaKvaTrafoPermitida;
                  const next = current.includes(kva)
                    ? current.filter((k) => k !== kva)
                    : [...current, kva].sort((a, b) => a - b);
                  onUpdateParam("faixaKvaTrafoPermitida", next);
                  onMarkTouched("faixaKvaTrafoPermitida");
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${
                  isSelected
                    ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "bg-white border-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700"
                }`}
              >
                {kva}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
