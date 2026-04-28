import React from "react";
import type { ToastType } from "../components/Toast";
import type { GeoLocation, GlobalState, SelectionMode } from "../types";
import { useSearch } from "./useSearch";

interface UseAppAnalysisWorkflowParams {
  appState: GlobalState;
  setAppState: (
    nextState: GlobalState | ((prev: GlobalState) => GlobalState),
    addToHistory: boolean,
  ) => void;
  clearData: () => void;
  showToast: (message: string, type: ToastType, action?: { label: string; onClick: () => void }) => void;
  clearPendingBtEdge: () => void;
  handleBaseSelectionModeChange: (mode: SelectionMode) => void;
  runAnalysis: (
    center: GeoLocation,
    radius: number,
    enableAI: boolean,
  ) => Promise<{ 
    success: true 
  } | { 
    success: false; 
    errorMessage: string; 
    retryAction?: { label: string; onClick: () => void } 
  }>;
  isDownloading: boolean;
  jobId: string | null;
  jobStatus: string | null;
  jobProgress: number;
}

export function useAppAnalysisWorkflow({
  appState,
  setAppState,
  clearData,
  showToast,
  clearPendingBtEdge,
  handleBaseSelectionModeChange,
  runAnalysis,
  isDownloading,
  jobId,
  jobStatus,
  jobProgress,
}: UseAppAnalysisWorkflowParams) {
  const { center, radius, settings } = appState;

  const onLocationFound = React.useCallback(
    (location: GeoLocation) => {
      setAppState(
        (prev) => ({ ...prev, center: location, selectionMode: "circle" }),
        true,
      );
      clearData();
      showToast(`Locality found: ${location.label}`, "success");
    },
    [setAppState, clearData, showToast],
  );

  const onError = React.useCallback(
    (message: string) => showToast(message, "error"),
    [showToast],
  );

  const { searchQuery, setSearchQuery, isSearching, handleSearch } = useSearch({
    onLocationFound,
    onError,
  });

  const handleSelectionModeChange = React.useCallback(
    (mode: SelectionMode) => {
      clearPendingBtEdge();
      handleBaseSelectionModeChange(mode);
    },
    [clearPendingBtEdge, handleBaseSelectionModeChange],
  );

  const handleFetchAndAnalyze = React.useCallback(async () => {
    const result = await runAnalysis(center, radius, settings.enableAI);
    if (result.success) {
      showToast("Análise concluída!", "success");
      return;
    }

    showToast(result.errorMessage || "Falha na análise.", "error", result.retryAction);
  }, [runAnalysis, center, radius, settings.enableAI, showToast]);

  const showDxfProgress = isDownloading || !!jobId;
  const dxfProgressValue = Math.max(0, Math.min(100, Math.round(jobProgress)));
  const dxfProgressLabel =
    jobStatus === "queued" || jobStatus === "waiting"
      ? "A gerar DXF: na fila..."
      : `A gerar DXF: ${dxfProgressValue}%...`;

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearch,
    handleSelectionModeChange,
    handleFetchAndAnalyze,
    showDxfProgress,
    dxfProgressLabel,
  };
}
