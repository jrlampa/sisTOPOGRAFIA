/**
 * btTopologyFlow.test.ts — Vitest: teste da lógica de fluxo de rede BT.
 * Verifica cálculo de demanda acumulada e análise de seccionamento.
 */

import { describe, it, expect } from "vitest";
import { calculateAccumulatedDemandByPole, calculateSectioningImpact } from "../../src/utils/btTopologyFlow";
import { BtTopology } from "../../src/types";

const MOCK_TOPOLOGY: BtTopology = {
  poles: [
    { id: "P1", lat: -23, lng: -46, ramais: [{ id: "R1", quantity: 1, ramalType: "Clandestino" }] },
    { id: "P2", lat: -23.01, lng: -46.01, ramais: [] },
  ],
  transformers: [
    { id: "TR1", lat: -23.005, lng: -46.005, poleId: "P1" } as any
  ],
  edges: [
    { id: "E1", fromPoleId: "P1", toPoleId: "P2", lengthMeters: 10, conductors: [] }
  ]
};

describe("btTopologyFlow", () => {
  it("deve calcular demanda acumulada por poste corretamente em modo clandestino", () => {
    const results = calculateAccumulatedDemandByPole(
      MOCK_TOPOLOGY,
      "clandestino",
      100 // 100m2
    );

    expect(results).toHaveLength(2);
    const p1 = results.find(r => r.poleId === "P1");
    expect(p1?.localClients).toBe(1);
    // Em modo clandestino com area > 0, deve haver demanda
    expect(p1?.accumulatedDemandKva).toBeGreaterThan(0);
  });

  it("deve analisar impacto de seccionamento quando trafo é removido", () => {
    const topologyWithoutTrafo: BtTopology = { ...MOCK_TOPOLOGY, transformers: [] };
    
    const impact = calculateSectioningImpact(
        topologyWithoutTrafo, 
        "clandestino", 
        100
    );
    expect(impact.unservedPoleIds).toHaveLength(2);
    expect(impact.unservedClients).toBe(1);
  });
});
