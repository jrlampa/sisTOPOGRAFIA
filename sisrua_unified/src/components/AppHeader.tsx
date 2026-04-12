import React from "react";
import { FolderOpen, Layers, Save, Settings } from "lucide-react";
import { motion } from "framer-motion";
import HistoryControls from "./HistoryControls";

interface AppHeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
  onOpenSettings: () => void;
  isDark: boolean;
}

export function AppHeader({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveProject,
  onOpenProject,
  onOpenSettings,
  isDark,
}: AppHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleOpenProjectClick = () => {
    fileInputRef.current?.click();
  };

  const handleProjectFileChange: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      onOpenProject(file);
    }

    // Allow selecting the same file repeatedly.
    event.currentTarget.value = "";
  };

  return (
    <header
      className={`h-20 border-b flex items-center justify-between px-8 shrink-0 z-30 transition-all ${isDark ? "border-white/5 bg-[#020617]/80 backdrop-blur-md" : "border-slate-200 bg-white/80 backdrop-blur-md"}`}
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
            SIS RUA{" "}
            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20">
              UNIFIED
            </span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
            Análise Geo Avançada
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

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSaveProject}
            className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg"
            title="Salvar projeto"
          >
            <Save size={18} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenProjectClick}
            className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg"
            title="Abrir projeto"
          >
            <FolderOpen size={18} />
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".srua,.json"
            title="Selecionar arquivo de projeto"
            aria-label="Selecionar arquivo de projeto"
            onChange={handleProjectFileChange}
            className="hidden"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          className="p-2.5 glass rounded-xl text-slate-300 hover:text-white transition-colors shadow-lg"
        >
          <Settings size={20} />
        </motion.button>
      </div>
    </header>
  );
}
