import React from "react";
import { Shield, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StepExpansaoProps {
  areaClandestinaM2: number;
  onUpdateParam: (key: any, value: any) => void;
}

export const StepExpansao: React.FC<StepExpansaoProps> = ({
  areaClandestinaM2,
  onUpdateParam,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-amber-500/10 p-3 dark:bg-amber-500/5">
          <Shield className="text-amber-600" size={24} />
        </div>
        <div>
          <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
            {t("dgWizard.expansao.title")}
          </h3>
          <p className="text-xs font-medium text-zinc-500">
            {t("dgWizard.expansao.description")}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="area-clandestina"
          className="text-xs font-black text-zinc-500 uppercase tracking-widest"
        >
          {t("dgWizard.expansao.labelAreaClandestina")}
        </label>
        <div className="relative">
          <input
            id="area-clandestina"
            type="number"
            placeholder="0"
            value={areaClandestinaM2}
            onChange={(e) =>
              onUpdateParam("areaClandestinaM2", Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-4 pr-12 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">
            {t("dgWizard.expansao.unitM2")}
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-amber-50 p-4 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 flex gap-2">
            <Info size={14} className="shrink-0" />
            {t("dgWizard.expansao.infoNote")}
          </p>
        </div>
      </div>
    </div>
  );
};
