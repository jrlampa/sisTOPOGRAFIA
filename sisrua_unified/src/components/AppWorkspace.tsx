import React from "react";
import { SidebarWorkspace } from "./SidebarWorkspace";
import { AppHeader } from "./AppHeader";
import MapSelector from "./MapSelector";
import { SessionRecoveryBanner } from "./SessionRecoveryBanner";
import { HelpModal } from "./HelpModal";
import SettingsModal from "./SettingsModal";
import { BtModalStack } from "./BtModalStack";
import { BimInspectorDrawer } from "./BimInspectorDrawer";
import { ElectricalAuditDrawer } from "./ElectricalAuditDrawer";
import { BtTelescopicSuggestionModal } from "./BtTelescopicSuggestionModal";
import Toast from "./Toast";
import { CommandPalette } from "./CommandPalette";
import { FeatureSettingsModal } from "./FeatureSettingsModal";
import { JurisdictionStatus } from "./JurisdictionStatus";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { useMultiplayer } from "../hooks/useMultiplayer";
import { useNeighborhoodAwareness } from "../hooks/useNeighborhoodAwareness";
import { MultiplayerAvatars } from "./MultiplayerAvatars";
import { useAuth } from "../auth/AuthProvider";
import type { AppSettings, BtNetworkScenarioPayload, GlobalState } from '../types';
import type { HistoryEntry } from '../hooks/useUndoRedo';
import type { Toast as ToastItem } from '../hooks/useToast';

type AppWorkspaceProps = {
  settings: AppSettings;
  isDark: boolean;
  isFocusMode: boolean;
  isXRayMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  appPast: HistoryEntry<GlobalState>[];
  appFuture: HistoryEntry<GlobalState>[];
  handleSaveProject: () => void;
  handleLoadProject: (file: File) => void;
  openSettings: () => void;
  setIsHelpOpen: (open: boolean) => void;
  toasts: ToastItem[];
  closeToast: (id?: string) => void;
  sessionDraft: GlobalState | null;
  handleRestoreSession: () => void;
  handleDismissSession: () => void;
  isProcessing: boolean;
  isDownloading: boolean;
  progressValue: number;
  statusMessage: string;
  showDxfProgress: boolean;
  dxfProgressValue: number;
  dxfProgressStatus: string;
  dxfProgressLabel: string;
  latestBtExport: { timestamp: string; filename: string } | null;
  btExportHistory: Array<{ timestamp: string; filename: string }>;
  exportBtHistoryJson: () => void;
  exportBtHistoryCsv: () => void;
  handleClearBtExportHistory: () => void;
  btHistoryTotal: number;
  btHistoryLoading: boolean;
  btHistoryCanLoadMore: boolean;
  handleLoadMoreBtHistory: () => void;
  btHistoryProjectTypeFilter: string;
  setBtHistoryProjectTypeFilter: (v: string) => void;
  btHistoryCqtScenarioFilter: string;
  setBtHistoryCqtScenarioFilter: (v: string) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  selectionMode: any;
  handleSelectionModeChange: (m: any) => void;
  radius: number;
  handleRadiusChange: (r: number) => void;
  polygon: any[];
  handleClearPolygon: () => void;
  osmData: any;
  handleDownloadDxf: () => Promise<void>;
  handleDownloadGeoJSON: () => void;
  isSidebarDockedForRamalModal: boolean;
  sidebarSelectionControlsProps: any;
  sidebarBtEditorSectionProps: any;
  mtTopology: any;
  updateMtTopology: (t: any) => void;
  hasBtPoles: boolean;
  sidebarAnalysisResultsProps: any;
  mapSelectorProps: any;
  elevationProfileData: any[];
  clearProfile: () => void;
  btModalStackProps: any;
  showToast: (m: string, t: any) => void;
  isBimInspectorOpen: boolean;
  setIsBimInspectorOpen: (o: boolean) => void;
  inspectedPole: any;
  inspectedTransformer: any;
  inspectedAccumulatedData: any;
  btTopology: any;
  handleBtRenamePole: (id: string, name: string) => void;
  handleBtSetPoleChangeFlag: (id: string, f: any) => void;
  autoSaveStatus: string;
  lastAutoSaved: string | undefined;
  isAuditOpen: boolean;
  setIsAuditOpen: (o: boolean) => void;
  selectedAuditElement: any;
  handleAuditAction: (action: "approve" | "reject", notes: string) => void;
  btTelescopicSuggestions: any[];
  handleApplyTelescopicSuggestions: (s: any) => void;
  clearBtTelescopicSuggestions: () => void;
  isHelpOpen: boolean;
  onOpenSnapshots: () => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (o: boolean) => void;
  commandPaletteActions: any[];
  handleGoToPole: (id: string) => void;
  terrainData?: any;
  showSettings?: boolean;
  closeSettings?: () => void;
  isCalculating?: boolean;
  complianceResults?: any;
  children?: React.ReactNode;
};

