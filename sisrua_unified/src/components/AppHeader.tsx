import React from "react";
import { FolderOpen, Layers, Save, Settings } from "lucide-react";
import { motion } from "framer-motion";
import HistoryControls from "./HistoryControls";
import type { HealthStatus } from "../hooks/useBackendHealth";

interface AppHeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
  onOpenSettings: () => void;
  isDark: boolean;
  backendStatus: HealthStatus;
  backendResponseTimeMs: number | null;
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
  backendStatus,
  backendResponseTimeMs,
}: AppHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const actionButtonClass =
    "rounded-xl border px-3 py-2 transition-colors shadow-sm backdrop-blur-sm";

  const backendStatusLabel =
    backendStatus === "online"
      ? "Backend online"
      : backendStatus === "degraded"
        ? "Backend degradado"
        : "Backend offline";

  const backendStatusClasses =
    backendStatus === "online"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
      : backendStatus === "degraded"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
        : "border-rose-400/30 bg-rose-500/10 text-rose-300";

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
      className={`h-20 border-b flex items-center justify-between px-5 md:px-8 shrink-0 z-30 transition-all ${
        isDark
          ? "border-white/10 bg-slate-950/70 backdrop-blur-lg"
          : "border-emerald-900/10 bg-white/70 backdrop-blur-lg"
      }`}
    >
      <div className="flex items-center gap-4">
        <motion.div
          whileHover={{ rotate: 16, scale: 1.04 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="w-11 h-11 bg-gradient-to-br from-sky-600 via-blue-600 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/30"
        >
          <Layers size={22} className="text-white" aria-hidden="true" />
        </motion.div>
        <div>
          <h1
            className={`font-display text-lg md:text-xl font-extrabold tracking-tight flex items-center gap-2 ${
              isDark ? "text-slate-50" : "text-slate-900"
            }`}
          >
            sisTOPOGRAFIA
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                isDark
                  ? "bg-cyan-500/10 text-cyan-300 border-cyan-400/30"
                  : "bg-emerald-500/10 text-emerald-700 border-emerald-700/25"
              }`}
            >
              UNIFIED
            </span>
          </h1>
          <div className="flex items-center gap-2 pt-0.5">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.28em] ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Plataforma Geoespacial 2.5D
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${backendStatusClasses}`}
              title={
                backendResponseTimeMs != null
                  ? `${backendStatusLabel} (${backendResponseTimeMs} ms)`
                  : backendStatusLabel
              }
              aria-label={
                backendResponseTimeMs != null
                  ? `${backendStatusLabel}. Latência ${backendResponseTimeMs} milissegundos`
                  : backendStatusLabel
              }
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {backendStatus === "online"
                ? "API ONLINE"
                : backendStatus === "degraded"
                  ? "API DEGRADADA"
                  : "API OFFLINE"}
            </span>
          </div>
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
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSaveProject}
            className={`${actionButtonClass} ${
              isDark
                ? "border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
                : "border-emerald-900/10 bg-white/80 text-slate-700 hover:bg-white"
            }`}
            title="Salvar projeto"
            aria-label="Salvar projeto"
          >
            <Save size={18} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpenProjectClick}
            className={`${actionButtonClass} ${
              isDark
                ? "border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
                : "border-emerald-900/10 bg-white/80 text-slate-700 hover:bg-white"
            }`}
            title="Abrir projeto"
            aria-label="Abrir projeto"
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
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          className={`${actionButtonClass} ${
            isDark
              ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
              : "border-sky-700/20 bg-sky-600/10 text-sky-700 hover:bg-sky-600/20"
          }`}
          title="Abrir configurações"
          aria-label="Abrir configurações"
        >
          <Settings size={20} />
        </motion.button>
      </div>
    </header>
  );
}
