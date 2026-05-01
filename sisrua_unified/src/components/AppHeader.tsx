import React from "react";
import {
  FolderOpen,
  HelpCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Settings,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import HistoryControls from "./HistoryControls";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import type { HealthStatus } from "../hooks/useBackendHealth";
import type { AppLocale } from "../types";
import { getAppHeaderText } from "../i18n/appHeaderText";
import type { HistoryEntry } from "../hooks/useUndoRedo";
import { useReducedMotion } from "../theme/motion";
import { trackHeaderAction, trackAutoSaveStatus } from "../utils/analytics";

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
  autoSaveStatus?: "idle" | "saving" | "error";
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
  autoSaveStatus = "idle",
  lastAutoSaved,
}: AppHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const prefersReducedMotion = useReducedMotion();

  const actionButtonClass =
    "flex items-center justify-center rounded-2xl border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900";

  const t = getAppHeaderText(locale);

  // UX-20: Track autosave errors for error-rate baseline metric
  React.useEffect(() => {
    if (autoSaveStatus === "error") trackAutoSaveStatus("error");
    else if (autoSaveStatus === "saving") trackAutoSaveStatus("saving");
  }, [autoSaveStatus]);

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
    if (file) onOpenProject(file);
    event.currentTarget.value = "";
  };

  return (
    <header
      className={`app-header relative sticky top-0 z-40 flex h-20 shrink-0 items-center justify-between border-b px-4 backdrop-blur-2xl md:px-8 transition-all duration-500 glass-premium ${
        isDark
          ? "border-white/10 bg-slate-950/60 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
          : "border-sky-200/40 bg-white/70 shadow-[0_10px_40px_rgba(148,163,184,0.12)]"
      }`}
    >
      {/* ─── Mobile dropdown menu ─────────────────────────────────── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className={`absolute top-full left-0 right-0 z-50 flex items-center justify-between gap-3 border-b p-4 md:hidden ${
              isDark
                ? "border-white/10 bg-slate-950/95 backdrop-blur-xl"
                : "border-sky-200/50 bg-white/95 backdrop-blur-xl shadow-lg"
            }`}
          >
            <HistoryControls
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={onUndo}
              onRedo={onRedo}
              past={past}
              future={future}
              locale={locale}
            />
            <div className="flex items-center gap-2">
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    trackHeaderAction("save_project");
                    onSaveProject();
                  }}
                  aria-label={t.saveProject}
                  className={`${actionButtonClass} !h-10 !w-10 border-none shadow-sm ${
                    isDark
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-amber-50 text-amber-600"
                  }`}
                  title={t.saveProject}
                >
                  <Save size={18} strokeWidth={2.5} />
                </motion.button>
                <div className="absolute -top-1.5 -right-2">
                  <AutoSaveIndicator
                    status={autoSaveStatus}
                    lastSaved={lastAutoSaved}
                    locale={locale}
                  />
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  trackHeaderAction("open_project");
                  handleOpenProjectClick();
                }}
                aria-label={t.openProject}
                className={`${actionButtonClass} !h-10 !w-10 border-none shadow-sm ${
                  isDark
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-amber-50 text-amber-600"
                }`}
                title={t.openProject}
              >
                <FolderOpen size={18} strokeWidth={2.5} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onOpenHelp}
                className={`${actionButtonClass} !h-10 !w-10 shadow-sm ${
                  isDark
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                    : "border-cyan-200 bg-cyan-50 text-cyan-700"
                }`}
                title={t.openHelp}
              >
                <HelpCircle size={18} strokeWidth={2} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onOpenSettings}
                className={`${actionButtonClass} !h-10 !w-10 shadow-sm ${
                  isDark
                    ? "border-white/10 bg-slate-900 text-slate-300"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
                title={t.openSettings}
              >
                <Settings size={18} strokeWidth={2} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Left section: Logo + branding ───────────────────────── */}
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
                className={`flex items-center justify-center rounded-lg border px-2.5 py-0.5 text-xs font-black tracking-[0.2em] shadow-sm ${
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
              className={`text-xs font-bold uppercase tracking-[0.3em] opacity-80 ${
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
              <span className="text-[8px] font-black text-slate-400">x</span>
              <img
                src="/branding/logo_light_sa.gif"
                alt="Light S.A."
                className="h-3 w-auto opacity-80 grayscale transition-all hover:grayscale-0 hover:opacity-100"
              />
            </div>

            {/* Backend status badge */}
            <motion.div
              aria-live="polite"
              initial={false}
              animate={
                prefersReducedMotion
                  ? false
                  : {
                      scale: backendStatus === "offline" ? [1, 1.02, 1] : 1,
                    }
              }
              transition={{ repeat: Infinity, duration: 2 }}
              className={`group relative flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1 text-xs font-black tracking-wider transition-all duration-500 ${
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
                {backendStatus !== "online" && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      backendStatus === "degraded"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  />
                )}
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

      {/* ─── Right section: actions ───────────────────────────────── */}
      <div className="flex items-center gap-3 lg:gap-6">
        {/* Mobile hamburger — only visible on small screens */}
        <button
          className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-colors md:hidden ${
            isDark
              ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isMobileMenuOpen}
          onClick={() => {
            const next = !isMobileMenuOpen;
            trackHeaderAction(next ? "mobile_menu_open" : "mobile_menu_close");
            setIsMobileMenuOpen(next);
          }}
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Desktop: sidebar toggle + history */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => {
              trackHeaderAction("toggle_sidebar");
              onToggleSidebarCollapsed();
            }}
            className={`group relative ${actionButtonClass} h-11 w-11 shadow-sm ${
              isDark
                ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                : "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100"
            }`}
            aria-expanded={!isSidebarCollapsed}
            aria-controls="sidebar-workspace"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={20} strokeWidth={2.5} />
            ) : (
              <PanelLeftClose size={20} strokeWidth={2.5} />
            )}
            <span className="absolute top-full mt-2 w-max rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100 pointer-events-none z-50">
              {isSidebarCollapsed ? t.toggleSidebarOpen : t.toggleSidebarClose}
            </span>
          </button>

          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            past={past}
            future={future}
            locale={locale}
          />
        </div>

        {isSidebarCollapsed && (
          <div className="hidden flex-col items-center gap-1 xl:flex">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 text-xs font-black uppercase tracking-[0.25em] text-cyan-600 shadow-sm dark:text-cyan-300">
              {t.mapModeInfo}
            </span>
          </div>
        )}

        {/* Desktop: save/open/help/settings — hidden on mobile */}
        <div className="hidden md:flex items-center gap-3">
          
          <button
            onClick={() => {
              trackHeaderAction("open_help");
              onOpenHelp();
            }}
            aria-label={t.openHelp}
            className={`group relative ${actionButtonClass} h-11 w-11 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10`}
          >
            <HelpCircle size={20} strokeWidth={2} />
            <span className="absolute top-full mt-2 w-max rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100 pointer-events-none z-50">
              {t.openHelp}
            </span>
          </button>

          <button
            onClick={() => {
              trackHeaderAction("open_settings");
              onOpenSettings();
            }}
            aria-label={t.openSettings}
            className={`group relative ${actionButtonClass} h-11 w-11 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10`}
          >
            <Settings size={20} strokeWidth={2} />
            <span className="absolute top-full mt-2 w-max rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100 pointer-events-none z-50">
              {t.openSettings}
            </span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

          <button
            onClick={() => {
              trackHeaderAction("open_project");
              handleOpenProjectClick();
            }}
            aria-label={t.openProject}
            className={`group relative ${actionButtonClass} h-11 w-11 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:border-white/20`}
          >
            <FolderOpen size={18} strokeWidth={2} />
            <span className="absolute top-full mt-2 w-max rounded-md bg-slate-800 px-2 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100 pointer-events-none z-50">
              {t.openProject}
            </span>
          </button>

          <div className="relative group">
            <button
              onClick={() => {
                trackHeaderAction("save_project");
                onSaveProject();
              }}
              aria-label={t.saveProject}
              className={`${actionButtonClass} h-11 px-4 border-amber-500 bg-amber-500 text-white font-bold text-sm shadow-sm hover:bg-amber-600 hover:border-amber-600 dark:shadow-none dark:hover:bg-amber-400 dark:hover:border-amber-400`}
              title={t.saveProject}
            >
              <Save size={18} strokeWidth={2.5} className="mr-2" />
              {t.saveProject}
            </button>
            <div className="absolute -top-2 -right-2 transition-all">
              <AutoSaveIndicator
                status={autoSaveStatus}
                lastSaved={lastAutoSaved}
                locale={locale}
              />
            </div>
          </div>
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
