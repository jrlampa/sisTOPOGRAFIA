/**
 * useBtDerivedState.test.ts — Vitest: teste do hook de estados derivados BT.
 * Verifica cálculo de demanda, resumos e integração com serviço de backend.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBtDerivedState } from "../../src/hooks/useBtDerivedState";
import { fetchBtDerivedState } from "../../src/services/btDerivedService";
import { INITIAL_APP_STATE } from "../../src/app/initialState";

// Mock do serviço de backend
vi.mock("../../src/services/btDerivedService", () => ({
  fetchBtDerivedState: vi.fn(),
}));

describe("useBtDerivedState", () => {
  const setAppState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve buscar e carregar estados derivados ao montar", async () => {
    const mockPayload = {
      accumulatedByPole: [{ poleId: "P1", accumulatedDemandKva: 10 }],
      estimatedByTransformer: [],
      summary: { poles: 1, transformers: 0, edges: 0, totalLengthMeters: 0, transformerDemandKva: 0, transformerDemandKw: 0 },
      pointDemandKva: 5,
      sectioningImpact: null,
      clandestinoDisplay: null,
      transformersDerived: []
    };

    (fetchBtDerivedState as any).mockResolvedValue(mockPayload);

    const { result } = renderHook(() => useBtDerivedState({ 
      appState: INITIAL_APP_STATE, 
      setAppState 
    }));

    await waitFor(() => {
      expect(result.current.btAccumulatedByPole).toHaveLength(1);
      expect(result.current.btAccumulatedByPole[0].poleId).toBe("P1");
      expect(result.current.btSummary.poles).toBe(1);
    });
  });

  it("deve retornar valores vazios em caso de erro na API", async () => {
    (fetchBtDerivedState as any).mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() => useBtDerivedState({ 
      appState: INITIAL_APP_STATE, 
      setAppState 
    }));

    await waitFor(() => {
      expect(result.current.btAccumulatedByPole).toHaveLength(0);
      expect(result.current.btSummary.poles).toBe(0);
    });
  });
});
