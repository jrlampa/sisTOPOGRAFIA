/**
 * useMapUrlState.test.ts — Testes Vitest para sincronização URL ↔ estado do mapa.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { useMapUrlState } from "../../src/hooks/useMapUrlState";
import type { GlobalState } from "../../src/types";
import { INITIAL_APP_STATE } from "../../src/app/initialState";

// Wrapper que inicializa MemoryRouter com a URL inicial desejada
function makeWrapper(initialUrl: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [initialUrl] },
      children,
    );
  };
}

const baseState: GlobalState = {
  ...INITIAL_APP_STATE,
  center: { lat: -23.55, lng: -46.63, label: "São Paulo" },
  radius: 500,
  selectionMode: "circle",
};

describe("useMapUrlState", () => {
  it("não quebra quando não há query params na URL", () => {
    const setAppState = vi.fn();
    const { result } = renderHook(
      () => useMapUrlState({ appState: baseState, setAppState }),
      { wrapper: makeWrapper("/app") },
    );
    // Hook retorna void; verificamos que não houve chamada sem params válidos
    expect(result.current).toBeUndefined();
    expect(setAppState).not.toHaveBeenCalled();
  });

  it("lê lat/lng/r/mode da URL e chama setAppState na montagem", () => {
    const setAppState = vi.fn();
    renderHook(() => useMapUrlState({ appState: baseState, setAppState }), {
      wrapper: makeWrapper("/app?lat=-23.0&lng=-46.0&r=1000&mode=polygon"),
    });
    expect(setAppState).toHaveBeenCalledTimes(1);
    const [nextState, commit] = setAppState.mock.calls[0];
    expect(nextState.center.lat).toBeCloseTo(-23.0);
    expect(nextState.center.lng).toBeCloseTo(-46.0);
    expect(nextState.radius).toBe(1000);
    expect(nextState.selectionMode).toBe("polygon");
    expect(commit).toBe(false);
  });

  it("ignora radius fora do intervalo válido (10–50000)", () => {
    const setAppState = vi.fn();
    renderHook(() => useMapUrlState({ appState: baseState, setAppState }), {
      wrapper: makeWrapper("/app?lat=-23.0&lng=-46.0&r=99999"),
    });
    const [nextState] = setAppState.mock.calls[0];
    // r inválido → mantém radius do appState
    expect(nextState.radius).toBe(baseState.radius);
  });

  it("ignora mode inválido", () => {
    const setAppState = vi.fn();
    renderHook(() => useMapUrlState({ appState: baseState, setAppState }), {
      wrapper: makeWrapper("/app?lat=-23.0&lng=-46.0&mode=invalid"),
    });
    const [nextState] = setAppState.mock.calls[0];
    expect(nextState.selectionMode).toBe(baseState.selectionMode);
  });

  it("não chama setAppState quando todos os params são inválidos/ausentes", () => {
    const setAppState = vi.fn();
    renderHook(() => useMapUrlState({ appState: baseState, setAppState }), {
      wrapper: makeWrapper("/app?foo=bar"),
    });
    expect(setAppState).not.toHaveBeenCalled();
  });
});
