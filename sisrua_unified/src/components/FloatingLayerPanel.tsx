import React, { useEffect, useState } from "react";
import {
  Layers,
  Building2,
  Car,
  TreeDeciduous,
  Mountain,
  LampFloor,
  Type,
  Search,
  X,
} from "lucide-react";
import { AppSettings, LayerConfig } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadFloatingLayerPanelUiState,
  persistFloatingLayerPanelUiState,
} from "../utils/preferencesPersistence";

interface FloatingLayerPanelProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  isDark: boolean;
}

const FloatingLayerPanel: React.FC<FloatingLayerPanelProps> = ({
  settings,
  onUpdateSettings,
  isDark: _isDark,
}) => {
  const [panelUiState, setPanelUiState] = useState(() =>
    loadFloatingLayerPanelUiState(),
  );
  const { isExpanded, searchQuery } = panelUiState;

  useEffect(() => {
    persistFloatingLayerPanelUiState(panelUiState);
  }, [panelUiState]);

  const setIsExpanded = (value: boolean) => {
    setPanelUiState((current) => ({ ...current, isExpanded: value }));
  };

  const setSearchQuery = (value: string) => {
    setPanelUiState((current) => ({ ...current, searchQuery: value }));
  };

  const toggleLayer = (key: keyof LayerConfig) => {
    onUpdateSettings({
      ...settings,
      layers: {
        ...settings.layers,
        [key]: !settings.layers[key],
      },
    });
  };

  const layers = [
    {
      key: "buildings",
      label: "Edifícios",
      icon: Building2,
      colorClass: "text-yellow-500",
    },
    {
      key: "roads",
      label: "Vias / Ruas",
      icon: Car,
      colorClass: "text-rose-500",
    },
    {
      key: "nature",
      label: "Vegetação",
      icon: TreeDeciduous,
      colorClass: "text-emerald-500",
    },
    {
      key: "terrain",
      label: "Terreno 2.5D",
      icon: Mountain,
      colorClass: "text-violet-500",
    },
    {
      key: "furniture",
      label: "Mobiliário",
      icon: LampFloor,
      colorClass: "text-amber-500",
    },
    { key: "labels", label: "Rótulos", icon: Type, colorClass: "text-sky-500" },
  ];

  const filteredLayers = layers.filter((layer) =>
    layer.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const LayerButton = ({
    label,
    icon: Icon,
    active,
    onClick,
    colorClass,
  }: {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    active: boolean;
    onClick: () => void;
    colorClass: string;
  }) => (
    <motion.button
      whileHover={{ x: 4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={`flex items-center w-full p-2.5 rounded-lg transition-all duration-200 border ${
        active
          ? "glass-panel-hover border-white/30 shadow-md"
          : "border-transparent hover:bg-white/20"
      } ${active ? "text-enterprise-blue" : "text-slate-500 dark:text-slate-400"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60`}
    >
      <div
        className={`p-1.5 rounded-md ${active ? "glass-panel" : "bg-white/10"}`}
      >
        <Icon size={16} className={active ? colorClass : "opacity-50"} />
      </div>
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="ml-3 text-[11px] font-bold tracking-wide uppercase"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-3"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={
          isExpanded ? "Fechar painel de camadas" : "Abrir painel de camadas"
        }
        className={`btn-enterprise flex items-center justify-center w-11 h-11 rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${isExpanded ? "bg-cyan-500 text-white" : "text-amber-900 dark:text-amber-100"}`}
      >
        <Layers size={20} />
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-card origin-top-right flex w-52 flex-col gap-1 border-2 p-2"
          >
            {/* Search Bar */}
            <div className="relative mb-2">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar..."
                className="w-full rounded-lg border-2 border-amber-800/25 bg-amber-50 py-1.5 pl-8 pr-7 text-[10px] font-black uppercase tracking-widest text-amber-950 outline-none transition-all placeholder:text-amber-700/70 focus:border-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:border-amber-500/45 dark:bg-zinc-900 dark:text-amber-100 dark:placeholder:text-amber-200/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpar filtro de camadas"
                  title="Limpar filtro de camadas"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:text-slate-800 dark:hover:text-white text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 rounded"
                >
                  <X size={10} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {filteredLayers.length > 0 ? (
                filteredLayers.map((layer) => (
                  <LayerButton
                    key={layer.key}
                    label={layer.label}
                    icon={layer.icon}
                    active={settings.layers[layer.key as keyof LayerConfig]}
                    onClick={() => toggleLayer(layer.key as keyof LayerConfig)}
                    colorClass={layer.colorClass}
                  />
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">
                    Nenhum resultado
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FloatingLayerPanel;
