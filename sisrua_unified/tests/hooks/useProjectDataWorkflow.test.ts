/**
 * useProjectDataWorkflow.test.ts — Vitest: teste do fluxo de dados de projeto.
 * Verifica importação KML e persistência de arquivos.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectDataWorkflow } from "../../src/hooks/useProjectDataWorkflow";
import { useFileOperations } from "../../src/hooks/useFileOperations";
import { useKmlImport } from "../../src/hooks/useKmlImport";
import { INITIAL_APP_STATE } from "../../src/app/initialState";

// Mocks dos hooks dependentes
vi.mock("../../src/hooks/useFileOperations", () => ({
  useFileOperations: vi.fn(),
}));

vi.mock("../../src/hooks/useKmlImport", () => ({
  useKmlImport: vi.fn(),
}));

describe("useProjectDataWorkflow", () => {
  const setAppState = vi.fn();
  const clearData = vi.fn();
  const clearPendingBtEdge = vi.fn();
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useFileOperations as any).mockReturnValue({
      saveProject: vi.fn(),
      loadProject: vi.fn(),
    });

    (useKmlImport as any).mockReturnValue({
      importKml: vi.fn(),
    });
  });

  const render = () =>
    renderHook(() =>
      useProjectDataWorkflow({
        appState: INITIAL_APP_STATE,
        setAppState,
        clearData,
        clearPendingBtEdge,
        showToast,
      })
    );

  it("deve disparar saveProject ao chamar handleSaveProject", () => {
    const saveMock = vi.fn();
    (useFileOperations as any).mockReturnValue({
      saveProject: saveMock,
      loadProject: vi.fn(),
    });

    const { result } = render();
    act(() => {
      result.current.handleSaveProject();
    });

    expect(saveMock).toHaveBeenCalled();
  });

  it("deve limpar arestas pendentes e carregar projeto ao chamar handleLoadProject", () => {
    const loadMock = vi.fn();
    (useFileOperations as any).mockReturnValue({
      saveProject: vi.fn(),
      loadProject: loadMock,
    });

    const { result } = render();
    const file = new File(["{}"], "project.json", { type: "application/json" });

    act(() => {
      result.current.handleLoadProject(file);
    });

    expect(clearPendingBtEdge).toHaveBeenCalled();
    expect(loadMock).toHaveBeenCalledWith(file);
  });
});
