/**
 * useAppAnalysisWorkflow.test.ts — Vitest: teste do fluxo de análise OSM/Terrain.
 * Verifica disparo de buscas e integração com motor de análise.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppAnalysisWorkflow } from "../../src/hooks/useAppAnalysisWorkflow";
import { useSearch } from "../../src/hooks/useSearch";
import { INITIAL_APP_STATE } from "../../src/app/initialState";

// Mock do hook de busca
vi.mock("../../src/hooks/useSearch", () => ({
  useSearch: vi.fn(),
}));

describe("useAppAnalysisWorkflow", () => {
  const setAppState = vi.fn();
  const clearData = vi.fn();
  const showToast = vi.fn();
  const clearPendingBtEdge = vi.fn();
  const handleBaseSelectionModeChange = vi.fn();
  const runAnalysis = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSearch as any).mockReturnValue({
      searchQuery: "",
      setSearchQuery: vi.fn(),
      isSearching: false,
      handleSearch: vi.fn(),
    });
  });

  const render = () =>
    renderHook(() =>
      useAppAnalysisWorkflow({
        appState: INITIAL_APP_STATE,
        setAppState,
        clearData,
        showToast,
        clearPendingBtEdge,
        handleBaseSelectionModeChange,
        runAnalysis,
        isDownloading: false,
        jobId: null,
        jobStatus: null,
        jobProgress: 0,
      })
    );

  it("deve disparar runAnalysis ao chamar handleFetchAndAnalyze", async () => {
    runAnalysis.mockResolvedValue({ success: true });
    const { result } = render();

    await act(async () => {
      await result.current.handleFetchAndAnalyze();
    });

    expect(runAnalysis).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Análise concluída!", "success");
  });

  it("deve limpar arestas pendentes ao trocar modo de seleção", () => {
    const { result } = render();

    act(() => {
      result.current.handleSelectionModeChange("polygon");
    });

    expect(clearPendingBtEdge).toHaveBeenCalled();
    expect(handleBaseSelectionModeChange).toHaveBeenCalledWith("polygon");
  });
});
