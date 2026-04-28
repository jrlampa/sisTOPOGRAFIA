import React from "react";
import {
  FolderOpen,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import HistoryControls from "./HistoryControls";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import type { HealthStatus } from "../hooks/useBackendHealth";
import type { AppLocale } from "../types";
import { getAppHeaderText } from "../i18n/appHeaderText";
import type { HistoryEntry } from "../hooks/useUndoRedo";

interface AppHeaderProps {
  locale: AppLocale;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  past?: HistoryEntry<any>[];
  future?: HistoryEntry<any>[];
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
  isDark: boolean;
  backendStatus: HealthStatus;
  backendResponseTimeMs: number | null;
  autoSaveStatus?: 'idle' | 'saving' | 'error';
  lastAutoSaved?: string;
}

export function AppHeader({
  locale,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  past = [],
  future = [],
  onSaveProject,
  onOpenProject,
  onOpenSettings,
  onOpenHelp,
  isDark,
  backendStatus,
  backendResponseTimeMs,
  isSidebarCollapsed,
  onToggleSidebarCollapsed,
  autoSaveStatus = 'idle',
  lastAutoSaved,
}: AppHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const actionButtonClass =
    "flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all";

  const t = getAppHeaderText(locale);

  const backendStatusLabel =
    backendStatus === "online"
      ? t.backendStatusOnline
      : backendStatus === "degraded"
        ? t.backendStatusDegraded
        : t.backendStatusOffline;

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
      className={`app-header sticky top-0 z-40 flex h-20 shrink-0 items-center justify-between border-b px-4 backdrop-blur-xl md:px-8 transition-all duration-500 ${
        isDark
          ? "border-white/10 bg-slate-950/80 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
          : "border-sky-200/50 bg-white/75 shadow-[0_10px_40px_rgba(148,163,184,0.12)]"
      }`}
    >
      <div className="flex items-center gap-4 md:gap-6">
        <motion.div
          whileHover={{ scale: 1.05, rotate: -2 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-sky-400/20 bg-white p-2 shadow-2xl shadow-sky-500/20 dark:border-white/10 dark:bg-slate-900"
        >
          <img
            src="/branding/logo_sisrua_optimized.png"
            alt="Logo sisRUA"
            className="h-10 w-10 object-contain"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent opacity-0 transition-opacity hover:opacity-100" />
        </motion.div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <h1
              className={`font-display flex items-center gap-3 text-xl font-black tracking-tight md:text-2xl ${
                isDark ? "text-white" : "text-slate-950"
              }`}
            >
              <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-400">
                sis|
              </span>
              <span
                className={`flex items-center justify-center rounded-lg border px-2.5 py-0.5 text-[10px] font-black tracking-[0.2em] shadow-sm ${
                  isDark
                    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
                    : "border-cyan-500/20 bg-cyan-500/5 text-cyan-600"
                }`}
              >
                UNIFIED
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.3em] opacity-80 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {t.geoelectricEngineering}
            </p>

            <div className="hidden items-center gap-2 rounded-full border border-slate-200/50 bg-white/40 px-2.5 py-1 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/40 lg:flex">
              <img
                src="/branding/logo_im3.png"
                alt="IM3"
                className="h-3 w-auto opacity-80 grayscale transition-all hover:grayscale-0 hover:opacity-100"
              />
              <span className="text-[8px] font-black text-slate-400">×</span>
              <img
                src="/branding/logo_light_sa.gif"
                alt="Light S.A."
                className="h-3 w-auto opacity-80 grayscale transition-all hover:grayscale-0 hover:opacity-100"
              />
            </div>

            <motion.div
              initial={false}
              animate={{
                scale: backendStatus === "offline" ? [1, 1.02, 1] : 1,
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`group relative flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1 text-[10px] font-black tracking-wider transition-all duration-500 ${
                backendStatus === "online"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                  : backendStatus === "degraded"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                    : "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
              }`}
              title={
                backendResponseTimeMs != null
                  ? `${backendStatusLabel} (${backendResponseTimeMs} ms)`
                  : backendStatusLabel
              }
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    backendStatus === "online"
                      ? "bg-emerald-500"
                      : backendStatus === "degraded"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    backendStatus === "online"
                      ? "bg-emerald-500"
                      : backendStatus === "degraded"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                />
              </span>
              <span className="relative z-10 uppercase">
                {backendStatus === "online"
                  ? t.apiOnline
                  : backendStatus === "degraded"
                    ? t.apiDegraded
                    : t.apiOffline}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 lg:gap-8">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSidebarCollapsed}
            className={`${actionButtonClass} shadow-lg transition-all duration-300 ${
              isDark
                ? "border-white/10 bg-white/5 text-slate-100 shadow-black/20 hover:bg-white/10 hover:shadow-cyan-500/10"
                : "border-sky-100 bg-sky-50 text-sky-700 shadow-sky-500/5 hover:bg-sky-100 hover:shadow-sky-500/10"
            }`}
            title={
              isSidebarCollapsed ? t.toggleSidebarOpen : t.toggleSidebarClose
            }
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={20} strokeWidth={2.5} />
            ) : (
              <PanelLeftClose size={20} strokeWidth={2.5} />
            )}
          </motion.button>

          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            past={past}
            future={future}
          />
        </div>

        {isSidebarCollapsed && (
          <div className="hidden flex-col items-center gap-1 xl:flex">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-cyan-600 shadow-sm dark:text-cyan-300">
              {t.mapModeInfo}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100/50 p-1 dark:bg-slate-800/50">
            <div className="relative group">
              <motion.button
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSaveProject}
                className={`${actionButtonClass} !h-10 !w-10 border-none shadow-sm ${
                  isDark
                    ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "bg-white text-amber-600 hover:bg-amber-50"
                }`}
                title={t.saveProject}
              >
                <Save size={18} strokeWidth={2.5} />
              </motion.button>
              
              <div className="absolute -top-1.5 -right-2 transition-all">
                <AutoSaveIndicator status={autoSaveStatus} lastSaved={lastAutoSaved} />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenProjectClick}
              className={`${actionButtonClass} !h-10 !w-10 border-none shadow-sm ${
                isDark
                  ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  : "bg-white text-amber-600 hover:bg-amber-50"
              }`}
              title={t.openProject}
            >
              <FolderOpen size={18} strokeWidth={2.5} />
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenHelp}
            className={`${actionButtonClass} !h-12 !w-12 shadow-lg transition-all ${
              isDark
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 shadow-cyan-200/50"
            }`}
            title={t.openHelp}
          >
            <HelpCircle size={22} strokeWidth={2} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenSettings}
            className={`${actionButtonClass} !h-12 !w-12 shadow-lg transition-all ${
              isDark
                ? "border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-slate-200/50"
            }`}
            title={t.openSettings}
          >
            <Settings size={22} strokeWidth={2} />
          </motion.button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".srua,.json"
        onChange={handleProjectFileChange}
        aria-label={t.selectProjectFile}
        className="hidden"
      />
    </header>
  );
}
