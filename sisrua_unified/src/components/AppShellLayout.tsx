import React from "react";
import { AppHeader } from "./AppHeader";
import { AppSettingsOverlay } from "./AppSettingsOverlay";
import { AppStatusStack } from "./AppStatusStack";
import { MainMapWorkspace } from "./MainMapWorkspace";
import { SidebarWorkspace } from "./SidebarWorkspace";
import { useBackendHealth } from "../hooks/useBackendHealth";

type Props = {
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

  return (
    <div
      className={`flex flex-col h-screen w-full font-sans transition-colors duration-500 overflow-hidden ${
        isDark ? "bg-[#020617] text-slate-200" : "bg-slate-50 text-slate-900"
      }`}
    >
      <AppStatusStack {...appStatusStackProps} />
      <AppSettingsOverlay {...appSettingsOverlayProps} />
      <AppHeader
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onSaveProject={onSaveProject}
        onOpenProject={onOpenProject}
        onOpenSettings={onOpenSettings}
        isDark={isDark}
        backendStatus={backendHealth.status}
        backendResponseTimeMs={backendHealth.responseTimeMs}
      />
      <main className="flex-1 flex overflow-hidden relative">
        <SidebarWorkspace {...sidebarWorkspaceProps} />
        <MainMapWorkspace {...mainMapWorkspaceProps} />
      </main>
    </div>
  );
}
