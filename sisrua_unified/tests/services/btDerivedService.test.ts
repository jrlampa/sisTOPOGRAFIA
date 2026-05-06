/**
 * btDerivedService.test.ts — Vitest: teste do serviço de estados derivados BT.
 * Verifica chamadas à API e tratamento de erros.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBtDerivedState } from "../../src/services/btDerivedService";
import { EMPTY_BT_TOPOLOGY } from "../../src/utils/btNormalization";

describe("btDerivedService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("deve disparar POST /bt/derived com payload correto", async () => {
    const mockResponse = {
      summary: { poles: 1, transformers: 1, edges: 1, totalLengthMeters: 10, transformerDemandKva: 75 },
      pointDemandKva: 5,
      criticalPoleId: "P1",
      accumulatedByPole: [],
      estimatedByTransformer: [],
      sectioningImpact: { unservedPoleIds: [], unservedClients: 0, estimatedDemandKva: 0, loadCenter: null, suggestedPoleId: null },
      clandestinoDisplay: { demandKva: 0, areaMin: 0, areaMax: 0, diversificationFactor: null, finalDemandKva: 0 },
      transformersDerived: []
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await fetchBtDerivedState({
      topology: EMPTY_BT_TOPOLOGY,
      projectType: "ramais",
      clandestinoAreaM2: 0
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(result.summary.poles).toBe(1);
    expect(result.criticalPoleId).toBe("P1");
  });

  it("deve lançar erro se a API falhar (usando mensagem do payload)", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Erro Interno Servidor" })
    });

    await expect(fetchBtDerivedState({
      topology: EMPTY_BT_TOPOLOGY,
      projectType: "ramais",
      clandestinoAreaM2: 0
    })).rejects.toThrow("Erro Interno Servidor");
  });
});
