import React from "react";
import { AppHeader } from "./AppHeader";
import { AppStatusStack } from "./AppStatusStack";
import { MainMapWorkspace } from "./MainMapWorkspace";
import { SidebarWorkspace } from "./SidebarWorkspace";
import { useBackendHealth } from "../hooks/useBackendHealth";
import {
  loadSidebarUiState,
  persistSidebarUiState,
} from "../utils/preferencesPersistence";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { Drawer } from "./ui/Drawer";

import type { AppLocale } from "../types";
import type { HistoryEntry } from "../hooks/useUndoRedo";
import type { AppSettingsOverlayProps } from "./AppSettingsOverlay";
import type { BimInspectorDrawerProps } from "./BimInspectorDrawer";

const AppSettingsOverlay = React.lazy(() =>
  lazyWithRetry(() =>
    import("./AppSettingsOverlay").then((module) => ({
      default: module.AppSettingsOverlay,
    })),
  ),
);
const BimInspectorDrawer = React.lazy(() =>
  lazyWithRetry(() =>
    import("./BimInspectorDrawer").then((module) => ({
      default: module.BimInspectorDrawer,
    })),
  ),
);

type Props = {
  locale: AppLocale;
  isDark: boolean;
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
  appStatusStackProps: React.ComponentProps<typeof AppStatusStack>;
  appSettingsOverlayProps: AppSettingsOverlayProps;
  sidebarWorkspaceProps: Omit<
    React.ComponentProps<typeof SidebarWorkspace>,
    "isCollapsed" | "onToggleCollapse"
  >;
  mainMapWorkspaceProps: React.ComponentProps<typeof MainMapWorkspace>;
  bimInspectorProps?: BimInspectorDrawerProps;
  hasAreaSelection: boolean;
  onStartSearch: () => void;
  onMapClickAction: () => void;
  autoSaveStatus?: 'idle' | 'saving' | 'error';
  lastAutoSaved?: string;
  isFocusMode?: boolean;
  isXRayMode?: boolean;
};

export function AppShellLayout({
  locale,
  isDark,
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
  appStatusStackProps,
  appSettingsOverlayProps,
  sidebarWorkspaceProps,
  mainMapWorkspaceProps,
  bimInspectorProps,
  hasAreaSelection,
  onStartSearch,
  onMapClickAction,
  autoSaveStatus,
  lastAutoSaved,
  isFocusMode = false,
  isXRayMode = false,
}: Props) {
  const backendHealth = useBackendHealth();
  const [isSidebarCollapsedManual, setIsSidebarCollapsed] = React.useState(
    () => loadSidebarUiState().isCollapsed,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const isSidebarCollapsed = isFocusMode || isSidebarCollapsedManual;

  React.useEffect(() => {
    if (!isFocusMode) {
      persistSidebarUiState({ isCollapsed: isSidebarCollapsedManual });
    }
  }, [isSidebarCollapsedManual, isFocusMode]);

  return (
    <div
      className={`app-shell relative flex h-screen w-full flex-col overflow-hidden font-sans transition-colors duration-500 ${
        isDark ? "text-slate-200" : "text-slate-900"
      }`}
    >
      {/* Skip Link (Quick Win) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-lg focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        Pular para o conteúdo principal
      </a>

      <div className="app-shell-atmosphere" aria-hidden="true">
        <span className="app-shell-orb app-shell-orb-1 blur-[80px] opacity-40" />
        <span className="app-shell-orb app-shell-orb-2 blur-[100px] opacity-30" />
        <span className="app-shell-orb app-shell-orb-3 blur-[60px] opacity-25" />
        <span className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px] animate-pulse" />
      </div>
      <AppStatusStack {...appStatusStackProps} />
      {appSettingsOverlayProps.showSettings && (
        <React.Suspense fallback={null}>
          <AppSettingsOverlay {...appSettingsOverlayProps} />
        </React.Suspense>
      )}
      
      {/* BIM Deep Inspector Drawer */}
      {bimInspectorProps?.isOpen && (
        <React.Suspense fallback={null}>
          <BimInspectorDrawer {...bimInspectorProps} />
        </React.Suspense>
      )}

      {/* Mobile Navigation Drawer (Design System Implementation) */}
      <Drawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        title="Menu"
        position="left"
      >
        <div className="p-4 flex flex-col h-full bg-slate-950/20 backdrop-blur-sm">
          <SidebarWorkspace
            {...sidebarWorkspaceProps}
            isCollapsed={false}
            onToggleCollapse={() => {}}
          />
        </div>
      </Drawer>

      <AppHeader
        locale={locale}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        past={past}
        future={future}
        onSaveProject={onSaveProject}
        onOpenProject={onOpenProject}
        onOpenSettings={onOpenSettings}
        onOpenHelp={onOpenHelp}
        onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebarCollapsed={() =>
          setIsSidebarCollapsed((current) => !current)
        }
        isDark={isDark}
        backendStatus={backendHealth.status}
        backendResponseTimeMs={backendHealth.responseTimeMs}
        autoSaveStatus={autoSaveStatus}
        lastAutoSaved={lastAutoSaved}
      />
      <main 
        id="main-content"
        className="relative z-10 flex flex-1 flex-col overflow-hidden border-t border-white/10 dark:border-white/5 xl:flex-row"
      >
        <SidebarWorkspace
          {...sidebarWorkspaceProps}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={(collapsed) => setIsSidebarCollapsed(collapsed)}
        />
        <MainMapWorkspace
          {...mainMapWorkspaceProps}
          locale={locale}
          isSidebarCollapsed={isSidebarCollapsed}
          onRestoreSidebar={() => setIsSidebarCollapsed(false)}
          hasAreaSelection={hasAreaSelection}
          onStartSearch={onStartSearch}
          onMapClickAction={onMapClickAction}
          isXRayMode={isXRayMode}
        />
      </main>
    </div>
  );
}
