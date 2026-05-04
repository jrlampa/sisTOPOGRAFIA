import { useMemo } from "react";
import { AppSettings, GeoLocation, BtTopology, MtTopology } from "../types";
import {
  BtPoleAccumulatedDemand,
  BtDerivedSummary,
  BtClandestinoDisplay,
  BtTransformerDerived,
} from "../services/btDerivedService";

interface SidebarPropsParams {
  settings: AppSettings;
  center: GeoLocation;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearching: boolean;
  handleSearch: (e: React.FormEvent) => Promise<void>;
  selectionMode: string;
  handleSelectionModeChange: (m: any) => void;
  radius: number;
  handleRadiusChange: (r: number) => void;
  saveSnapshot: () => void;
  handleFetchAndAnalyze: () => void;
  isProcessing: boolean;
  isPolygonValid: boolean;
  setBtNetworkScenario: (s: any) => void;
  setBtEditorMode: (m: any) => void;
  btNetworkScenario: any;
  btEditorMode: any;
  btTopology: BtTopology;
  dgTopologySource: any;
  btAccumulatedByPole: BtPoleAccumulatedDemand[];
  btSummary: BtDerivedSummary;
  btPointDemandKva: number;
  btTransformerDebugById: any;
  btPoleCoordinateInput: string;
  setBtPoleCoordinateInput: (i: string) => void;
  handleBtInsertPoleByCoordinates: () => void;
  pendingNormalClassificationPoles: any[];
  handleResetBtTopology: () => void;
  updateBtTopology: (t: BtTopology) => void;
  updateProjectType: (p: any) => void;
  updateClandestinoAreaM2: (a: number) => void;
  handleBtSelectedPoleChange: (id: string) => void;
  handleBtSelectedTransformerChange: (id: string) => void;
  handleBtSelectedEdgeChange: (id: string) => void;
  handleBtRenamePole: (id: string, t: string) => void;
  handleBtRenameTransformer: (id: string, t: string) => void;
  handleBtSetEdgeChangeFlag: (id: string, f: any) => void;
  handleBtSetPoleChangeFlag: (id: string, f: any) => void;
  handleBtTogglePoleCircuitBreak: (id: string, b: boolean) => void;
  handleBtSetTransformerChangeFlag: (id: string, f: any) => void;
  btClandestinoDisplay: BtClandestinoDisplay;
  btTransformersDerived: BtTransformerDerived[];
  requestCriticalConfirmation: (c: any) => void;
  handleTriggerTelescopicAnalysis: () => void;
  isDgOptimizing: boolean;
  dgResult: any;
  dgError: any;
  dgActiveAltIndex: number;
  handleRunDgOptimization: () => void;
  handleAcceptDgAll: (scenario: any) => void;
  handleAcceptDgTrafoOnly: (scenario: any) => void;
  handleDiscardDgResult: () => void;
  setDgActiveAltIndex: (i: number) => void;
  isPreviewActive: boolean;
  setIsPreviewActive: (a: boolean) => void;
  selectedPoleId: string;
  selectedPoleIds: string[];
  selectedEdgeId: string;
  selectedTransformerId: string;
  setSelectedPoleId: (id: string) => void;
  setSelectedPoleIds: (ids: string[]) => void;
  setSelectedEdgeId: (id: string) => void;
  setSelectedTransformerId: (id: string) => void;
  mtTopology: MtTopology;
  osmData: any;
  stats: any;
  analysisText: string;
  terrainData: any;
  error: any;
  handleDownloadDxf: () => Promise<void>;
  handleDownloadCoordinatesCsv: () => void;
  isDownloading: boolean;
  showToast: (msg: string, type: any) => void;
  isCalculating: boolean;
}

