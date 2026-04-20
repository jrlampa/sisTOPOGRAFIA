import React from "react";
import {
  FolderOpen,
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
      className={`app-header z-30 flex h-20 shrink-0 items-center justify-between border-b px-4 md:px-8 transition-all ${
        isDark
          ? "border-white/10"
          : "border-sky-200/80 shadow-[0_10px_30px_rgba(148,163,184,0.14)]"
      }`}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-[0_14px_28px_rgba(14,165,198,0.18)] dark:border-white/10 dark:bg-slate-900/80"
        >
          <img
            src="/branding/logo_sisrua_optimized.png"
            alt="Logo sisRUA"
            className="h-8 w-8 object-contain"
          />
        </motion.div>
        <div>
          <h1
            className={`font-display flex items-center gap-2 text-lg font-extrabold tracking-tight md:text-xl ${
              isDark ? "text-slate-50" : "text-slate-900"
            }`}
          >
            <img
              src="/branding/logo_sisrua_optimized.png"
              alt="sisRUA"
              className="h-7 w-7 rounded object-contain"
            />
            <span
              className={`rounded-lg border px-2 py-0.5 text-[9px] font-black tracking-[0.14em] ${
                isDark
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                  : "border-cyan-200 bg-cyan-50 text-cyan-700"
              }`}
            >
              UNIFIED
            </span>
          </h1>
          <div className="flex items-center gap-2 pt-0.5">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.28em] ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Engenharia Geoelétrica
            </p>
            <div className="hidden items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/65 px-2 py-0.5 lg:flex dark:border-slate-700 dark:bg-slate-900/65">
              <img
                src="/branding/logo_im3.png"
                alt="Logo IM3"
                className="h-3.5 w-auto object-contain"
              />
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                x
              </span>
              <img
                src="/branding/logo_light_sa.gif"
                alt="Logo Light S.A."
                className="h-3.5 w-auto object-contain"
              />
            </div>
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
        <motion.button
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleSidebarCollapsed}
          className={`${actionButtonClass} ${
            isDark
              ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
              : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
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
          <span className="hidden rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700 xl:inline-flex dark:border-cyan-300/25 dark:bg-cyan-950/35 dark:text-cyan-100">
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
                ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
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
                ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
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
              ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