export function AppWorkspace({
  settings,
  isDark,
  isFocusMode: _isFocusMode,
  isXRayMode: _isXRayMode,
  canUndo,
  canRedo,
  undo,
  redo,
  appPast: _appPast,
  appFuture: _appFuture,
  handleSaveProject,
  handleLoadProject,
  openSettings,
  setIsHelpOpen,
  toasts,
  closeToast,
  sessionDraft,
  handleRestoreSession,
  handleDismissSession,
  isProcessing: _isProcessing,
  isDownloading: _isDownloading,
  progressValue: _progressValue,
  statusMessage: _statusMessage,
  showDxfProgress: _showDxfProgress,
  dxfProgressValue: _dxfProgressValue,
  dxfProgressStatus: _dxfProgressStatus,
  dxfProgressLabel: _dxfProgressLabel,
  latestBtExport: _latestBtExport,
  btExportHistory: _btExportHistory,
  exportBtHistoryJson: _exportBtHistoryJson,
  exportBtHistoryCsv: _exportBtHistoryCsv,
  handleClearBtExportHistory: _handleClearBtExportHistory,
  btHistoryTotal: _btHistoryTotal,
  btHistoryLoading: _btHistoryLoading,
  btHistoryCanLoadMore: _btHistoryCanLoadMore,
  handleLoadMoreBtHistory: _handleLoadMoreBtHistory,
  btHistoryProjectTypeFilter: _btHistoryProjectTypeFilter,
  setBtHistoryProjectTypeFilter: _setBtHistoryProjectTypeFilter,
  btHistoryCqtScenarioFilter: _btHistoryCqtScenarioFilter,
  setBtHistoryCqtScenarioFilter: _setBtHistoryCqtScenarioFilter,
  updateSettings,
  selectionMode,
  handleSelectionModeChange: _handleSelectionModeChange,
  radius: _radius,
  handleRadiusChange: _handleRadiusChange,
  polygon,
  handleClearPolygon: _handleClearPolygon,
  osmData,
  handleDownloadDxf: _handleDownloadDxf,
  handleDownloadGeoJSON: _handleDownloadGeoJSON,
  isSidebarDockedForRamalModal,
  sidebarSelectionControlsProps,
  sidebarBtEditorSectionProps,
  mtTopology,
  updateMtTopology,
  hasBtPoles,
  sidebarAnalysisResultsProps,
  mapSelectorProps,
  elevationProfileData: _elevationProfileData,
  clearProfile: _clearProfile,
  btModalStackProps,
  showToast: _showToast,
  isBimInspectorOpen,
  setIsBimInspectorOpen,
  inspectedPole,
  inspectedTransformer,
  inspectedAccumulatedData,
  btTopology,
  handleBtRenamePole,
  handleBtSetPoleChangeFlag,
  autoSaveStatus,
  lastAutoSaved,
  isAuditOpen,
  setIsAuditOpen,
  selectedAuditElement,
  handleAuditAction,
  btTelescopicSuggestions,
  handleApplyTelescopicSuggestions,
  clearBtTelescopicSuggestions,
  isHelpOpen,
  onOpenSnapshots,
  isCommandPaletteOpen,
  setIsCommandPaletteOpen,
  commandPaletteActions,
  handleGoToPole: _handleGoToPole,
  terrainData: _terrainData,
  showSettings,
  closeSettings,
  isCalculating: _isCalculating,
  complianceResults,
  children,
}: AppWorkspaceProps) {
  const { flags } = useFeatureFlags();
  const { user } = useAuth();
  const [isFeatureSettingsOpen, setIsFeatureSettingsOpen] = React.useState(false);

  const { neighbors, hasCollision } = useNeighborhoodAwareness(
    mapSelectorProps?.center,
    selectionMode,
    polygon,
    "current-project"
  );

  const { onlineUsers } = useMultiplayer(
    flags.enableMultiplayer ? "global-project" : "",
    { id: user?.id || "anon", name: user?.email?.split("@")[0] || "Visitante" }
  );

  return (
    <div className={`app-shell relative flex h-screen w-full flex-col overflow-hidden font-sans transition-colors duration-500 ${isDark ? "dark text-slate-200" : "text-slate-900"}`}>
      {/* Header */}
      <AppHeader
        locale={settings.locale}
        isDark={isDark}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onSaveProject={handleSaveProject}
        onOpenProject={handleLoadProject}
        onOpenSettings={openSettings}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenSnapshots={onOpenSnapshots}
        onFeatureSettings={() => setIsFeatureSettingsOpen(true)}
        onToggleMobileMenu={() => {}}
        projectName={settings.projectMetadata?.projectName || "Novo Projeto"}
        autoSaveStatus={autoSaveStatus as any}
        lastAutoSaved={lastAutoSaved}
        isSidebarCollapsed={!!settings.sidebarCollapsed}
        onToggleSidebarCollapsed={() => updateSettings({ ...settings, sidebarCollapsed: !settings.sidebarCollapsed })}
        backendStatus="online"
        backendResponseTimeMs={45}
      />

      {/* Body: Sidebar + Main */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden xl:flex-row">
        {/* Sidebar */}
        <SidebarWorkspace
          locale={settings.locale}
          isCollapsed={!!settings.sidebarCollapsed}
          onToggleCollapse={(c) => updateSettings({ ...settings, sidebarCollapsed: c })}
          isSidebarDockedForRamalModal={isSidebarDockedForRamalModal}
          selectionControlsProps={sidebarSelectionControlsProps}
          btEditorSectionProps={sidebarBtEditorSectionProps}
          mtEditorSectionProps={{
            mtTopology,
            updateMtTopology,
            btTopology,
            hasBtPoles,
          }}
          analysisResultsProps={sidebarAnalysisResultsProps}
        />

        {/* Main Map Area */}
        <main className="relative flex-1 bg-slate-900 overflow-hidden rounded-tl-3xl shadow-inner">
          {mapSelectorProps ? (
            <MapSelector
              {...mapSelectorProps}
              measurePath={[]}
              onMeasurePathChange={() => {}}
              osmData={osmData}
              locale={settings.locale}
              theme={settings.theme}
              complianceResults={complianceResults}
              flags={flags}
              neighbors={neighbors}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 text-sm">
              Carregando mapa…
            </div>
          )}

          {/* HUD Elements */}
          <div className="pointer-events-none absolute inset-0 z-30 p-6 flex flex-col justify-between overflow-hidden">
            <div className="flex flex-col items-start gap-4">
              <SessionRecoveryBanner
                sessionDraft={sessionDraft as any}
                onRestore={handleRestoreSession}
                onDismiss={handleDismissSession}
              />
              {flags.enableMultiplayer && (
                <div className="pointer-events-auto">
                  <MultiplayerAvatars users={onlineUsers} />
                </div>
              )}

              <JurisdictionStatus
                topology={btTopology}
                selectionMode={selectionMode}
                hasPolygon={polygon.length >= 3}
                hasCollision={hasCollision}
              />
            </div>
          </div>

          {/* Modals & Overlays */}
          {btModalStackProps && <BtModalStack {...btModalStackProps} />}

          <BimInspectorDrawer
            isOpen={isBimInspectorOpen}
            onClose={() => setIsBimInspectorOpen(false)}
            pole={inspectedPole}
            transformer={inspectedTransformer}
            accumulatedData={inspectedAccumulatedData}
            btTopology={btTopology}
            onRenamePole={handleBtRenamePole}
            onSetPoleChangeFlag={handleBtSetPoleChangeFlag}
            locale={settings.locale}
          />

          <ElectricalAuditDrawer
            isOpen={isAuditOpen}
            onClose={() => setIsAuditOpen(false)}
            selectedElement={selectedAuditElement}
            onAuditAction={handleAuditAction}
            locale={settings.locale}
          />

          <BtTelescopicSuggestionModal
            output={btTelescopicSuggestions?.length ? { suggestions: btTelescopicSuggestions, lmaxByConductor: {} } : null}
            onApply={(out) => handleApplyTelescopicSuggestions(out)}
            onCancel={clearBtTelescopicSuggestions}
          />

          <HelpModal
            isOpen={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
            locale={settings.locale}
          />

          <FeatureSettingsModal
            isOpen={isFeatureSettingsOpen}
            onClose={() => setIsFeatureSettingsOpen(false)}
          />

          {showSettings && (
            <SettingsModal
              isOpen={!!showSettings}
              settings={settings}
              onUpdateSettings={updateSettings as any}
              onClose={closeSettings || (() => {})}
            />
          )}

          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            actions={commandPaletteActions}
            locale={settings.locale}
          />

          {children}

          <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none">
            {toasts.map((t, idx) => (
              <Toast
                key={t.id}
                message={t.message}
                type={t.type}
                onClose={() => closeToast(t.id)}
                stackOffset={idx}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
