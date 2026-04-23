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

type Props = {
  locale: AppLocale;
  isDark: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
  onOpenSettings: () => void;
  appStatusStackProps: React.ComponentProps<typeof AppStatusStack>;
  appSettingsOverlayProps: React.ComponentProps<typeof AppSettingsOverlay>;
  sidebarWorkspaceProps: React.ComponentProps<typeof SidebarWorkspace>;
  mainMapWorkspaceProps: React.ComponentProps<typeof MainMapWorkspace>;
};

export function AppShellLayout({
  locale,
  isDark,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveProject,
  onOpenProject,
  onOpenSettings,
  appStatusStackProps,
  appSettingsOverlayProps,
  sidebarWorkspaceProps,
  mainMapWorkspaceProps,
}: Props) {
  const backendHealth = useBackendHealth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(
    () => loadSidebarUiState().isCollapsed,
  );

  React.useEffect(() => {
    persistSidebarUiState({ isCollapsed: isSidebarCollapsed });
  }, [isSidebarCollapsed]);

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
        onSaveProject={onSaveProject}
        onOpenProject={onOpenProject}
        onOpenSettings={onOpenSettings}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebarCollapsed={() =>
          setIsSidebarCollapsed((current) => !current)
        }
        isDark={isDark}
        backendStatus={backendHealth.status}
        backendResponseTimeMs={backendHealth.responseTimeMs}
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
        />
      </main>
    </div>
  );
}
