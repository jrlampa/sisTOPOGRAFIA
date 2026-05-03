import React from "react";
import { Users, Trash2, CheckCircle2, PlusCircle, X } from "lucide-react";
import type { BtPoleChangeFlag } from "../utils/btNormalization";

interface SidebarBulkEditSectionProps {
  selectedPoleIds: string[];
  onSetPoleChangeFlag: (poleId: string, flag: BtPoleChangeFlag) => void;
  onClearSelection: () => void;
}

export function SidebarBulkEditSection({
  selectedPoleIds,
  onSetPoleChangeFlag,
  onClearSelection,
}: SidebarBulkEditSectionProps) {
  const handleMassSetFlag = (flag: BtPoleChangeFlag) => {
    selectedPoleIds.forEach((id) => onSetPoleChangeFlag(id, flag));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-500/30 bg-white/50 p-4 shadow-xl backdrop-blur-md dark:bg-indigo-950/10 transition-all animate-in fade-in slide-in-from-bottom-2">
      {/* Decorative gradient background */}
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-600/10 p-2 text-indigo-600 dark:text-indigo-400">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-200">
              Edição em Massa
            </h3>
            <p className="text-[10px] font-bold text-indigo-600/60 dark:text-indigo-400/60">
              {selectedPoleIds.length} ativos selecionados
            </p>
          </div>
        </div>
        <button
          onClick={onClearSelection}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 transition-colors"
          title="Limpar seleção"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleMassSetFlag("existing")}
          className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-tight text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-300 dark:hover:bg-zinc-800 active:scale-95"
        >
          <CheckCircle2 size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" />
          Existente
        </button>
        <button
          onClick={() => handleMassSetFlag("new")}
          className="group flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-tight text-blue-700 shadow-sm transition-all hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30 active:scale-95"
        >
          <PlusCircle size={14} className="text-blue-500 group-hover:scale-110 transition-transform" />
          Projetado
        </button>
        <button
          onClick={() => handleMassSetFlag("remove")}
          className="group flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-tight text-rose-700 shadow-sm transition-all hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30 active:scale-95"
        >
          <Trash2 size={14} className="text-rose-500 group-hover:scale-110 transition-transform" />
          Remover
        </button>
        <button
          onClick={() => handleMassSetFlag("replace")}
          className="group flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-tight text-amber-700 shadow-sm transition-all hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30 active:scale-95"
        >
          <Users size={14} className="text-amber-500 group-hover:scale-110 transition-transform" />
          Substituir
        </button>
      </div>
    </div>
  );
}
