import React from "react";
import { useAppHooks } from "./hooks/useAppHooks";
import { useAppCommandPalette } from "./hooks/useAppCommandPalette";
import { useAppElectricalAudit } from "./hooks/useAppElectricalAudit";
import { useAppSidebarProps } from "./hooks/useAppSidebarProps";
import { useAppAnalysisWorkflow } from "./hooks/useAppAnalysisWorkflow";
import { useAppLifecycleEffects } from "./hooks/useAppLifecycleEffects";
import { useAppGlobalHotkeys } from "./hooks/useAppGlobalHotkeys";
import { useBtCrudHandlers } from "./hooks/useBtCrudHandlers";
import { useBtExportHistory } from "./hooks/useBtExportHistory";
import { useBtDxfWorkflow } from "./hooks/useBtDxfWorkflow";
import { useProjectDataWorkflow } from "./hooks/useProjectDataWorkflow";
import { useDgOptimization } from "./hooks/useDgOptimization";
import { useBtTelescopicAnalysis } from "./hooks/useBtTelescopicAnalysis";
import { useMtRouter } from "./hooks/useMtRouter";
import { EMPTY_BT_TOPOLOGY } from "./utils/btNormalization";
import { AppWorkspace } from "./components/AppWorkspace";

/**
 * Componente Raiz da Aplicação.
 * Orquestra os diversos fluxos de engenharia LV (BT) e geoprocessamento.
 * Toda a lógica pesada de estado foi movida para hooks especializados (Arquitetura Thin Frontend).
 */
