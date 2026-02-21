import { motion } from 'framer-motion';
import { Layers, Sparkles, Settings } from 'lucide-react';
import HistoryControls from './HistoryControls';

interface AppHeaderProps {
  isDark: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  aiSuggestion: string | null;
  onAiPanelOpen: () => void;
  user: { email: string | null; photoURL: string | null } | null;
  onLogin: () => void;
  onLogout: () => void;
  onSettingsOpen: () => void;
}

export default function AppHeader({
  isDark,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  aiSuggestion,
  onAiPanelOpen,
  user,
  onLogin,
  onLogout,
  onSettingsOpen,
}: AppHeaderProps) {
  return (
    <header
      className={`h-20 border-b flex items-center justify-between px-8 shrink-0 z-30 transition-all ${
        isDark
          ? 'border-white/5 bg-[#020617]/80 backdrop-blur-md'
          : 'border-slate-200 bg-white/80 backdrop-blur-md'
      }`}
    >
      <div className="flex items-center gap-4">
        <motion.div
          whileHover={{ rotate: 180 }}
          className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"
        >
          <Layers size={22} className="text-white" />
        </motion.div>
        <div>
          <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
            sisTOPOGRAFIA{' '}
            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20">
              ENGENHARIA
            </span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
            Análise Geográfica Avançada
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <HistoryControls
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />

        {aiSuggestion && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAiPanelOpen}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Sparkles size={16} />
            Analista IA
          </motion.button>
        )}

        {user ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogout}
            className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 rounded-xl flex items-center gap-2 transition-all shadow-lg"
            title={user.email || 'Conta Corporativa'}
          >
            <img
              src={
                user.photoURL ||
                'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
              }
              alt="Avatar"
              className="w-5 h-5 rounded-full border border-white/20"
            />
            <span className="text-[10px] font-bold text-slate-300">SAIR</span>
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogin}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl flex items-center gap-2 transition-all shadow-lg"
          >
            <span className="text-[10px] font-bold">LOGIN</span>
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSettingsOpen}
          className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg"
        >
          <Settings size={20} />
        </motion.button>
      </div>
    </header>
  );
}
