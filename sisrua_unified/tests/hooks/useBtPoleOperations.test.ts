/**
 * useBtPoleOperations.test.ts — Vitest: teste das operações de poste BT.
 * Verifica criação, deleção, renomeação e gestão de ramais.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBtPoleOperations } from "../../src/hooks/useBtPoleOperations";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { GlobalState } from "../../src/types";

describe("useBtPoleOperations", () => {
  let appState: GlobalState;
  const setAppState = vi.fn();
  const showToast = vi.fn();
  const onSelectedPoleChange = vi.fn();

  beforeEach(() => {
    appState = JSON.parse(JSON.stringify(INITIAL_APP_STATE));
    vi.clearAllMocks();
  });

  const render = () => 
    renderHook(() => useBtPoleOperations({ 
      appState, 
      setAppState, 
      showToast, 
      onSelectedPoleChange 
    }));

  it("deve inserir um poste em uma localização", () => {
    const { result } = render();
    const location = { lat: appState.center.lat, lng: appState.center.lng };

    act(() => {
      result.current.insertBtPoleAtLocation(location);
    });

    expect(setAppState).toHaveBeenCalled();
  });

  it("deve deletar um poste existente", () => {
    appState.btTopology = {
      poles: [{ id: "P1", lat: -23, lng: -46, ramais: [], poleChangeFlag: "new" }],
      transformers: [],
      edges: []
    };
    const { result } = render();

    act(() => {
      result.current.handleBtDeletePole("P1");
    });

    expect(setAppState).toHaveBeenCalled();
  });

  it("deve renomear um poste", () => {
    appState.btTopology = {
      poles: [{ id: "P1", lat: -23, lng: -46, ramais: [], title: "Antigo" }],
      transformers: [],
      edges: []
    };
    const { result } = render();

    act(() => {
      result.current.handleBtRenamePole("P1", "Novo Nome");
    });

    expect(setAppState).toHaveBeenCalled();
  });

  it("deve gerenciar ramais: adicionar ramal rápido em modo clandestino", () => {
    appState.settings.projectType = "clandestino";
    appState.btTopology = {
      poles: [{ id: "P1", lat: -23, lng: -46, ramais: [] }],
      transformers: [],
      edges: []
    };
    const { result } = render();

    act(() => {
      result.current.handleBtQuickAddPoleRamal("P1");
    });

    expect(setAppState).toHaveBeenCalled();
    const nextState = setAppState.mock.calls[0][0];
    const poles = typeof nextState === "function" ? nextState(appState).btTopology.poles : nextState.btTopology.poles;
    expect(poles[0].ramais).toHaveLength(1);
  });
});
