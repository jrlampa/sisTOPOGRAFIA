import React from "react";
import { AppShellLayout } from "./AppShellLayout";
import { GuidedTaskChecklist } from "./GuidedTaskChecklist";
import { AppSettings, BtTopology, MtTopology, SelectionMode } from "../types";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import {
  BtPoleAccumulatedDemand
} from "../services/btDerivedService";
import { getMainMapWorkspaceText } from "../i18n/mainMapWorkspaceText";
import { getGuidedTaskChecklistText } from "../i18n/guidedTaskChecklistText";

const ElectricalAuditDrawer = React.lazy(() =>
  lazyWithRetry(() =>
    import("./ElectricalAuditDrawer").then((module) => ({
      default: module.ElectricalAuditDrawer,
    })),
  ),
);
const BtTelescopicSuggestionModal = React.lazy(() =>
  lazyWithRetry(() =>
    import("./BtTelescopicSuggestionModal").then((module) => ({
      default: module.BtTelescopicSuggestionModal,
    })),
  ),
);
const HelpModal = React.lazy(() =>
  lazyWithRetry(() =>
    import("./HelpModal").then((module) => ({
      default: module.HelpModal,
    })),
  ),
);
const CommandPalette = React.lazy(() =>
  lazyWithRetry(() =>
    import("./CommandPalette").then((module) => ({
      default: module.CommandPalette,
    })),
  ),
);

interface AppWorkspaceProps {
  settings: AppSettings;
  isDark: boolean;
  isFocusMode: boolean;
  isXRayMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  appPast: any[];
  appFuture: any[];
  handleSaveProject: () => void;
  handleLoadProject: (file: File) => void;
  openSettings: () => void;
  setIsHelpOpen: (open: boolean) => void;
  toasts: any[];
  closeToast: (id?: string) => void;
  sessionDraft: any;
  handleRestoreSession: () => void;
  handleDismissSession: () => void;
  isProcessing: boolean;
  isDownloading: boolean;
  progressValue: number;
  statusMessage: string;
  showDxfProgress: boolean;
  dxfProgressValue: number;
  dxfProgressStatus: string | null;
  dxfProgressLabel: string;
  latestBtExport: any;
  btExportHistory: any[];
  exportBtHistoryJson: () => void;
  exportBtHistoryCsv: () => void;
  handleClearBtExportHistory: () => void;
  btHistoryTotal: number;
  btHistoryLoading: boolean;
  btHistoryCanLoadMore: boolean;
  handleLoadMoreBtHistory: () => void;
  btHistoryProjectTypeFilter: "all" | "ramais" | "clandestino";
  setBtHistoryProjectTypeFilter: React.Dispatch<
    React.SetStateAction<"all" | "ramais" | "clandestino">
  >;
  btHistoryCqtScenarioFilter: "all" | "atual" | "proj1" | "proj2";
  setBtHistoryCqtScenarioFilter: React.Dispatch<
    React.SetStateAction<"all" | "atual" | "proj1" | "proj2">
  >;
  updateSettings: (settings: AppSettings) => void;
  selectionMode: SelectionMode;
  handleSelectionModeChange: (mode: any) => void;
  radius: number;
  handleRadiusChange: (r: number) => void;
  polygon: any;
  handleClearPolygon: () => void;
  osmData: any;
  handleDownloadDxf: () => Promise<void>;
  handleDownloadGeoJSON: () => Promise<void>;
  isSidebarDockedForRamalModal: boolean;
  sidebarSelectionControlsProps: any;
  sidebarBtEditorSectionProps: any;
  mtTopology: MtTopology;
  updateMtTopology: (topology: MtTopology) => void;
  hasBtPoles: boolean;
  sidebarAnalysisResultsProps: any;
  mapSelectorProps: any;
  elevationProfileData: any;
  clearProfile: () => void;
  btModalStackProps: any;
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
  isBimInspectorOpen: boolean;
  setIsBimInspectorOpen: (open: boolean) => void;
  inspectedPole: any;
  inspectedTransformer: any;
  inspectedAccumulatedData: BtPoleAccumulatedDemand | null;
  btTopology: BtTopology;
  handleBtRenamePole: (id: string, title: string) => void;
  handleBtSetPoleChangeFlag: (id: string, flag: any) => void;
  autoSaveStatus: "idle" | "saving" | "error";
  lastAutoSaved?: string;
  isAuditOpen: boolean;
  setIsAuditOpen: (open: boolean) => void;
  selectedAuditElement: any;
  handleAuditAction: (action: "approve" | "reject", notes: string) => void;
  btTelescopicSuggestions: any;
  handleApplyTelescopicSuggestions: (analysisOutput: any) => void;
  clearBtTelescopicSuggestions: () => void;
  isHelpOpen: boolean;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  commandPaletteActions: any[];
  handleGoToPole: (id: string) => void;
  terrainData: any;
  showSettings: boolean;
  closeSettings: () => void;
  isCalculating: boolean;
}