function App() {
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isFocusModeManual, setIsFocusModeManual] = React.useState(false);
  const [isXRayMode, setIsXRayMode] = React.useState(false);

  const {
    orchestrator,
    osmEngine,
    autoSave,
    elevationProfile,
    mapState,
    topologySources,
    derivedState,
  } = useAppHooks();

  const { appState, setAppState, undo, redo, canUndo, canRedo, appPast, appFuture } = orchestrator;
  const { settings, btTopology = EMPTY_BT_TOPOLOGY } = appState;
  const { updateSettings, showToast, toasts, closeToast } = mapState;
  const isDark = settings.theme === "dark";
  const btEditorMode = settings.btEditorMode ?? "none";
  const isFocusMode = isFocusModeManual || (!!settings.enableFocusMode && btEditorMode !== "none");

  useAppGlobalHotkeys(setIsFocusModeManual, setIsXRayMode, settings.theme, (theme) => updateSettings({ ...settings, theme }));
  
  useAppLifecycleEffects({ 
    settings, isDark, btTopology, 
    btSectioningImpact: derivedState.btSectioningImpact, 
    showToast, setAppState 
  });

  const sidebarProps = useAppSidebarProps({
    appState, setAppState, mapState,
    btAccumulatedByPole: derivedState.btAccumulatedByPole,
    btTransformerDebugById: derivedState.btTransformerDebugById,
    btCriticalPoleId: derivedState.btCriticalPoleId,
    btSummary: derivedState.btSummary,
    btPointDemandKva: derivedState.btPointDemandKva,
    btTransformersDerived: derivedState.btTransformersDerived,
    mapRenderSources: topologySources.mapRenderSources,
    dgTopologySource: topologySources.dgTopologySource,
  });

  const crudHandlers = useBtCrudHandlers({ appState, setAppState, showToast });
  const exportHistory = useBtExportHistory({ settings, showToast });
  
  const dxfWorkflow = useBtDxfWorkflow({
    appState, showToast,
    btSummary: derivedState.btSummary,
    btAccumulatedByPole: derivedState.btAccumulatedByPole,
    btTransformersDerived: derivedState.btTransformersDerived,
  });

  const projectWorkflow = useProjectDataWorkflow({
    appState, setAppState, showToast,
    osmData: osmEngine.osmData,
    stats: osmEngine.stats,
    analysisText: osmEngine.analysisText,
    terrainData: osmEngine.terrainData,
    error: osmEngine.error,
    handleDownloadDxf: dxfWorkflow.handleDownloadDxf,
    isCalculating: derivedState.isCalculating,
  });

  const dgOptimization = useDgOptimization({ appState, setAppState, showToast });
  const telescopicAnalysis = useBtTelescopicAnalysis({ appState, showToast });
  const mtRouter = useMtRouter({ appState, setAppState, showToast });

  const analysisWorkflow = useAppAnalysisWorkflow({
    appState, setAppState, showToast,
    osmData: osmEngine.osmData,
    stats: osmEngine.stats,
    analysisText: osmEngine.analysisText,
    terrainData: osmEngine.terrainData,
    error: osmEngine.error,
    handleDownloadDxf: dxfWorkflow.handleDownloadDxf,
    handleDownloadCoordinatesCsv: projectWorkflow.handleDownloadCoordinatesCsv,
    isDownloading: projectWorkflow.isDownloading,
    isCalculating: derivedState.isCalculating,
  });

  const { commandPaletteActions, handleGoToPole } = useAppCommandPalette({
    locale: settings.locale,
    undo, redo, openSettings: mapState.openSettings, setIsHelpOpen,
    isFocusModeManual, setIsFocusModeManual, setIsCommandPaletteOpen,
    handleSaveProject: projectWorkflow.handleSaveProject,
    handleLoadProject: projectWorkflow.handleLoadProject,
    handleDownloadDxf: dxfWorkflow.handleDownloadDxf,
    handleDownloadGeoJSON: projectWorkflow.handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv: projectWorkflow.handleDownloadCoordinatesCsv,
    handleResetBtTopology: crudHandlers.handleResetBtTopology,
    exportBtHistoryJson: exportHistory.exportBtHistoryJson,
    exportBtHistoryCsv: exportHistory.exportBtHistoryCsv,
    handleRunDgOptimization: dgOptimization.handleRunDgOptimization,
    handleTriggerTelescopicAnalysis: telescopicAnalysis.handleTriggerTelescopicAnalysis,
    setBtNetworkScenario: (s: any) => setAppState({ ...appState, settings: { ...settings, btNetworkScenario: s } }),
    setBtEditorMode: (m: any) => setAppState({ ...appState, settings: { ...settings, btEditorMode: m } }),
    setSelectedPoleId: crudHandlers.setSelectedPoleId,
  });

  const electricalAudit = useAppElectricalAudit({ showToast, settings });

  return (
    <AppWorkspace
      settings={settings}
      isDark={isDark}
      isFocusMode={isFocusMode}
      isXRayMode={isXRayMode}
      canUndo={canUndo}
      canRedo={canRedo}
      undo={undo}
      redo={redo}
      appPast={appPast}
      appFuture={appFuture}
      handleSaveProject={projectWorkflow.handleSaveProject}
      handleLoadProject={projectWorkflow.handleLoadProject}
      openSettings={mapState.openSettings}
      setIsHelpOpen={setIsHelpOpen}
      toasts={toasts}
      closeToast={closeToast}
      sessionDraft={mapState.sessionDraft}
      handleRestoreSession={mapState.handleRestoreSession}
      handleDismissSession={mapState.handleDismissSession}
      isProcessing={osmEngine.isProcessing}
      isDownloading={projectWorkflow.isDownloading}
      progressValue={osmEngine.progressValue}
      statusMessage={osmEngine.statusMessage}
      showDxfProgress={dxfWorkflow.showDxfProgress}
      dxfProgressValue={dxfWorkflow.dxfProgressValue}
      dxfProgressStatus={dxfWorkflow.dxfProgressStatus}
      dxfProgressLabel={dxfWorkflow.dxfProgressLabel}
      latestBtExport={exportHistory.latestBtExport}
      btExportHistory={appState.btExportHistory ?? []}
      exportBtHistoryJson={exportHistory.exportBtHistoryJson}
      exportBtHistoryCsv={exportHistory.exportBtHistoryCsv}
      handleClearBtExportHistory={exportHistory.handleClearBtExportHistory}
      btHistoryTotal={exportHistory.btHistoryTotal}
      btHistoryLoading={exportHistory.btHistoryLoading}
      btHistoryCanLoadMore={exportHistory.btHistoryCanLoadMore}
      handleLoadMoreBtHistory={exportHistory.handleLoadMoreBtHistory}
      btHistoryProjectTypeFilter={exportHistory.btHistoryProjectTypeFilter}
      setBtHistoryProjectTypeFilter={exportHistory.setBtHistoryProjectTypeFilter}
      btHistoryCqtScenarioFilter={exportHistory.btHistoryCqtScenarioFilter}
      setBtHistoryCqtScenarioFilter={exportHistory.setBtHistoryCqtScenarioFilter}
      updateSettings={updateSettings}
      selectionMode={appState.selectionMode}
      handleSelectionModeChange={mapState.handleSelectionModeChange}
      radius={appState.radius}
      handleRadiusChange={mapState.handleRadiusChange}
      polygon={appState.polygon}
      handleClearPolygon={mapState.handleClearPolygon}
      osmData={osmEngine.osmData}
      handleDownloadDxf={dxfWorkflow.handleDownloadDxf}
      handleDownloadGeoJSON={projectWorkflow.handleDownloadGeoJSON}
      isSidebarDockedForRamalModal={sidebarProps.isSidebarDockedForRamalModal}
      sidebarSelectionControlsProps={sidebarProps.sidebarSelectionControlsProps}
      sidebarBtEditorSectionProps={{
        ...sidebarProps.sidebarBtEditorSectionProps,
        mtRouterState: mtRouter.mtRouterState,
        onMtRouterSetSelectionMode: mtRouter.setMtRouterSelectionMode,
        onMtRouterRemoveTerminal: mtRouter.removeMtRouterTerminal,
        onMtRouterSetMaxSnapDistance: mtRouter.setMtRouterMaxSnapDistance,
        onMtRouterSetNetworkProfile: mtRouter.setMtRouterNetworkProfile,
        onMtRouterSetMtCqtParams: mtRouter.setMtRouterMtCqtParams,
        onMtRouterUploadKmz: mtRouter.uploadMtRouterKmz,
        onMtRouterCalculate: mtRouter.calculateMtRouter,
        onMtRouterApplyProject: mtRouter.handleMtRouterApplyProject,
        onMtRouterReset: mtRouter.resetMtRouter,
      }}
      mtTopology={topologySources.mtTopology}
      updateMtTopology={() => {}} // Delegado ao hook via orchestrator se necessário
      hasBtPoles={btTopology.poles.length > 0}
      sidebarAnalysisResultsProps={analysisWorkflow.sidebarAnalysisResultsProps}
      mapSelectorProps={sidebarProps.mapSelectorProps}
      elevationProfileData={elevationProfile.profileData}
      clearProfile={elevationProfile.clearProfile}
      btModalStackProps={sidebarProps.btModalStackProps}
      showToast={showToast}
      isBimInspectorOpen={sidebarProps.isBimInspectorOpen}
      setIsBimInspectorOpen={sidebarProps.setIsBimInspectorOpen}
      inspectedPole={sidebarProps.inspectedPole}
      inspectedTransformer={sidebarProps.inspectedTransformer}
      inspectedAccumulatedData={sidebarProps.inspectedAccumulatedData}
      btTopology={btTopology}
      handleBtRenamePole={crudHandlers.handleBtRenamePole}
      handleBtSetPoleChangeFlag={crudHandlers.handleBtSetPoleChangeFlag}
      autoSaveStatus={autoSave.status}
      lastAutoSaved={autoSave.lastSaved}
      isAuditOpen={electricalAudit.isAuditOpen}
      setIsAuditOpen={electricalAudit.setIsAuditOpen}
      selectedAuditElement={electricalAudit.selectedAuditElement}
      handleAuditAction={electricalAudit.handleAuditAction}
      btTelescopicSuggestions={dgOptimization.btTelescopicSuggestions}
      handleApplyTelescopicSuggestions={dgOptimization.handleApplyTelescopicSuggestions}
      clearBtTelescopicSuggestions={dgOptimization.clearBtTelescopicSuggestions}
      isHelpOpen={isHelpOpen}
      isCommandPaletteOpen={isCommandPaletteOpen}
      setIsCommandPaletteOpen={setIsCommandPaletteOpen}
      commandPaletteActions={commandPaletteActions}
      handleGoToPole={handleGoToPole}
      terrainData={osmEngine.terrainData}
      showSettings={mapState.showSettings}
      closeSettings={mapState.closeSettings}
      isCalculating={derivedState.isCalculating}
    />
  );
}

export default App;
