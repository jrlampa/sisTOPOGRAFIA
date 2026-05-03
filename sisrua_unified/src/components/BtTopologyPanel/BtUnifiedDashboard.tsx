import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Box, ShoppingCart, Info } from "lucide-react";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import BtUnifiedInfraTab from "./BtUnifiedInfraTab";
import BtUnifiedElectricalTab from "./BtUnifiedElectricalTab";
import BtUnifiedCommercialTab from "./BtUnifiedCommercialTab";
import { useBtTopologyContext } from "./BtTopologyContext";

type TabType = "infra" | "electrical" | "commercial";

export const BtUnifiedDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("infra");
  
  const {
    locale,
    btTopology,
    selectedPole,
    selectedPoleIds,
    onSetSelectedPoleIds,
    updatePoleSpec,
    onBtSetPoleChangeFlag,
  } = useBtTopologyContext();

  const t = getBtTopologyPanelText(locale);

  if (isCalculating) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-48 bg-slate-100 dark:bg-zinc-900 rounded-3xl" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-slate-100 dark:bg-zinc-900 rounded-xl" />
          <div className="h-16 bg-slate-100 dark:bg-zinc-900 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!selectedPole && (!selectedPoleIds || selectedPoleIds.length <= 1)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:bg-zinc-900/30 dark:border-white/5">
        <Info size={32} className="mb-2 opacity-20" />
        <p className="text-xs font-medium uppercase tracking-widest">{t.dashboard.noSelection}</p>
      </div>
    );
  }

  const tabs = [
    { id: "infra", label: t.dashboard.tabInfra, icon: <Box size={14} /> },
    { id: "electrical", label: t.dashboard.tabElectrical, icon: <Zap size={14} /> },
    { id: "commercial", label: t.dashboard.tabCommercial, icon: <ShoppingCart size={14} /> },
  ];

  if (selectedPoleIds && selectedPoleIds.length > 1) {
    const ids = selectedPoleIds;
    return (
      <div className="flex flex-col h-full bg-slate-50/50 border border-slate-200 rounded-3xl p-5 overflow-y-auto dark:bg-zinc-900/40 dark:border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {t.massEditTitle || "Edição em Massa"}
            </h3>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight dark:text-blue-400">
              {ids.length} postes selecionados
            </p>
          </div>
          <button
            onClick={() => onSetSelectedPoleIds?.([])}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm dark:bg-zinc-950 dark:border-white/5"
            title="Limpar Seleção"
          >
            <Info size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-zinc-950/40 dark:border-white/5">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Especificação de Material</h4>
            <div className="grid grid-cols-2 gap-2">
              {(["Concreto DT", "Fibra de Vidro", "Madeira", "Ferro"] as const).map(mat => (
                <button
                  key={mat}
                  onClick={() => ids.forEach(id => updatePoleSpec(id, { ...btTopology.poles.find(p => p.id === id)?.poleSpec, material: mat.split(' ')[0] as any }))}
                  className="py-2 px-1 text-[9px] font-black uppercase rounded-lg border border-slate-100 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all dark:bg-zinc-900 dark:border-white/5 dark:text-slate-400 dark:hover:bg-blue-900/20"
                >
                  {mat}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-zinc-950/40 dark:border-white/5">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Altura e Esforço</h4>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Altura Nominal (m)</span>
                <div className="flex gap-1.5">
                  {[9, 10, 11, 12].map(h => (
                    <button
                      key={h}
                      onClick={() => ids.forEach(id => updatePoleSpec(id, { ...btTopology.poles.find(p => p.id === id)?.poleSpec, heightM: h }))}
                      className="flex-1 py-1.5 text-xs font-black rounded-lg border border-slate-100 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all dark:bg-zinc-900 dark:border-white/5 dark:text-slate-300 dark:hover:bg-indigo-900/20"
                    >
                      {h}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Esforço (daN)</span>
                <div className="flex gap-1.5">
                  {[150, 300, 600, 1000].map(e => (
                    <button
                      key={e}
                      onClick={() => ids.forEach(id => updatePoleSpec(id, { ...btTopology.poles.find(p => p.id === id)?.poleSpec, nominalEffortDan: e }))}
                      className="flex-1 py-1.5 text-[10px] font-black rounded-lg border border-slate-100 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all dark:bg-zinc-900 dark:border-white/5 dark:text-slate-300 dark:hover:bg-emerald-900/20"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl shadow-sm dark:bg-violet-950/20 dark:border-violet-900/30">
            <h4 className="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-3 dark:text-violet-400">Ações de Engenharia</h4>
            <button
              onClick={() => ids.forEach(id => onBtSetPoleChangeFlag?.(id, "replace"))}
              className="w-full py-3 bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all shadow-md active:scale-[0.98] dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              Marcar todos para Substituição
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200 mb-4 dark:bg-zinc-900/50 dark:border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`relative flex flex-1 items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-lg ${
              activeTab === tab.id 
                ? "text-blue-700 dark:text-blue-400" 
                : "text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white shadow-sm rounded-lg border border-blue-100 dark:bg-zinc-800 dark:border-blue-900/40"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{tab.icon}</span>
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === "infra" && (
              <BtUnifiedInfraTab />
            )}
            {activeTab === "electrical" && (
              <BtUnifiedElectricalTab />
            )}
            {activeTab === "commercial" && (
              <BtUnifiedCommercialTab />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BtUnifiedDashboard;
