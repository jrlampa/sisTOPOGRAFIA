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
  Box,
  ChevronLeft,
  Camera,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import HistoryControls from "./HistoryControls";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import type { HealthStatus } from "../hooks/useBackendHealth";
import type { AppLocale } from "../types";
import { getAppHeaderText } from "../i18n/appHeaderText";
import type { HistoryEntry } from "../hooks/useUndoRedo";
import { useReducedMotion } from "../theme/motion";
import { trackHeaderAction, trackAutoSaveStatus } from "../utils/analytics";
import { useABTest } from "../hooks/useABTest";

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
  onFeatureSettings?: () => void;
  onOpenSnapshots?: () => void;
  onToggleMobileMenu: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
  isDark: boolean;
  backendStatus: HealthStatus;
  backendResponseTimeMs: number | null;
  autoSaveStatus?: "idle" | "saving" | "error";
  lastAutoSaved?: string;
  projectName?: string;
}

/**
 * AppHeader Component (Tier 3).
 * Responsável pelo branding, status do backend e ações globais.
 * Refatorado para delegar o menu mobile via prop onToggleMobileMenu.
 */
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
  onFeatureSettings,
  onOpenSnapshots: _onOpenSnapshots,
  onToggleMobileMenu,
  isDark,
  backendStatus,
  backendResponseTimeMs,
  isSidebarCollapsed,
  onToggleSidebarCollapsed,
  autoSaveStatus = "idle",
  lastAutoSaved,
  projectName,
}: AppHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const actionButtonClass =
    "flex items-center justify-center rounded-xl border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900";

  const t = getAppHeaderText(locale);
  const isMobileMenuEnabled = useABTest("ux20-mobile-menu-redesign", true);

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
      className={`app-header relative sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur-2xl md:px-6 transition-all duration-500 ${
        isDark
          ? "border-white/5 bg-slate-950/50 shadow-2xl shadow-black/50"
          : "border-sky-200/40 bg-white/60 shadow-[0_10px_40px_rgba(148,163,184,0.12)]"
      }`}
    >
      {/* ─── Esquerda: Logo + Branding ───────────────────────── */}
      <div className="flex items-center gap-4">
        <Link
          to="/portal/projects"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all group shadow-inner"
          title="Voltar ao Portal"
        >
          <ChevronLeft
            size={20}
            className="group-hover:-translate-x-0.5 transition-transform"
          />
        </Link>
        <motion.div
          whileHover={{ scale: 1.05, rotate: -2 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-sky-400/20 bg-gradient-to-b from-white/10 to-white/5 p-1.5 shadow-xl shadow-sky-500/20 dark:border-white/10 dark:bg-slate-900/80 backdrop-blur-md"
        >
          <img
            src="/branding/logo_sisrua_optimized.png"
            alt="Logo sisRUA"
            className="h-6 w-6 object-contain relative z-10"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-transparent opacity-0 transition-opacity hover:opacity-100" />
        </motion.div>

        <div className="flex items-center gap-3">
          <h1
            className={`font-display flex items-center gap-2 text-base font-black tracking-tighter md:text-lg ${
              isDark ? "text-white" : "text-slate-950"
            }`}
          >
            <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
              sis
            </span>
            <span
              className={`flex items-center justify-center rounded-lg border px-2.5 py-0.5 text-[10px] font-black tracking-[0.2em] shadow-inner ${
                isDark
                  ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-300"
                  : "border-cyan-500/20 bg-cyan-500/5 text-cyan-600"
              }`}
            >
              UNIFIED
            </span>
          </h1>

          <div className="hidden h-6 w-px bg-slate-200 dark:bg-white/10 sm:block ml-1" />

          {projectName && (
            <div className="hidden items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 md:flex shadow-inner">
               <Camera size={14} className="text-indigo-400" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                  {projectName}
               </span>
            </div>
          )}

          <div className="hidden sm:block ml-2">
            <motion.div
              aria-live="polite"
              aria-atomic="true"
              initial={false}
              animate={
                prefersReducedMotion
                  ? false
                  : {
                      scale: backendStatus === "offline" ? [1, 1.02, 1] : 1,
                    }
              }
              transition={{ repeat: Infinity, duration: 2 }}
              className={`group relative flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-1 text-[10px] font-black tracking-widest transition-all duration-500 shadow-inner ${
                backendStatus === "online"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : backendStatus === "degraded"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              <span className="sr-only">
                {backendStatusLabel}
                {backendResponseTimeMs != null &&
                  ` (${backendResponseTimeMs} ms)`}
              </span>
              <span className="relative flex h-2 w-2" aria-hidden="true">
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
              <span className="relative z-10 uppercase font-black">
                {backendStatus === "online"
                  ? "API Online"
                  : backendStatus === "degraded"
                    ? "Degradada"
                    : "Offline"}
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ─── Direita: Ações ───────────────────────────────── */}
      <div className="flex items-center gap-3 lg:gap-5">
        {/* Mobile: Hamburger Button */}
        <button
          className={`group relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-1 shadow-sm ${
            isDark
              ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          aria-label={t.openMenu}
          onClick={() => {
            trackHeaderAction("mobile_menu_open");
            onToggleMobileMenu();
          }}
        >
          <Menu size={18} />
        </button>

        {/* Desktop: Sidebar Toggle + History */}
        <div className="hidden md:flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              trackHeaderAction("toggle_sidebar");
              onToggleSidebarCollapsed();
            }}
            className={`group relative ${actionButtonClass} h-10 w-10 shadow-sm ${
              isDark
                ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                : "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100"
            }`}
            aria-expanded={!isSidebarCollapsed}
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
            locale={locale}
          />
        </div>

        {/* Ações de Projeto / Configurações */}
        <div className="hidden md:flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onOpenSettings}
            className={`group relative ${actionButtonClass} h-10 w-10 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10`}
            title={t.openSettings}
          >
            <Settings size={18} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onFeatureSettings}
            className={`group relative ${actionButtonClass} h-10 w-10 border-transparent text-fuchsia-500 hover:text-fuchsia-400 hover:bg-fuchsia-500/10 dark:text-fuchsia-400`}
            title="Modularidade"
          >
            <Box size={18} strokeWidth={2.5} />
          </motion.button>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenProjectClick()}
            className={`group relative ${actionButtonClass} h-10 w-10 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400`}
            title={t.openProject}
          >
            <FolderOpen size={18} strokeWidth={2.5} />
          </motion.button>

          <div className="relative group ml-1">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onSaveProject()}
              className={`${actionButtonClass} h-10 px-4 border-amber-500/50 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg hover:brightness-110`}
            >
              <Save size={16} strokeWidth={2.5} className="mr-2" />
              {t.saveProject}
            </motion.button>
            <div className="absolute -top-2.5 -right-2.5 z-50">
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
        className="hidden"
      />
    </header>
  );
}
