import React from "react";
import {
  FolderOpen,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Settings,
} from "lucide-react";
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
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
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
  isSidebarCollapsed,
  onToggleSidebarCollapsed,
}: AppHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const actionButtonClass =
    "flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all";

  const backendStatusLabel =
    backendStatus === "online"
      ? "Backend online"
      : backendStatus === "degraded"
        ? "Backend degradado"
        : "Backend offline";

  const backendStatusClasses =
    backendStatus === "online"
      ? isDark
        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
        : "border-emerald-700/35 bg-emerald-100 text-emerald-800"
      : backendStatus === "degraded"
        ? isDark
          ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
          : "border-amber-700/35 bg-amber-100 text-amber-800"
        : isDark
          ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
          : "border-rose-700/35 bg-rose-100 text-rose-800";

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
      className={`app-header h-24 shrink-0 border-b-2 px-4 md:px-8 z-30 flex items-center justify-between transition-all ${
        isDark
          ? "border-amber-500/45"
          : "border-amber-700/35 shadow-[0_8px_0_rgba(124,45,18,0.08)]"
      }`}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <motion.div
          whileHover={{ rotate: -6, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-black/20 bg-gradient-to-br from-orange-500 via-amber-500 to-cyan-400 shadow-[5px_5px_0_rgba(15,23,42,0.28)] dark:border-amber-400/50"
        >
          <Layers size={22} className="text-white" aria-hidden="true" />
        </motion.div>
        <div>
          <h1
            className={`font-display text-lg md:text-xl font-extrabold tracking-tight flex items-center gap-2 ${
              isDark ? "text-amber-50" : "text-amber-950"
            }`}
          >
            sisTOPOGRAFIA
            <span
              className={`rounded-xl border-2 px-2 py-0.5 text-[10px] font-black tracking-[0.16em] ${
                isDark
                  ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                  : "border-cyan-700/35 bg-cyan-100 text-cyan-900"
              }`}
            >
              OPS SUITE
            </span>
          </h1>
          <div className="flex items-center gap-2 pt-0.5">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.28em] ${
                isDark ? "text-amber-200" : "text-amber-800"
              }`}
            >
              Mission Control 2.5D
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[10px] font-semibold ${backendStatusClasses}`}
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
        <motion.button
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleSidebarCollapsed}
          className={`${actionButtonClass} ${
            isDark
              ? "border-violet-400/45 bg-violet-500/15 text-violet-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-violet-500/25"
              : "border-violet-700/35 bg-violet-100 text-violet-900 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-violet-200"
          }`}
          title={
            isSidebarCollapsed
              ? "Mostrar painel lateral"
              : "Engavetar painel lateral"
          }
          aria-label={
            isSidebarCollapsed
              ? "Mostrar painel lateral"
              : "Engavetar painel lateral"
          }
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </motion.button>

        <HistoryControls
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
        />
        {isSidebarCollapsed && (
          <span className="hidden rounded-full border-2 border-cyan-700/35 bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-900 xl:inline-flex dark:border-cyan-300/45 dark:bg-cyan-950/35 dark:text-cyan-100">
            Modo mapa: keyboard+mouse
          </span>
        )}

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSaveProject}
            className={`${actionButtonClass} ${
              isDark
                ? "border-amber-500/45 bg-zinc-900 text-amber-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-zinc-800"
                : "border-amber-800/30 bg-amber-50 text-amber-900 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-amber-100"
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
                ? "border-amber-500/45 bg-zinc-900 text-amber-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-zinc-800"
                : "border-amber-800/30 bg-amber-50 text-amber-900 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-amber-100"
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
              ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-cyan-400/25"
              : "border-cyan-700/35 bg-cyan-100 text-cyan-900 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-cyan-200"
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
