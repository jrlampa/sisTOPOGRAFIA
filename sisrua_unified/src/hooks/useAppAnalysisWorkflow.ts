import type { ToastType } from "../components/Toast";
import type { GeoLocation, GlobalState, SelectionMode } from "../types";
import { useSearch } from "./useSearch";

interface UseAppAnalysisWorkflowParams {
  appState: GlobalState;
  setAppState: (nextState: GlobalState, commit?: boolean) => void;
  clearData: () => void;
  showToast: (message: string, type: ToastType) => void;
  clearPendingBtEdge: () => void;
  handleBaseSelectionModeChange: (mode: SelectionMode) => void;
  runAnalysis: (
    center: GeoLocation,
    radius: number,
    enableAI: boolean,
  ) => Promise<{ success: true } | { success: false; errorMessage: string }>;
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

  const { searchQuery, setSearchQuery, isSearching, handleSearch } = useSearch({
    onLocationFound: (location) => {
      setAppState({ ...appState, center: location }, true);
      clearData();
      showToast(`Locality found: ${location.label}`, "success");
    },
    onError: (message) => showToast(message, "error"),
  });

  const handleSelectionModeChange = (mode: SelectionMode) => {
    clearPendingBtEdge();
    handleBaseSelectionModeChange(mode);
  };

  const handleFetchAndAnalyze = async () => {
    const result = await runAnalysis(center, radius, settings.enableAI);
    if (result.success) {
      showToast("Análise concluída!", "success");
      return;
    }

    showToast(result.errorMessage || "Falha na análise.", "error");
  };

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