export function AppWorkspace(props: AppWorkspaceProps) {
  const {
    settings,
    isDark,
    isFocusMode,
    isXRayMode,
    canUndo,
    canRedo,
    undo,
    redo,
    appPast,
    appFuture,
    handleSaveProject,
    handleLoadProject,
    openSettings,
    setIsHelpOpen,
    toasts,
    closeToast,
    sessionDraft,
    handleRestoreSession,
    handleDismissSession,
    isProcessing,
    isDownloading,
    progressValue,
    statusMessage,
    showDxfProgress,
    dxfProgressValue,
    dxfProgressStatus,
    dxfProgressLabel,
    latestBtExport,
    btExportHistory,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    handleClearBtExportHistory,
    btHistoryTotal,
    btHistoryLoading,
    btHistoryCanLoadMore,
    handleLoadMoreBtHistory,
    btHistoryProjectTypeFilter,
    setBtHistoryProjectTypeFilter,
    btHistoryCqtScenarioFilter,
    setBtHistoryCqtScenarioFilter,
    updateSettings,
    selectionMode,
    handleSelectionModeChange,
    radius,
    handleRadiusChange,
    polygon,
    handleClearPolygon,
    osmData,
    handleDownloadDxf,
    handleDownloadGeoJSON,
    isSidebarDockedForRamalModal,
    sidebarSelectionControlsProps,
    sidebarBtEditorSectionProps,
    mtTopology,
    updateMtTopology,
    hasBtPoles,
    sidebarAnalysisResultsProps,
    mapSelectorProps,
    elevationProfileData,
    clearProfile,
    btModalStackProps,
    showToast,
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
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    commandPaletteActions,
    handleGoToPole,
    terrainData,
    isCalculating,
  } = props;

  return (
    <>
      <AppShellLayout
        locale={settings.locale}
        isDark={isDark}
        isFocusMode={isFocusMode}
        isXRayMode={isXRayMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        past={appPast}
        future={appFuture}
        onSaveProject={handleSaveProject}
        onOpenProject={handleLoadProject}
        onOpenSettings={openSettings}
        onOpenHelp={() => setIsHelpOpen(true)}
        appStatusStackProps={{
          locale: settings.locale,
          toasts,
          closeToast,
          sessionDraft,
          handleRestoreSession,
          handleDismissSession,
          isProcessing,
          isDownloading,
          progressValue,
          statusMessage,
          showDxfProgress,
          dxfProgressValue,
          dxfProgressStatus,
          dxfProgressLabel,
          btExportSummaryProps: {
            latestBtExport,
            btExportHistory,
            exportBtHistoryJson,
            exportBtHistoryCsv,
            clearBtExportHistory: handleClearBtExportHistory,
            btHistoryTotal,
            btHistoryLoading,
            btHistoryCanLoadMore,
            onLoadMoreBtHistory: handleLoadMoreBtHistory,
            historyProjectTypeFilter: btHistoryProjectTypeFilter,
            onHistoryProjectTypeFilterChange: setBtHistoryProjectTypeFilter,
            historyCqtScenarioFilter: btHistoryCqtScenarioFilter,
            onHistoryCqtScenarioFilterChange: setBtHistoryCqtScenarioFilter,
          },
        }}
        appSettingsOverlayProps={{
          showSettings: props.showSettings,
          closeSettings: props.closeSettings,
          settings,
          updateSettings,
          selectionMode,
          handleSelectionModeChange,
          radius,
          handleRadiusChange,
          polygon,
          handleClearPolygon,
          hasData: !!osmData,
          isDownloading,
          handleDownloadDxf,
          handleDownloadGeoJSON,
          handleSaveProject,
          handleLoadProject,
        }}
        sidebarWorkspaceProps={{
          locale: settings.locale,
          isSidebarDockedForRamalModal,
          selectionControlsProps: sidebarSelectionControlsProps,
          btEditorSectionProps: {
            ...sidebarBtEditorSectionProps,
            isCalculating,
          },
          mtEditorSectionProps: {
            locale: settings.locale,
            mtTopology,
            onMtTopologyChange: updateMtTopology,
            mtEditorMode: settings.mtEditorMode ?? "none",
            hasBtPoles,
            onMtEditorModeChange: (mode: any) =>
              updateSettings({ ...settings, mtEditorMode: mode }),
          },
          analysisResultsProps: sidebarAnalysisResultsProps,
        }}
        mainMapWorkspaceProps={{
          locale: settings.locale,
          theme: settings.theme,
          mapSelectorProps,
          floatingLayerPanelProps: {
            settings,
            onUpdateSettings: updateSettings,
            isDark,
          },
          elevationProfileData,
          onCloseElevationProfile: () => {
            clearProfile();
            handleSelectionModeChange("circle");
          },
          isDark,
          btModalStackProps,
          hasAreaSelection: !!osmData,
          onStartSearch: () => {
            setIsHelpOpen(false);
            handleSelectionModeChange("circle");
          },
          onMapClickAction: () => {
            setIsHelpOpen(false);
            handleSelectionModeChange("circle");
            showToast(
              getMainMapWorkspaceText(settings.locale).clickToDefineCenter,
              "info",
            );
          },
        }}
        bimInspectorProps={{
          isOpen: isBimInspectorOpen,
          onClose: () => setIsBimInspectorOpen(false),
          pole: inspectedPole,
          transformer: inspectedTransformer,
          accumulatedData: inspectedAccumulatedData,
          btTopology: btTopology,
          locale: settings.locale,
          onRenamePole: handleBtRenamePole,
          onSetPoleChangeFlag: handleBtSetPoleChangeFlag,
        }}
        hasAreaSelection={!!osmData}
        onStartSearch={() => {
          setIsHelpOpen(false);
          handleSelectionModeChange("circle");
        }}
        onMapClickAction={() => {
          setIsHelpOpen(false);
          handleSelectionModeChange("circle");
          showToast(
            getMainMapWorkspaceText(settings.locale).clickToDefineCenter,
            "info",
          );
        }}
        autoSaveStatus={autoSaveStatus}
        lastAutoSaved={lastAutoSaved}
      />

      <React.Suspense fallback={null}>
        {isAuditOpen && selectedAuditElement && (
          <ElectricalAuditDrawer
            locale={settings.locale}
            isOpen={isAuditOpen}
            onClose={() => setIsAuditOpen(false)}
            selectedElement={selectedAuditElement}
            onAuditAction={handleAuditAction}
          />
        )}

        {btTelescopicSuggestions && (
          <BtTelescopicSuggestionModal
            output={btTelescopicSuggestions}
            onApply={handleApplyTelescopicSuggestions}
            onCancel={clearBtTelescopicSuggestions}
          />
        )}

        {isHelpOpen && (
          <HelpModal
            isOpen={isHelpOpen}
            locale={settings.locale}
            onClose={() => setIsHelpOpen(false)}
          />
        )}

        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            actions={commandPaletteActions}
            poles={btTopology.poles}
            onGoToPole={handleGoToPole}
            locale={settings.locale}
          />
        )}
      </React.Suspense>

      <GuidedTaskChecklist
        locale={settings.locale}
        tasks={[
          {
            id: "area",
            label: getGuidedTaskChecklistText(settings.locale).taskArea,
            done: !!osmData,
          },
          {
            id: "bt",
            label: getGuidedTaskChecklistText(settings.locale).taskBt,
            done: hasBtPoles,
          },
          {
            id: "terrain",
            label: getGuidedTaskChecklistText(settings.locale).taskTerrain,
            done: !!terrainData,
          },
          {
            id: "export",
            label: getGuidedTaskChecklistText(settings.locale).taskExport,
            done: false,
          },
        ]}
      />
    </>
  );
}
