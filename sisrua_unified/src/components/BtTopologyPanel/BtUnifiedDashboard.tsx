import React, { useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Box, ShoppingCart, Info, Loader2 } from "lucide-react";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import { useBtTopologyContext } from "./BtTopologyContext";

// ─── Lazy Loading Tabs (Audit P1: Bundle Optimization) ───────────────────────

const BtUnifiedInfraTab = lazy(() => import("./BtUnifiedInfraTab"));
const BtUnifiedElectricalTab = lazy(() => import("./BtUnifiedElectricalTab"));
const BtUnifiedCommercialTab = lazy(() => import("./BtUnifiedCommercialTab"));

type TabType = "infra" | "electrical" | "commercial";

const TabLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-12 text-slate-400 animate-pulse">
    <Loader2 size={24} className="animate-spin mb-3 opacity-20" />
    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Carregando Módulo...</span>
  </div>
);

export const BtUnifiedDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("infra");
  
  const {
    locale,
    selectedPole,
    selectedPoleIds,
    onSetSelectedPoleIds,
    isCalculating,
    onBtSetPoleChangeFlag,
  } = useBtTopologyContext();

  const t = getBtTopologyPanelText(locale);

  if (isCalculating) {
    return (
      <div className="space-y-4 animate-pulse p-2">
        <div className="h-12 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-64 bg-slate-100 dark:bg-zinc-900 rounded-3xl" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-20 bg-slate-100 dark:bg-zinc-900 rounded-xl" />
          <div className="h-20 bg-slate-100 dark:bg-zinc-900 rounded-xl" />
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
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ações de Engenharia</h4>
            <button
              onClick={() => ids.forEach(id => onBtSetPoleChangeFlag?.(id, "replace"))}
              className="w-full py-3 bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all shadow-md active:scale-95 dark:bg-violet-600 dark:hover:bg-violet-500"
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
            <Suspense fallback={<TabLoadingFallback />}>
              {activeTab === "infra" && (
                <BtUnifiedInfraTab />
              )}
              {activeTab === "electrical" && (
                <BtUnifiedElectricalTab />
              )}
              {activeTab === "commercial" && (
                <BtUnifiedCommercialTab />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BtUnifiedDashboard;
