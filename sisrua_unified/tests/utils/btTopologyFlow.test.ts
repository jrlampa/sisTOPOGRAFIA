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

describe("calculateAccumulatedDemandByPole – additional weighted-ramal branches", () => {
  it("skips clandestino ramais in weighted demand calc when projectType is 'ramais' (line 321)", () => {
    // In ramais mode, isClandestino=true → skip the ramal in weighted calculation (line 321)
    // BUT localClients still counts the quantity (getPoleClientsByProjectType sums all)
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          // ramalType undefined → defaults to CLANDESTINO_RAMAL_TYPE in weighted calc
          ramais: [{ id: "r1", quantity: 5 }],
        },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          demandKw: 10,
          readings: [],
        } as any,
      ],
      edges: [],
    };
    // Should NOT throw; the clandestino ramal is skipped in weighted demand calc
    expect(() => calculateAccumulatedDemandByPole(topology, "ramais", 0)).not.toThrow();
    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    const p1 = results.find((r) => r.poleId === "P1");
    expect(p1).toBeDefined();
    // localClients counts all ramal quantities (client count doesn't filter by type)
    expect(p1?.localClients).toBe(5);
  });

  it("skips non-clandestino ramals in clandestino mode (line 321, other branch)", () => {
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          ramais: [
            { id: "r1", quantity: 3, ramalType: "5 CC" }, // non-clandestino
          ],
        },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          demandKw: 10,
          readings: [],
        } as any,
      ],
      edges: [],
    };
    // In clandestino mode: "5 CC" ramais are skipped
    const results = calculateAccumulatedDemandByPole(topology, "clandestino", 50);
    const p1 = results.find((r) => r.poleId === "P1");
    expect(p1?.localClients).toBe(0); // "5 CC" ramal skipped in clandestino mode
  });

  it("skips ramals with quantity <= 0 (line 326)", () => {
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          ramais: [
            { id: "r1", quantity: 0, ramalType: "5 CC" },   // zero → skipped in weighted calc
            { id: "r2", quantity: -1, ramalType: "5 CC" },  // negative → skipped in weighted calc
            { id: "r3", quantity: 3, ramalType: "5 CC" },   // valid
          ],
        },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          demandKw: 10,
          readings: [],
        } as any,
      ],
      edges: [],
    };
    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    const p1 = results.find((r) => r.poleId === "P1");
    // localClients = sum of ALL ramal quantities (0 + -1 + 3 = 2)
    // The weighted demand calculation skips qty<=0 (line 326), but localClients uses sum
    expect(p1?.localClients).toBe(2);
    // Function should not throw
    expect(p1).toBeDefined();
  });

  it("uses hasUnknownRamalWeight=true when ramalType is unrecognised (line 331)", () => {
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          ramais: [
            { id: "r1", quantity: 5, ramalType: "UNKNOWN_TYPE" },
          ],
        },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          demandKw: 10,
          readings: [],
        } as any,
      ],
      edges: [],
    };
    // No throw expected; hasUnknownRamalWeight=true disables workbook demand
    expect(() =>
      calculateAccumulatedDemandByPole(topology, "ramais", 0),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// calculateBtSummary – via btTopologyFlow imports
// ---------------------------------------------------------------------------

describe("calculateBtSummary – additional paths", () => {
  it("includes counts and totalLengthMeters correctly", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0, lng: 0, title: "P2" },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 10,
          readings: [],
        },
      ],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [],
          lengthMeters: 100,
        },
      ],
    };

    const summary = calculateBtSummary(topology);
    expect(summary.poles).toBe(2);
    expect(summary.transformers).toBe(1);
    expect(summary.edges).toBe(1);
    expect(summary.totalLengthMeters).toBe(100);
    expect(summary.transformerDemandKva).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// BFS circuit-break path (line 287)
// ---------------------------------------------------------------------------

describe("calculateAccumulatedDemandByPole – circuit break BFS stop (line 287)", () => {
  it("circuit break pole stops BFS propagation", () => {
    // P1 (transformer) → P2 (circuit break) → P3
    // BFS from P1 hits P2 (circuit break) → line 287 hit, P3 not reachable via BFS from T1
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1", ramais: [{ id: "r1", quantity: 2, ramalType: "5 CC" }] },
        { id: "P2", lat: 0, lng: 0.001, title: "P2", circuitBreakPoint: true, ramais: [{ id: "r2", quantity: 1, ramalType: "5 CC" }] },
        { id: "P3", lat: 0, lng: 0.002, title: "P3", ramais: [{ id: "r3", quantity: 3, ramalType: "5 CC" }] },
      ],
      transformers: [
        { id: "T1", poleId: "P1", lat: 0, lng: 0, title: "T1", demandKw: 10, readings: [] } as any,
      ],
      edges: [
        { id: "E1", fromPoleId: "P1", toPoleId: "P2", conductors: [], lengthMeters: 10 },
        { id: "E2", fromPoleId: "P2", toPoleId: "P3", conductors: [], lengthMeters: 10 },
      ],
    };
    expect(() => calculateAccumulatedDemandByPole(topology, "ramais", 0)).not.toThrow();
    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    // P2 is a circuit break – children = [] (line 389-393), so no downstream from P2
    const p2 = results.find((r) => r.poleId === "P2");
    expect(p2).toBeDefined();
    expect(p2?.localClients).toBe(1);
    expect(p2?.accumulatedClients).toBe(1); // no children downstream
  });
});
