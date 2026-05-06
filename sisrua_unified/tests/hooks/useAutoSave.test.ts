/**
 * useAutoSave.test.ts — Vitest tests for useAutoSave hook and helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useAutoSave,
  loadSessionDraft,
  clearSessionDraft,
} from "../../src/hooks/useAutoSave";
import type { GlobalState } from "../../src/types";
import { INITIAL_APP_STATE } from "../../src/app/initialState";

// Minimal GlobalState fixture – full type but using INITIAL_APP_STATE as base
const makeState = (override: Partial<GlobalState> = {}): GlobalState => ({
  ...INITIAL_APP_STATE,
  ...override,
});

describe("useAutoSave", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("persiste o estado no localStorage após o debounce", async () => {
    const state = makeState();
    renderHook(() => useAutoSave(state));

    // Nada deve ter sido escrito antes do debounce
    expect(localStorage.getItem("sisrua_session_draft")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1600); // debounce = 1500ms
    });

    const raw = localStorage.getItem("sisrua_session_draft");
    expect(raw).not.toBeNull();
    const draft = JSON.parse(raw!);
    expect(draft.version).toBe(1);
    expect(draft.state).toBeDefined();
    expect(draft.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("não persiste quando enabled=false", () => {
    const state = makeState();
    renderHook(() => useAutoSave(state, false));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(localStorage.getItem("sisrua_session_draft")).toBeNull();
  });

  it("reinicia o debounce ao receber novo estado antes do timeout", () => {
    const { rerender } = renderHook(
      ({ s }: { s: GlobalState }) => useAutoSave(s),
      { initialProps: { s: makeState() } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Re-render com novo estado — reseta o timer
    rerender({ s: makeState({ radius: 999 }) });

    act(() => {
      vi.advanceTimersByTime(700); // ainda não completou 1500ms desde o último render
    });
    expect(localStorage.getItem("sisrua_session_draft")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(900); // total 1600ms desde rerender
    });
    expect(localStorage.getItem("sisrua_session_draft")).not.toBeNull();
  });
});

describe("loadSessionDraft", () => {
  beforeEach(() => localStorage.clear());

  it("retorna null quando localStorage está vazio", () => {
    expect(loadSessionDraft()).toBeNull();
  });

  it("retorna null para JSON malformado", () => {
    localStorage.setItem("sisrua_session_draft", "{bad json}");
    expect(loadSessionDraft()).toBeNull();
  });

  it("retorna null para versão incompatível", () => {
    localStorage.setItem(
      "sisrua_session_draft",
      JSON.stringify({
        version: 99,
        state: {},
        savedAt: new Date().toISOString(),
      }),
    );
    expect(loadSessionDraft()).toBeNull();
  });

  it("retorna null quando state está ausente", () => {
    localStorage.setItem(
      "sisrua_session_draft",
      JSON.stringify({ version: 1, savedAt: new Date().toISOString() }),
    );
    expect(loadSessionDraft()).toBeNull();
  });

  it("retorna o draft salvo quando válido", () => {
    const draft = {
      version: 1,
      state: INITIAL_APP_STATE,
      savedAt: "2026-04-21T00:00:00.000Z",
    };
    localStorage.setItem("sisrua_session_draft", JSON.stringify(draft));
    const result = loadSessionDraft();
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.savedAt).toBe("2026-04-21T00:00:00.000Z");
  });
});

describe("clearSessionDraft", () => {
  it("remove o item do localStorage", () => {
    localStorage.setItem("sisrua_session_draft", "{}");
    clearSessionDraft();
    expect(localStorage.getItem("sisrua_session_draft")).toBeNull();
  });

  it("não lança erro quando localStorage já está vazio", () => {
    expect(() => clearSessionDraft()).not.toThrow();
  });
});
