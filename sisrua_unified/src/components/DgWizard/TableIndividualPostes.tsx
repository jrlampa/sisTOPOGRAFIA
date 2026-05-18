import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BtPoleNode } from "../../types";

interface TableIndividualPostesProps {
  poles: BtPoleNode[];
  poleOverrides: Record<string, number>;
  onUpdatePoleOverride: (id: string, val: number) => void;
  clientesPorPosteDefault: number;
}

export const TableIndividualPostes: React.FC<TableIndividualPostesProps> = ({
  poles,
  poleOverrides,
  onUpdatePoleOverride,
  clientesPorPosteDefault,
}) => {
  const { t } = useTranslation();
  const [showIndividual, setShowIndividual] = useState(false);

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setShowIndividual(!showIndividual)}
        className="flex items-center justify-between w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 hover:bg-slate-100 transition-colors"
      >
        {t("dgWizard.demanda.adjustIndividual", {
          count: poles.length,
        })}
        {showIndividual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showIndividual && (
        <div className="mt-2 border border-zinc-200 rounded-xl overflow-hidden dark:border-zinc-700 max-h-48 overflow-y-auto shadow-inner bg-slate-50/50 dark:bg-zinc-950/20">
          <table className="w-full text-left text-xs">
            <thead className="bg-white dark:bg-zinc-800 sticky top-0 border-b dark:border-zinc-700">
              <tr>
                <th className="px-4 py-2 font-black text-zinc-400 uppercase tracking-wider">
                  Poste
                </th>
                <th className="px-4 py-2 font-black text-zinc-400 uppercase tracking-wider text-right">
                  Clientes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {poles.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300 font-bold">
                    {p.title || p.id.slice(-4)}
                  </td>
                  <td className="px-4 py-1 text-right">
                    <input
                      type="number"
                      title={`Clientes do poste ${p.title || p.id}`}
                      placeholder={String(clientesPorPosteDefault)}
                      value={
                        poleOverrides[p.id] ??
                        p.ramais?.length ??
                        clientesPorPosteDefault
                      }
                      onChange={(e) =>
                        onUpdatePoleOverride(p.id, Number(e.target.value))
                      }
                      className="w-16 rounded-lg border border-zinc-200 px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700 outline-none focus:ring-1 focus:ring-violet-500 font-bold text-right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
