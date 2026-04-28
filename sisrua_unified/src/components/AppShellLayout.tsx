import React from "react";
import { AppHeader } from "./AppHeader";
import { AppSettingsOverlay } from "./AppSettingsOverlay";
import { AppStatusStack } from "./AppStatusStack";
import { MainMapWorkspace } from "./MainMapWorkspace";
import { SidebarWorkspace } from "./SidebarWorkspace";
import { useBackendHealth } from "../hooks/useBackendHealth";
import {
  loadSidebarUiState,
  persistSidebarUiState,
} from "../utils/preferencesPersistence";

import type { AppLocale } from "../types";
import type { HistoryEntry } from "../hooks/useUndoRedo";

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
  appSettingsOverlayProps: React.ComponentProps<typeof AppSettingsOverlay>;
  sidebarWorkspaceProps: Omit<React.ComponentProps<typeof SidebarWorkspace>, "isCollapsed">;
  mainMapWorkspaceProps: React.ComponentProps<typeof MainMapWorkspace>;
  hasAreaSelection: boolean;
  onStartSearch: () => void;
  onMapClickAction: () => void;
  autoSaveStatus?: 'idle' | 'saving' | 'error';
  lastAutoSaved?: string;
  isFocusMode?: boolean;
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
  hasAreaSelection,
  onStartSearch,
  onMapClickAction,
  autoSaveStatus,
  lastAutoSaved,
  isFocusMode = false,
}: Props) {
  const backendHealth = useBackendHealth();
  const [isSidebarCollapsedManual, setIsSidebarCollapsed] = React.useState(
    () => loadSidebarUiState().isCollapsed,
  );

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
      <div className="app-shell-atmosphere" aria-hidden="true">
        <span className="app-shell-orb app-shell-orb-1" />
        <span className="app-shell-orb app-shell-orb-2" />
        <span className="app-shell-orb app-shell-orb-3" />
      </div>
      <AppStatusStack {...appStatusStackProps} />
      <AppSettingsOverlay {...appSettingsOverlayProps} />
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
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden border-t border-slate-200/80 dark:border-white/10 xl:flex-row">
        <SidebarWorkspace
          {...sidebarWorkspaceProps}
          isCollapsed={isSidebarCollapsed}
        />
        <MainMapWorkspace
          {...mainMapWorkspaceProps}
          locale={locale}
          isSidebarCollapsed={isSidebarCollapsed}
          onRestoreSidebar={() => setIsSidebarCollapsed(false)}
          hasAreaSelection={hasAreaSelection}
          onStartSearch={onStartSearch}
          onMapClickAction={onMapClickAction}
        />
      </main>
    </div>
  );
}
