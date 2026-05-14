import React from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BtPoleNode } from "../../types";
import { TableIndividualPostes } from "./TableIndividualPostes";

interface StepDemandaProps {
  clientesPorPoste: number;
  demandaMediaClienteKva: number;
  onUpdateParam: (key: any, value: any) => void;
  onMarkTouched: (key: string) => void;
  fieldErrors: Record<string, boolean>;
  poles: BtPoleNode[];
  poleOverrides: Record<string, number>;
  onUpdatePoleOverride: (id: string, val: number) => void;
}

export const StepDemanda: React.FC<StepDemandaProps> = ({
  clientesPorPoste,
  demandaMediaClienteKva,
  onUpdateParam,
  onMarkTouched,
  fieldErrors,
  poles,
  poleOverrides,
  onUpdatePoleOverride,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-violet-500/10 p-3 dark:bg-violet-500/5">
          <Users className="text-violet-600" size={24} />
        </div>
        <div>
          <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
            {t("dgWizard.demanda.title")}
          </h3>
          <p className="text-xs font-medium text-zinc-500">
            {t("dgWizard.demanda.description")}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="clientes-global"
            className="text-xs font-black text-zinc-500 uppercase tracking-widest"
          >
            {t("dgWizard.demanda.labelClientesPorPoste")}
          </label>
          <div className="relative">
            <input
              id="clientes-global"
              type="number"
              value={clientesPorPoste}
              onChange={(e) =>
                onUpdateParam("clientesPorPoste", Number(e.target.value))
              }
              onBlur={() => onMarkTouched("clientesPorPoste")}
              className={`w-full rounded-xl border bg-zinc-50 pl-4 pr-12 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:text-white transition-all ${
                fieldErrors.clientesPorPoste
                  ? "border-rose-500 dark:border-rose-500/50"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">
              {t("dgWizard.demanda.unitUnd")}
            </div>
          </div>
        </div>

        <TableIndividualPostes 
          poles={poles}
          poleOverrides={poleOverrides}
          onUpdatePoleOverride={onUpdatePoleOverride}
          clientesPorPosteDefault={clientesPorPoste}
        />
        
        <div className="space-y-2">
          <label
            htmlFor="demanda-media"
            className="text-xs font-black text-zinc-500 uppercase tracking-widest"
          >
            {t("dgWizard.demanda.labelDemandaMedia")}
          </label>
          <div className="relative">
            <input
              id="demanda-media"
              type="number"
              placeholder="1.5"
              step="0.1"
              value={demandaMediaClienteKva}
              onChange={(e) =>
                onUpdateParam("demandaMediaClienteKva", Number(e.target.value))
              }
              onBlur={() => onMarkTouched("demandaMediaClienteKva")}
              className={`w-full rounded-xl border bg-zinc-50 pl-4 pr-12 py-3 text-sm font-bold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none dark:bg-zinc-800 dark:text-white transition-all ${
                fieldErrors.demandaMediaClienteKva
                  ? "border-rose-500 dark:border-rose-500/50"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">
              {t("dgWizard.demanda.unitKva")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
