import React from "react";
import { AppShellLayout } from "./AppShellLayout";
import { GuidedTaskChecklist } from "./GuidedTaskChecklist";
import { ElectricalAuditDrawer } from "./ElectricalAuditDrawer";
import { BtTelescopicSuggestionModal } from "./BtTelescopicSuggestionModal";
import { HelpModal } from "./HelpModal";
import { CommandPalette } from "./CommandPalette";
import { CqtHeatmapLegend } from "./CqtHeatmapLegend";

export function AppWorkspace(props: any) {
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
          btEditorSectionProps: sidebarBtEditorSectionProps,
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
              "Clique no mapa para definir o centro da analise.",
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
          showToast("Clique no mapa para definir o centro da analise.", "info");
        }}
        autoSaveStatus={autoSaveStatus}
        lastAutoSaved={lastAutoSaved}
      />

      {settings.layers?.cqtHeatmap && <CqtHeatmapLegend />}

      <React.Suspense fallback={null}>
        <ElectricalAuditDrawer
          locale={settings.locale}
          isOpen={isAuditOpen}
          onClose={() => setIsAuditOpen(false)}
          selectedElement={selectedAuditElement}
          onAuditAction={handleAuditAction}
        />

        <BtTelescopicSuggestionModal
          output={btTelescopicSuggestions}
          onApply={handleApplyTelescopicSuggestions}
          onCancel={clearBtTelescopicSuggestions}
        />

        <HelpModal
          isOpen={isHelpOpen}
          locale={settings.locale}
          onClose={() => setIsHelpOpen(false)}
        />

        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          actions={commandPaletteActions}
          poles={btTopology.poles}
          onGoToPole={handleGoToPole}
          locale={settings.locale}
        />
      </React.Suspense>

      <GuidedTaskChecklist
        tasks={[
          { id: "area", label: "Selecionar área no mapa", done: !!osmData },
          { id: "bt", label: "Lançar rede BT (postes)", done: hasBtPoles },
          {
            id: "terrain",
            label: "Carregar terreno 2.5D",
            done: !!terrainData,
          },
          { id: "export", label: "Exportar DXF", done: false },
        ]}
      />
    </>
  );
}
