import React from "react";
import { useParams } from "react-router-dom";
import { ProjectService } from "./services/projectService";
import { useAppHooks } from "./hooks/useAppHooks";
import { useAppCommandPalette } from "./hooks/useAppCommandPalette";
import { useAppElectricalAudit } from "./hooks/useAppElectricalAudit";
import { useAppSidebarProps } from "./hooks/useAppSidebarProps";
import { useAppAnalysisWorkflow } from "./hooks/useAppAnalysisWorkflow";
import { useAppGlobalHotkeys } from "./hooks/useAppGlobalHotkeys";
import { AppWorkspace } from "./components/AppWorkspace";
import { SnapshotModal } from "./components/SnapshotModal";
import { BtTopology } from "./types";

/** Topologia BT vazia — fallback quando o estado ainda não foi carregado. */
const EMPTY_BT_TOPOLOGY: BtTopology = { poles: [], transformers: [], edges: [] };

/**
 * Componente Raiz da Aplicação (Tier 3 — sisrua_unified).
 * Orquestra os fluxos de engenharia, mapa e dados via hooks de domínio.
 *
 * Arquitetura: Smart Backend / Thin Frontend.
 * Cada responsabilidade é delegada a um hook dedicado.
 */
function App() {
  const { projeto_id } = useParams<{ projeto_id: string }>();
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isFocusModeManual, setIsFocusModeManual] = React.useState(false);
  const [isXRayMode, setIsXRayMode] = React.useState(false);
  const [selectedPoleId, setSelectedPoleId] = React.useState("");

  // ─── Core Hooks ──────────────────────────────────────────────────────────
  const {
    orchestrator,
    osmEngine,
    autoSave,
    elevationProfile,
    mapState,
    topologySources,
    derivedState,
    compliance,
  } = useAppHooks(projeto_id);

  const {
    appState,
    setAppState,
    undo,
    redo,
    canUndo,
    canRedo,
    appPast,
    appFuture,
    saveSnapshot,
  } = orchestrator;

  const {
    updateSettings,
    showToast,
    toasts,
    closeToast,
    showSettings,
    openSettings,
    closeSettings,
    handleSelectionModeChange,
    handleRadiusChange,
    handleClearPolygon,
    isPolygonValid,
    handleRestoreSession,
    handleDismissSession,
    sessionDraft,
  } = mapState;

  const { settings, btTopology = EMPTY_BT_TOPOLOGY } = appState;
  const { btEditorMode = "none" } = settings;

  // ─── Carregar projeto da URL ──────────────────────────────────────────────
  React.useEffect(() => {
    if (projeto_id) {
      ProjectService.getProjectState(projeto_id).then((state) => {
        if (state) {
          setAppState(state, false, "Carregamento de Projeto");
          showToast("Projeto carregado com sucesso.", "success");
        } else {
          showToast("Falha ao carregar projeto.", "error");
        }
      });
    }
  }, [projeto_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Domain Hooks ────────────────────────────────────────────────────────
  const electricalAudit = useAppElectricalAudit({ settings, showToast });

  const analysisWorkflow = useAppAnalysisWorkflow({
    appState,
    setAppState,
    clearData: osmEngine.clearData,
    showToast,
    clearPendingBtEdge: () => {},
    handleBaseSelectionModeChange: handleSelectionModeChange,
    runAnalysis: osmEngine.runAnalysis,
    isDownloading: osmEngine.isProcessing,
    jobId: null,
    jobStatus: null,
    jobProgress: 0,
  });

  // ─── Fallbacks para hooks pendentes de refatoração (T3-138) ──────────────
  const handleDownloadGeoJSON = React.useCallback(async () => {
    showToast("Exportação GeoJSON em desenvolvimento.", "info");
  }, [showToast]);

  const handleDownloadDxf = React.useCallback(async () => {
    showToast("Exportação DXF em desenvolvimento.", "info");
  }, [showToast]);

  const handleDownloadCoordinatesCsv = React.useCallback(() => {
    showToast("Exportação CSV em desenvolvimento.", "info");
  }, [showToast]);

  const handleResetBtTopology = React.useCallback(() => {
    setAppState(
      (prev) => ({ ...prev, btTopology: { poles: [], transformers: [], edges: [] } }),
      true,
      "Reset Topologia BT"
    );
  }, [setAppState]);

  // ─── Command Palette ─────────────────────────────────────────────────────
  const { commandPaletteActions } = useAppCommandPalette({
    locale: settings.locale,
    handleSaveProject: saveSnapshot,
    handleLoadProject: () => {},
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    handleResetBtTopology,
    exportBtHistoryJson: () => {},
    exportBtHistoryCsv: () => {},
    undo,
    redo,
    setIsHelpOpen,
    openSettings,
    isFocusModeManual,
    setIsFocusModeManual,
    handleRunDgOptimization: () => {},
    handleTriggerTelescopicAnalysis: () => {},
    setBtNetworkScenario: (s: any) =>
      setAppState((p) => ({ ...p, settings: { ...p.settings, btNetworkScenario: s } }), true),
    setBtEditorMode: (m: any) =>
      setAppState((p) => ({ ...p, settings: { ...p.settings, btEditorMode: m } }), true),
    setSelectedPoleId,
    setIsCommandPaletteOpen,
  });

  // ─── Sidebar Props ───────────────────────────────────────────────────────
  const sidebarProps = useAppSidebarProps({
    settings,
    center: appState.center,
    searchQuery: analysisWorkflow.searchQuery,
    setSearchQuery: analysisWorkflow.setSearchQuery,
    isSearching: analysisWorkflow.isSearching,
    handleSearch: analysisWorkflow.handleSearch,
    selectionMode: appState.selectionMode,
    handleSelectionModeChange: analysisWorkflow.handleSelectionModeChange,
    radius: appState.radius,
    handleRadiusChange,
    saveSnapshot,
    handleFetchAndAnalyze: analysisWorkflow.handleFetchAndAnalyze,
    isProcessing: osmEngine.isProcessing,
    isPolygonValid,
    setBtNetworkScenario: (s: any) =>
      setAppState((p) => ({ ...p, settings: { ...p.settings, btNetworkScenario: s } }), true),
    setBtEditorMode: (m: any) =>
      setAppState((p) => ({ ...p, settings: { ...p.settings, btEditorMode: m } }), true),
    btNetworkScenario: settings.btNetworkScenario,
    btEditorMode: settings.btEditorMode,
    btTopology,
    dgTopologySource: topologySources.dgTopologySource,
    btAccumulatedByPole: derivedState.btAccumulatedByPole ?? [],
    btSummary: derivedState.btSummary,
    btPointDemandKva: derivedState.btPointDemandKva ?? 0,
    btTransformerDebugById: derivedState.btTransformerDebugById ?? {},
    btPoleCoordinateInput: "",
    setBtPoleCoordinateInput: () => {},
    handleBtInsertPoleByCoordinates: () => {},
    pendingNormalClassificationPoles: [],
    handleResetBtTopology,
    updateBtTopology: (t: any) => setAppState((p) => ({ ...p, btTopology: t }), true),
    updateProjectType: (p: any) =>
      setAppState((prev) => ({ ...prev, settings: { ...prev.settings, projectType: p } }), true),
    updateClandestinoAreaM2: (a: number) =>
      setAppState((p) => ({ ...p, settings: { ...p.settings, clandestinoAreaM2: a } }), true),
    handleBtSelectedPoleChange: () => {},
    handleBtSelectedTransformerChange: () => {},
    handleBtSelectedEdgeChange: () => {},
    handleBtRenamePole: () => {},
    handleBtRenameTransformer: () => {},
    handleBtSetEdgeChangeFlag: () => {},
    handleBtSetPoleChangeFlag: () => {},
    handleBtTogglePoleCircuitBreak: () => {},
    handleBtSetTransformerChangeFlag: () => {},
    btClandestinoDisplay: derivedState.btClandestinoDisplay,
    btTransformersDerived: derivedState.btTransformersDerived ?? [],
    requestCriticalConfirmation: () => {},
    handleTriggerTelescopicAnalysis: () => {},
    isDgOptimizing: false,
    dgResult: null,
    dgError: null,
    dgActiveAltIndex: 0,
    handleRunDgOptimization: () => {},
    handleAcceptDgAll: () => {},
    handleAcceptDgTrafoOnly: () => {},
    handleDiscardDgResult: () => {},
    setDgActiveAltIndex: () => {},
    isPreviewActive: false,
    setIsPreviewActive: () => {},
    selectedPoleId,
    selectedPoleIds: [],
    selectedEdgeId: "",
    selectedTransformerId: "",
    setSelectedPoleId,
    setSelectedPoleIds: () => {},
    setSelectedEdgeId: () => {},
    setSelectedTransformerId: () => {},
    mtTopology: topologySources.mtTopology,
    osmData: osmEngine.osmData,
    stats: osmEngine.stats,
    analysisText: osmEngine.analysisText ?? "",
    terrainData: osmEngine.terrainData,
    error: osmEngine.error,
    handleDownloadDxf,
    handleDownloadCoordinatesCsv,
    isDownloading: osmEngine.isProcessing,
    showToast,
    isCalculating: derivedState.isCalculating,
  });

  // ─── UI State ─────────────────────────────────────────────────────────────
  const isFocusMode =
    isFocusModeManual || (!!settings.enableFocusMode && btEditorMode !== "none");

  useAppGlobalHotkeys(
    setIsFocusModeManual,
    setIsXRayMode,
    settings.theme,
    (theme) => updateSettings({ ...settings, theme }),
  );

  return (
    <AppWorkspace
      settings={settings}
      isDark={settings.theme === "dark"}
      isFocusMode={isFocusMode}
      isXRayMode={isXRayMode}
      canUndo={canUndo}
      canRedo={canRedo}
      undo={undo}
      redo={redo}
      appPast={appPast}
      appFuture={appFuture}
      handleSaveProject={saveSnapshot}
      handleLoadProject={() => {}}
      openSettings={openSettings}
      setIsHelpOpen={setIsHelpOpen}
      toasts={toasts}
      closeToast={closeToast}
      sessionDraft={sessionDraft}
      handleRestoreSession={handleRestoreSession}
      handleDismissSession={handleDismissSession}
      isProcessing={osmEngine.isProcessing}
      isDownloading={analysisWorkflow.showDxfProgress}
      progressValue={osmEngine.progressValue}
      statusMessage={osmEngine.statusMessage}
      showDxfProgress={analysisWorkflow.showDxfProgress}
      dxfProgressValue={analysisWorkflow.dxfProgressValue}
      dxfProgressStatus={analysisWorkflow.dxfProgressStatus ?? ""}
      dxfProgressLabel={analysisWorkflow.dxfProgressLabel}
      latestBtExport={null}
      btExportHistory={[]}
      exportBtHistoryJson={() => {}}
      exportBtHistoryCsv={() => {}}
      handleClearBtExportHistory={() => {}}
      btHistoryTotal={0}
      btHistoryLoading={false}
      btHistoryCanLoadMore={false}
      handleLoadMoreBtHistory={() => {}}
      btHistoryProjectTypeFilter=""
      setBtHistoryProjectTypeFilter={() => {}}
      btHistoryCqtScenarioFilter=""
      setBtHistoryCqtScenarioFilter={() => {}}
      updateSettings={updateSettings}
      selectionMode={appState.selectionMode}
      handleSelectionModeChange={handleSelectionModeChange}
      radius={appState.radius}
      handleRadiusChange={handleRadiusChange}
      polygon={appState.polygon}
      handleClearPolygon={handleClearPolygon}
      osmData={osmEngine.osmData}
      handleDownloadDxf={handleDownloadDxf}
      handleDownloadGeoJSON={handleDownloadGeoJSON}
      isSidebarDockedForRamalModal={false}
      sidebarSelectionControlsProps={sidebarProps.sidebarSelectionControlsProps}
      sidebarBtEditorSectionProps={sidebarProps.sidebarBtEditorSectionProps}
      mtTopology={topologySources.mtTopology}
      updateMtTopology={() => {}}
      hasBtPoles={btTopology.poles.length > 0}
      sidebarAnalysisResultsProps={sidebarProps.sidebarAnalysisResultsProps}
      mapSelectorProps={null}
      elevationProfileData={elevationProfile.profileData}
      clearProfile={elevationProfile.clearProfile}
      btModalStackProps={null}
      showToast={showToast}
      isBimInspectorOpen={false}
      setIsBimInspectorOpen={() => {}}
      inspectedPole={null}
      inspectedTransformer={null}
      inspectedAccumulatedData={null}
      btTopology={btTopology}
      handleBtRenamePole={() => {}}
      handleBtSetPoleChangeFlag={() => {}}
      autoSaveStatus={autoSave.status}
      lastAutoSaved={autoSave.lastSaved}
      isAuditOpen={electricalAudit.isAuditOpen}
      setIsAuditOpen={electricalAudit.setIsAuditOpen}
      selectedAuditElement={electricalAudit.selectedAuditElement}
      handleAuditAction={electricalAudit.handleAuditAction}
      btTelescopicSuggestions={[]}
      handleApplyTelescopicSuggestions={() => {}}
      clearBtTelescopicSuggestions={() => {}}
      isHelpOpen={isHelpOpen}
      onOpenSnapshots={() => setIsSnapshotModalOpen(true)}
      isCommandPaletteOpen={isCommandPaletteOpen}
      setIsCommandPaletteOpen={setIsCommandPaletteOpen}
      commandPaletteActions={commandPaletteActions}
      handleGoToPole={setSelectedPoleId}
      terrainData={osmEngine.terrainData}
      showSettings={showSettings}
      closeSettings={closeSettings}
      isCalculating={derivedState.isCalculating}
      complianceResults={compliance.result}
    >
      <SnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        projetoId={projeto_id || ""}
        currentState={appState}
        onRestore={(state) => {
          setAppState(state, true, "Restauração de Snapshot");
          setIsSnapshotModalOpen(false);
          showToast("Snapshot restaurado com sucesso!", "success");
        }}
      />
    </AppWorkspace>
  );
}

export default App;
