/**
 * useBtTransformerOperations.test.ts — Vitest: teste das operações de trafo BT.
 * Verifica criação, deleção e atrelamento a postes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBtTransformerOperations } from "../../src/hooks/useBtTransformerOperations";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { GlobalState } from "../../src/types";

describe("useBtTransformerOperations", () => {
  let appState: GlobalState;
  const setAppState = vi.fn();
  const showToast = vi.fn();
  const findNearestPole = vi.fn();

  beforeEach(() => {
    appState = JSON.parse(JSON.stringify(INITIAL_APP_STATE));
    vi.clearAllMocks();
  });

  const render = () => 
    renderHook(() => useBtTransformerOperations({ 
      appState, 
      setAppState, 
      showToast, 
      findNearestPole 
    }));

  it("deve adicionar um transformador atrelado ao poste mais próximo", () => {
    const p1 = { id: "P1", title: "Poste 1", lat: -23, lng: -46 };
    findNearestPole.mockReturnValue(p1);
    
    const { result } = render();

    act(() => {
      result.current.handleBtMapClickAddTransformer({ lat: -23, lng: -46 });
    });

    expect(setAppState).toHaveBeenCalled();
    const nextState = setAppState.mock.calls[0][0];
    const transformers = typeof nextState === "function" ? nextState(appState).btTopology.transformers : nextState.btTopology.transformers;
    expect(transformers).toHaveLength(1);
    expect(transformers[0].poleId).toBe("P1");
  });

  it("deve deletar um transformador", () => {
    appState.btTopology = {
      poles: [],
      transformers: [{ id: "TR1", lat: -23, lng: -46, projectPowerKva: 75, transformerChangeFlag: "new" }],
      edges: []
    };
    const { result } = render();

    act(() => {
      result.current.handleBtDeleteTransformer("TR1");
    });

    expect(setAppState).toHaveBeenCalled();
    const nextState = setAppState.mock.calls[0][0];
    const transformers = typeof nextState === "function" ? nextState(appState).btTopology.transformers : nextState.btTopology.transformers;
    expect(transformers).toHaveLength(0);
  });
});
