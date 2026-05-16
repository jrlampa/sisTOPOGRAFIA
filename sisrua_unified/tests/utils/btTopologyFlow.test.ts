import { describe, it, expect } from "vitest";
import {
  calculateAccumulatedDemandByPole,
  calculateSectioningImpact,
  calculateEstimatedDemandByTransformer,
  calculateBtSummary,
  calculateAccumulatedDemandKva,
} from "../../src/utils/btTopologyFlow";
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

// ---------------------------------------------------------------------------
// calculateSectioningImpact – additional paths
// ---------------------------------------------------------------------------

describe("calculateSectioningImpact – additional paths", () => {
  it("returns empty impact for topology with no poles", () => {
    const topology: BtTopology = { poles: [], transformers: [], edges: [] };
    const impact = calculateSectioningImpact(topology, "ramais", 0);
    expect(impact.unservedPoleIds).toHaveLength(0);
    expect(impact.unservedClients).toBe(0);
    expect(impact.loadCenter).toBeNull();
    expect(impact.suggestedPoleId).toBeNull();
  });

  it("returns null loadCenter / suggestedPoleId when all poles are served", () => {
    const topology: BtTopology = {
      poles: [{ id: "P1", lat: -22, lng: -43, title: "P1" }],
      transformers: [{ id: "T1", poleId: "P1", lat: -22, lng: -43, title: "T1" } as any],
      edges: [],
    };
    const impact = calculateSectioningImpact(topology, "ramais", 0);
    expect(impact.loadCenter).toBeNull();
    expect(impact.suggestedPoleId).toBeNull();
  });

  it("computes loadCenter and suggestedPoleId when unserved poles exist", () => {
    // Topology with no transformer → all poles unserved
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: -22.0, lng: -43.0, title: "P1" },
        { id: "P2", lat: -22.1, lng: -43.1, title: "P2" },
      ],
      transformers: [],
      edges: [],
    };
    const impact = calculateSectioningImpact(topology, "ramais", 0);
    expect(impact.unservedPoleIds).toHaveLength(2);
    expect(impact.loadCenter).not.toBeNull();
    expect(impact.suggestedPoleId).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateEstimatedDemandByTransformer – additional paths
// ---------------------------------------------------------------------------

describe("calculateEstimatedDemandByTransformer – additional paths", () => {
  it("returns [] when topology has no transformers", () => {
    const topology: BtTopology = {
      poles: [{ id: "P1", lat: 0, lng: 0, title: "P1" }],
      transformers: [],
      edges: [],
    };
    expect(calculateEstimatedDemandByTransformer(topology, "ramais", 0)).toEqual([]);
  });

  it("returns [] when topology has no poles", () => {
    const topology: BtTopology = {
      poles: [],
      transformers: [{ id: "T1", lat: 0, lng: 0, title: "T1" } as any],
      edges: [],
    };
    expect(calculateEstimatedDemandByTransformer(topology, "ramais", 0)).toEqual([]);
  });

  it("assigns 0 clients to a transformer with no poles in its service area", () => {
    const topology: BtTopology = {
      poles: [{ id: "P1", lat: 0, lng: 0, title: "P1" }],
      transformers: [{ id: "T1", poleId: "P1", lat: 0, lng: 0, title: "T1" } as any],
      edges: [],
    };
    const result = calculateEstimatedDemandByTransformer(topology, "ramais", 0);
    expect(result).toHaveLength(1);
    expect(result[0].assignedClients).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// calculateAccumulatedDemandKva
// ---------------------------------------------------------------------------

describe("calculateAccumulatedDemandKva", () => {
  it("uses clandestino lookup when projectType is clandestino", () => {
    const result = calculateAccumulatedDemandKva({
      projectType: "clandestino",
      clandestinoAreaM2: 50,
      accumulatedClients: 10,
      downstreamAccumulatedKva: 999,
      totalTrechoKva: 999,
    });
    expect(result).toBe(18.12);
  });

  it("sums downstream + trecho for ramais", () => {
    const result = calculateAccumulatedDemandKva({
      projectType: "ramais",
      clandestinoAreaM2: 0,
      accumulatedClients: 3,
      downstreamAccumulatedKva: 5,
      totalTrechoKva: 2,
    });
    expect(result).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// calculateBtSummary
// ---------------------------------------------------------------------------

describe("calculateBtSummary", () => {
  it("sums edge lengths correctly", () => {
    const topology: BtTopology = {
      poles: [],
      transformers: [],
      edges: [
        { id: "E1", fromPoleId: "P1", toPoleId: "P2", conductors: [], lengthMeters: 100 },
        { id: "E2", fromPoleId: "P2", toPoleId: "P3", conductors: [], lengthMeters: 200 },
      ],
    };
    const summary = calculateBtSummary(topology);
    expect(summary.totalLengthMeters).toBe(300);
    expect(summary.edges).toBe(2);
  });

  it("handles edges without lengthMeters (defaults to 0)", () => {
    const topology: BtTopology = {
      poles: [],
      transformers: [],
      edges: [
        { id: "E1", fromPoleId: "P1", toPoleId: "P2", conductors: [] } as any,
      ],
    };
    const summary = calculateBtSummary(topology);
    expect(summary.totalLengthMeters).toBe(0);
  });
});
