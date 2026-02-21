import { motion } from 'framer-motion';
import { ShieldAlert, Sun, LayoutDashboard, Droplets, Sparkles } from 'lucide-react';

interface MapOverlayControlsProps {
  activeHeatmap: 'none' | 'slope' | 'solar';
  onHeatmapChange: (h: 'none' | 'slope' | 'solar') => void;
  economicData: unknown;
  isDashboardVisible: boolean;
  onDashboardToggle: () => void;
  longitudinalProfile: unknown;
  isProfilePanelVisible: boolean;
  onProfilePanelToggle: () => void;
  aiSuggestion: string | null;
  isAiPanelVisible: boolean;
  onAiPanelToggle: () => void;
}

export default function MapOverlayControls({
  activeHeatmap,
  onHeatmapChange,
  economicData,
  isDashboardVisible,
  onDashboardToggle,
  longitudinalProfile,
  isProfilePanelVisible,
  onProfilePanelToggle,
  aiSuggestion,
  isAiPanelVisible,
  onAiPanelToggle,
}: MapOverlayControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
      <button
        onClick={() =>
          onHeatmapChange(activeHeatmap === 'slope' ? 'none' : 'slope')
        }
        className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${
          activeHeatmap === 'slope'
            ? 'bg-rose-600 border-rose-500 text-white'
            : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'
        }`}
      >
        <ShieldAlert size={16} />
        {activeHeatmap === 'slope' ? 'Declividade Ativa' : 'Mapa de Declividade'}
      </button>

      <button
        onClick={() =>
          onHeatmapChange(activeHeatmap === 'solar' ? 'none' : 'solar')
        }
        className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${
          activeHeatmap === 'solar'
            ? 'bg-amber-600 border-amber-500 text-white'
            : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'
        }`}
      >
        <Sun size={16} />
        {activeHeatmap === 'solar' ? 'Insolação Ativa' : 'Mapa Solar'}
      </button>

      {economicData && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onDashboardToggle}
          className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${
            isDashboardVisible
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard size={16} />
          Dashboard ROI
        </motion.button>
      )}

      {longitudinalProfile && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onProfilePanelToggle}
          className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${
            isProfilePanelVisible
              ? 'bg-blue-600 border-blue-400 text-white'
              : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Droplets
            size={16}
            className={isProfilePanelVisible ? 'text-white' : 'text-blue-400'}
          />
          Perfil Longitudinal
        </motion.button>
      )}

      {aiSuggestion && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onAiPanelToggle}
          className={`p-3 rounded-2xl border transition-all shadow-2xl flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${
            isAiPanelVisible
              ? 'bg-indigo-600 border-indigo-400 text-white'
              : 'bg-slate-900/80 backdrop-blur-md border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles size={16} />
          Analista IA
        </motion.button>
      )}
    </div>
  );
}
