/**
 * useBtEdgeOperations.test.ts — Vitest: teste das operações de trechos BT.
 * Verifica criação, deleção e troca de condutores.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBtEdgeOperations } from "../../src/hooks/useBtEdgeOperations";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { GlobalState } from "../../src/types";

describe("useBtEdgeOperations", () => {
  let appState: GlobalState;
  const setAppState = vi.fn();
  const showToast = vi.fn();
  const findNearestPole = vi.fn();

  beforeEach(() => {
    appState = JSON.parse(JSON.stringify(INITIAL_APP_STATE));
    vi.clearAllMocks();
  });

  const render = () => 
    renderHook(() => useBtEdgeOperations({ 
      appState, 
      setAppState, 
      showToast, 
      findNearestPole 
    }));

  it("deve gerenciar estado de trecho pendente ao clicar no mapa", () => {
    const p1 = { id: "P1", title: "Poste 1", lat: -23, lng: -46 };
    findNearestPole.mockReturnValue(p1);
    
    const { result } = render();

    act(() => {
      result.current.handleBtMapClickAddEdge({ lat: -23, lng: -46 });
    });

    expect(result.current.pendingBtEdgeStartPoleId).toBe("P1");
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Origem selecionada"), "info");
  });

  it("deve criar um trecho entre dois postes e manter o destino como nova origem (Daisy Chain)", () => {
    const p1 = { id: "P1", title: "Poste 1", lat: -23, lng: -46 };
    const p2 = { id: "P2", title: "Poste 2", lat: -23.01, lng: -46.01 };
    
    appState.btTopology = {
      poles: [p1, p2] as any,
      transformers: [],
      edges: []
    };

    const { result } = render();

    // Primeiro clique (Origem)
    findNearestPole.mockReturnValue(p1);
    act(() => {
      result.current.handleBtMapClickAddEdge({ lat: -23, lng: -46 });
    });

    // Segundo clique (Destino)
    findNearestPole.mockReturnValue(p2);
    act(() => {
      result.current.handleBtMapClickAddEdge({ lat: -23.01, lng: -46.01 });
    });

    expect(setAppState).toHaveBeenCalled();
    // No modo Daisy Chain, o destino do vão anterior vira a origem do próximo
    expect(result.current.pendingBtEdgeStartPoleId).toBe("P2");
  });

  it("deve deletar um trecho", () => {
    appState.btTopology = {
      poles: [],
      transformers: [],
      edges: [{ id: "E1", fromPoleId: "P1", toPoleId: "P2", conductors: [], lengthMeters: 10, edgeChangeFlag: "new" }]
    };
    const { result } = render();

    act(() => {
      result.current.handleBtDeleteEdge("E1");
    });

    expect(setAppState).toHaveBeenCalled();
  });
});
