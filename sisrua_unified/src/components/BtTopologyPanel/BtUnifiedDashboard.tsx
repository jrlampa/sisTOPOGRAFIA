import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Box, ShoppingCart, Info } from "lucide-react";
import type { 
  BtTopology, 
  BtPoleNode, 
  BtTransformer, 
  BtEdge,
  AppLocale,
  BtProjectType,
  BtNetworkScenario,
  MtTopology
} from "../../types";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import BtUnifiedInfraTab from "./BtUnifiedInfraTab";
import BtUnifiedElectricalTab from "./BtUnifiedElectricalTab";
import BtUnifiedCommercialTab from "./BtUnifiedCommercialTab";
import type { BtPoleAccumulatedDemand, BtDerivedSummary } from "../../services/btDerivedService";

interface BtUnifiedDashboardProps {
  locale: AppLocale;
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  projectType: BtProjectType;
  selectedPoleId: string;
  selectedPoleIds?: string[];
  selectedPole: BtPoleNode | null;
  onSetSelectedPoleIds?: (ids: string[]) => void;
  selectedTransformerId: string;
  selectedTransformer: BtTransformer | null;
  selectedEdgeId: string;
  selectedEdge: BtEdge | null;
  accumulatedByPole: BtPoleAccumulatedDemand[];
  summary: BtDerivedSummary;
  transformerDebugById: Record<string, { assignedClients: number; estimatedDemandKva: number }>;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (poleId: string, flag: any) => void;
  onBtTogglePoleCircuitBreak?: (poleId: string, active: boolean) => void;
  updatePoleVerified: (poleId: string, v: boolean) => void;
  updatePoleRamais: (poleId: string, r: any[]) => void;
  updatePoleSpec: (poleId: string, s: any) => void;
  updatePoleBtStructures: (poleId: string, s: any) => void;
  updatePoleConditionStatus: (poleId: string, s: any) => void;
  updatePoleEquipmentNotes: (poleId: string, s: any) => void;
  updatePoleGeneralNotes: (poleId: string, s: any) => void;
  onBtRenameTransformer?: (id: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (id: string, flag: any) => void;
  updateTransformerVerified: (id: string, v: boolean) => void;
  updateTransformerReadings: (id: string, r: any[]) => void;
  updateTransformerProjectPower: (id: string, p: number) => void;
  onBtSetEdgeChangeFlag?: (id: string, flag: any) => void;
  updateEdgeVerified: (id: string, v: boolean) => void;
  updateEdgeConductors: (id: string, c: any) => void;
  updateEdgeMtConductors: (id: string, mtc: any) => void;
  updateEdgeReplacementFromConductors: (id: string, rc: any) => void;
  onSelectedEdgeChange: (id: string) => void;
  onSelectedTransformerChange: (id: string) => void;
  mtTopology: MtTopology;
}

type TabType = "infra" | "electrical" | "commercial";

export const BtUnifiedDashboard: React.FC<BtUnifiedDashboardProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>("infra");
  const t = getBtTopologyPanelText(props.locale);

  if (!props.selectedPole && (!props.selectedPoleIds || props.selectedPoleIds.length <= 1)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200">
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

  if (props.selectedPoleIds && props.selectedPoleIds.length > 1) {
    const ids = props.selectedPoleIds;
    return (
      <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-y-auto">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-2">
          {t.massEditTitle || "Edição em Massa"}
        </h3>
        <p className="text-xs text-slate-500 mb-4 font-medium">
          {ids.length} postes selecionados.
        </p>
        <button
          onClick={() => props.onSetSelectedPoleIds?.([])}
          className="self-start text-xs font-bold text-slate-500 hover:text-slate-800 transition"
        >
          Limpar Seleção
        </button>

        <div className="mt-6 flex flex-col gap-4">
          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Especificação Comum</h4>
            <select
              className="w-full text-xs font-semibold rounded border border-slate-300 p-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => {
                const spec = e.target.value;
                if (!spec) return;
                ids.forEach(id => {
                  props.updatePoleSpec(id, spec);
                  props.onBtSetPoleChangeFlag?.(id, "replace");
                });
              }}
            >
              <option value="">Selecione para aplicar a todos...</option>
              <option value="Concreto DT">Concreto DT</option>
              <option value="Fibra de Vidro">Fibra de Vidro</option>
              <option value="Madeira">Madeira</option>
            </select>
          </div>
          
          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Esforço Nominal (daN)</h4>
            <select
              className="w-full text-xs font-semibold rounded border border-slate-300 p-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => {
                const spec = e.target.value;
                if (!spec) return;
                ids.forEach(id => {
                  props.updatePoleSpec(id, spec);
                  props.onBtSetPoleChangeFlag?.(id, "replace");
                });
              }}
            >
              <option value="">Selecione para aplicar a todos...</option>
              <option value="150 daN">150 daN</option>
              <option value="300 daN">300 daN</option>
              <option value="600 daN">600 daN</option>
              <option value="1000 daN">1000 daN</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`relative flex flex-1 items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-lg ${
              activeTab === tab.id 
                ? "text-blue-700" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white shadow-sm rounded-lg border border-blue-100"
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
              <BtUnifiedInfraTab {...props} />
            )}
            {activeTab === "electrical" && (
              <BtUnifiedElectricalTab {...props} />
            )}
            {activeTab === "commercial" && (
              <BtUnifiedCommercialTab {...props} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BtUnifiedDashboard;