export function useAppSidebarProps({
  settings,
  center,
  searchQuery,
  setSearchQuery,
  isSearching,
  handleSearch,
  selectionMode,
  handleSelectionModeChange,
  radius,
  handleRadiusChange,
  saveSnapshot,
  handleFetchAndAnalyze,
  isProcessing,
  isPolygonValid,
  setBtNetworkScenario,
  setBtEditorMode,
  btNetworkScenario,
  btEditorMode,
  btTopology,
  dgTopologySource,
  btAccumulatedByPole,
  btSummary,
  btPointDemandKva,
  btTransformerDebugById,
  btPoleCoordinateInput,
  setBtPoleCoordinateInput,
  handleBtInsertPoleByCoordinates,
  pendingNormalClassificationPoles,
  handleResetBtTopology,
  updateBtTopology,
  updateProjectType,
  updateClandestinoAreaM2,
  handleBtSelectedPoleChange,
  handleBtSelectedTransformerChange,
  handleBtSelectedEdgeChange,
  handleBtRenamePole,
  handleBtRenameTransformer,
  handleBtSetEdgeChangeFlag,
  handleBtSetPoleChangeFlag,
  handleBtTogglePoleCircuitBreak,
  handleBtSetTransformerChangeFlag,
  btClandestinoDisplay,
  btTransformersDerived,
  requestCriticalConfirmation,
  handleTriggerTelescopicAnalysis,
  isDgOptimizing,
  dgResult,
  dgError,
  dgActiveAltIndex,
  handleRunDgOptimization,
  handleAcceptDgAll,
  handleAcceptDgTrafoOnly,
  handleDiscardDgResult,
  setDgActiveAltIndex,
  isPreviewActive,
  setIsPreviewActive,
  selectedPoleId,
  selectedPoleIds,
  selectedEdgeId,
  selectedTransformerId,
  setSelectedPoleId,
  setSelectedPoleIds,
  setSelectedEdgeId,
  setSelectedTransformerId,
  mtTopology,
  osmData,
  stats,
  analysisText,
  terrainData,
  error,
  handleDownloadDxf,
  handleDownloadCoordinatesCsv,
  isDownloading,
  showToast,
  isCalculating: _isCalculating,
}: SidebarPropsParams) {
  const sidebarSelectionControlsProps = useMemo(
    () => ({
      locale: settings.locale,
      center,
      searchQuery,
      setSearchQuery,
      isSearching,
      handleSearch,
      selectionMode,
      onSelectionModeChange: handleSelectionModeChange,
      radius,
      onRadiusChange: handleRadiusChange,
      saveSnapshot,
      onAnalyze: handleFetchAndAnalyze,
      isProcessing,
      isPolygonValid,
    }),
    [
      settings.locale,
      center,
      searchQuery,
      setSearchQuery,
      isSearching,
      handleSearch,
      selectionMode,
      handleSelectionModeChange,
      radius,
      handleRadiusChange,
      saveSnapshot,
      handleFetchAndAnalyze,
      isProcessing,
      isPolygonValid,
    ],
  );

  const sidebarBtEditorSectionProps = useMemo(
    () => ({
      locale: settings.locale,
      settings,
      setBtNetworkScenario,
      setBtEditorMode,
      btNetworkScenario,
      btEditorMode,
      btTopology,
      dgTopology: dgTopologySource,
      btAccumulatedByPole,
      btSummary,
      btPointDemandKva,
      btTransformerDebugById,
      btPoleCoordinateInput,
      setBtPoleCoordinateInput,
      handleBtInsertPoleByCoordinates,
      clearPendingBtEdge: () => {},
      pendingNormalClassificationPoles,
      handleResetBtTopology,
      updateBtTopology,
      updateProjectType,
      updateClandestinoAreaM2,
      handleBtSelectedPoleChange,
      handleBtSelectedTransformerChange,
      handleBtSelectedEdgeChange,
      handleBtRenamePole,
      handleBtRenameTransformer,
      handleBtSetEdgeChangeFlag,
      handleBtSetPoleChangeFlag,
      handleBtTogglePoleCircuitBreak,
      handleBtSetTransformerChangeFlag,
      btClandestinoDisplay,
      btTransformersDerived,
      requestCriticalConfirmation,
      onTriggerTelescopicAnalysis: handleTriggerTelescopicAnalysis,
      isDgOptimizing,
      dgResult,
      dgError,
      dgActiveAltIndex,
      onRunDgOptimization: handleRunDgOptimization,
      onAcceptDgAll: handleAcceptDgAll,
      onAcceptDgTrafoOnly: handleAcceptDgTrafoOnly,
      onClearDgResult: handleDiscardDgResult,
      onSetDgActiveAltIndex: setDgActiveAltIndex,
      dgIsPreviewActive: isPreviewActive,
      onSetDgIsPreviewActive: setIsPreviewActive,
      selectedPoleId,
      selectedPoleIds,
      selectedEdgeId,
      selectedTransformerId,
      onSetSelectedPoleId: setSelectedPoleId,
      onSetSelectedPoleIds: setSelectedPoleIds,
      onSetSelectedEdgeId: setSelectedEdgeId,
      onSetSelectedTransformerId: setSelectedTransformerId,
      mtTopology,
    }),
    [
      settings,
      btNetworkScenario,
      btEditorMode,
      btTopology,
      dgTopologySource,
      btAccumulatedByPole,
      btSummary,
      btPointDemandKva,
      btTransformerDebugById,
      btPoleCoordinateInput,
      setBtPoleCoordinateInput,
      handleBtInsertPoleByCoordinates,
      pendingNormalClassificationPoles,
      handleResetBtTopology,
      updateBtTopology,
      updateProjectType,
      updateClandestinoAreaM2,
      handleBtSelectedPoleChange,
      handleBtSelectedTransformerChange,
      handleBtSelectedEdgeChange,
      setBtNetworkScenario,
      setBtEditorMode,
      handleBtRenamePole,
      handleBtRenameTransformer,
      handleBtSetEdgeChangeFlag,
      handleBtSetPoleChangeFlag,
      handleBtTogglePoleCircuitBreak,
      handleBtSetTransformerChangeFlag,
      btClandestinoDisplay,
      btTransformersDerived,
      requestCriticalConfirmation,
      handleTriggerTelescopicAnalysis,
      isDgOptimizing,
      dgResult,
      dgError,
      dgActiveAltIndex,
      handleRunDgOptimization,
      handleAcceptDgAll,
      handleAcceptDgTrafoOnly,
      handleDiscardDgResult,
      setDgActiveAltIndex,
      isPreviewActive,
      setIsPreviewActive,
      selectedPoleId,
      selectedPoleIds,
      selectedEdgeId,
      selectedTransformerId,
      setSelectedPoleId,
      setSelectedPoleIds,
      setSelectedEdgeId,
      setSelectedTransformerId,
      mtTopology,
    ],
  );

  const sidebarAnalysisResultsProps = useMemo(
    () => ({
      locale: settings.locale,
      osmData,
      stats,
      analysisText,
      terrainData,
      error,
      handleDownloadDxf,
      handleDownloadCoordinatesCsv,
      isDownloading,
      showToast,
    }),
    [
      settings.locale,
      osmData,
      stats,
      analysisText,
      terrainData,
      error,
      handleDownloadDxf,
      handleDownloadCoordinatesCsv,
      isDownloading,
      showToast,
    ],
  );

  return {
    sidebarSelectionControlsProps,
    sidebarBtEditorSectionProps,
    sidebarAnalysisResultsProps,
  };
}
