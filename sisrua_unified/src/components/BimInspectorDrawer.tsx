import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Zap, 
  Box, 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Layers,
} from "lucide-react";
import type { 
  BtPoleNode, 
  BtTransformer, 
  AppLocale, 
  BtTopology 
} from "../types";
import type { BtPoleAccumulatedDemand } from "../utils/btTopologyFlow";
import { useFocusTrap } from "../hooks/useFocusTrap";

export interface BimInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pole: BtPoleNode | null;
  transformer?: BtTransformer | null;
  accumulatedData?: BtPoleAccumulatedDemand | null;
  btTopology: BtTopology;
  locale: AppLocale;
  onRenamePole?: (id: string, title: string) => void;
  onSetPoleChangeFlag?: (id: string, flag: any) => void;
}

type InspectorTab = "engineering" | "bim" | "notes";

export function BimInspectorDrawer({
  isOpen,
  onClose,
  pole,
  transformer,
  accumulatedData,
  locale: _locale,
  onRenamePole,
  onSetPoleChangeFlag,
}: BimInspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("engineering");
  const containerRef = useFocusTrap(isOpen);
  const poleTitleInputId = `bim-inspector-pole-title-${pole?.id ?? "unknown"}`;

  if (!pole) return null;

  const tabs: { id: InspectorTab; label: string; icon: any }[] = [
    { id: "engineering", label: "Engenharia", icon: Zap },
    { id: "bim", label: "BIM / Specs", icon: Box },
    { id: "notes", label: "Anotações", icon: ClipboardList },
  ];

  const cqtClass =
    accumulatedData?.cqtStatus === "CRÍTICO"
      ? "text-red-600 bg-red-50 dark:bg-red-900/20"
      : accumulatedData?.cqtStatus === "ATENÇÃO"
        ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20"
        : "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 z-[1000] w-full max-w-sm border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95 sm:max-w-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                <Box size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">
                  Inspeção Deep BIM
                </h2>
                <div className="text-[10px] font-bold text-slate-400 font-mono">
                  ASSET ID: {pole.id}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              title="Fechar inspeção"
              aria-label="Fechar inspeção"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-100 p-2 dark:border-white/5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-black uppercase tracking-tighter transition-all ${
                    isActive
                      ? "bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900"
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {/* Asset Title / Rename */}
            <div className="space-y-1.5">
              <label
                htmlFor={poleTitleInputId}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Título do Ativo
              </label>
              <input
                id={poleTitleInputId}
                type="text"
                value={pole.title}
                onChange={(e) => onRenamePole?.(pole.id, e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:border-white/5 dark:bg-white/5 dark:text-slate-100"
              />
            </div>

            {activeTab === "engineering" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Engineering Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-3xl p-4 border border-transparent ${cqtClass}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap size={14} />
                      <span className="text-[10px] font-black uppercase">CQT Acumulada</span>
                    </div>
                    <div className="text-2xl font-black">
                      {accumulatedData?.dvAccumPercent?.toFixed(2) ?? "-"}%
                    </div>
                  </div>
                  <div className="rounded-3xl p-4 bg-slate-50 border border-slate-100 dark:bg-white/5 dark:border-white/10 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2 mb-1 text-slate-400">
                      <Activity size={14} />
                      <span className="text-[10px] font-black uppercase">Tensão</span>
                    </div>
                    <div className="text-2xl font-black">
                      {accumulatedData?.voltageV?.toFixed(1) ?? "-"}V
                    </div>
                  </div>
                </div>

                {/* Demand Info */}
                <div className="rounded-3xl border border-slate-200 p-5 space-y-4 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Resumo de Carga</h3>
                    <Layers size={16} className="text-slate-400" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Carga Local:</span>
                      <span className="font-bold">{accumulatedData?.localTrechoDemandKva.toFixed(2) ?? "0.00"} kVA</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Carga Acumulada:</span>
                      <span className="font-bold">{accumulatedData?.accumulatedDemandKva.toFixed(2) ?? "0.00"} kVA</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Total Clientes:</span>
                      <span className="font-bold">{accumulatedData?.accumulatedClients ?? 0} unidades</span>
                    </div>
                  </div>
                </div>

                {/* Transformer Link */}
                {transformer && (
                  <div className="rounded-3xl bg-amber-50 border border-amber-100 p-5 dark:bg-amber-900/10 dark:border-amber-900/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                        <Zap size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase">Transformador Ativo</div>
                        <div className="text-[10px] font-bold text-amber-700/60 font-mono">{transformer.id}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm font-bold text-amber-900 dark:text-amber-200">
                      <div>Potência: {transformer.projectPowerKva} kVA</div>
                      <div>Leitura: {transformer.demandKva?.toFixed(1) ?? "-"} kVA</div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "bim" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Physical Specs */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Box size={14} className="text-indigo-500" />
                    Especificações Físicas (BIM)
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Altura (m)</span>
                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 font-bold dark:bg-white/5 dark:border-white/10">
                        {pole.poleSpec?.heightM ?? "N/D"}m
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Esforço (daN)</span>
                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 font-bold dark:bg-white/5 dark:border-white/10">
                        {pole.poleSpec?.nominalEffortDan ?? "N/D"}
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Material</span>
                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 font-bold dark:bg-white/5 dark:border-white/10 uppercase">
                        {pole.poleSpec?.material ?? "Não Definido"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BT Structures */}
                <div className="space-y-3">
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Estruturas BT</h3>
                   <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map(i => {
                        const key = `si${i}` as keyof NonNullable<typeof pole.btStructures>;
                        const val = pole.btStructures?.[key];
                        return (
                          <div key={i} className="p-3 rounded-2xl border border-slate-100 bg-white shadow-sm dark:bg-zinc-800 dark:border-white/5 text-center">
                            <span className="block text-[8px] font-black text-slate-400 uppercase mb-1">Posição {i}</span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{val || "Vazio"}</span>
                          </div>
                        );
                      })}
                   </div>
                </div>

                {/* Data Source */}
                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 dark:bg-white/5 dark:border-white/10 flex items-center justify-between">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Fonte do Dado</span>
                   <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:border-white/10 dark:text-slate-300 shadow-sm">
                      {pole.dataSource || "imported"}
                   </span>
                </div>
              </motion.div>
            )}

            {activeTab === "notes" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações Gerais</label>
                    <textarea 
                      className="w-full min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:border-white/5 dark:bg-white/5"
                      placeholder="Adicione notas de campo ou observações técnicas..."
                      defaultValue={pole.generalNotes}
                    />
                  </div>

                  <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 dark:border-white/10">
                     <AlertCircle size={32} className="mb-2 opacity-20" />
                     <span className="text-xs font-bold uppercase tracking-widest opacity-40">Módulo de Fotos</span>
                     <span className="text-[10px] opacity-30 mt-1">Integração Mobile em Breve</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 p-6 bg-slate-50/50 dark:border-white/5 dark:bg-white/5">
             <div className="flex gap-3">
                <button 
                  onClick={() => onSetPoleChangeFlag?.(pole.id, pole.verified ? "existing" : "replace")}
                  className="flex-1 py-3 px-4 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {pole.verified ? "Verificado" : "Validar Ativo"}
                </button>
             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
