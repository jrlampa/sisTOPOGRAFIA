import { describe, it, expect, vi, afterEach } from "vitest";
import {
  calculateTransformerEnergyKwh,
  calculateTransformerDemandKva,
  calculateTransformerDemandKw,
  calculateTransformerMonthlyBill,
  getClandestinoKvaByArea,
  getClandestinoDiversificationFactorByClients,
  calculateClandestinoDemandKvaByAreaAndClients,
  calculateClandestinoDemandKva,
  calculatePointDemandKva,
  calculateAccumulatedDemandKva,
  calculateBtSummary,
  calculateAccumulatedDemandByPole,
  calculateEstimatedDemandByTransformer,
  calculateSectioningImpact,
} from "../../src/utils/btCalculations";
import type { BtTopology, BtTransformerReading } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeReading = (
  billedBrl: number,
  unitRateBrlPerKwh: number,
): BtTransformerReading => ({
  id: "r1",
  kwhMonth: 0,
  billedBrl,
  unitRateBrlPerKwh,
});

const emptyTopology = (): BtTopology => ({
  poles: [],
  transformers: [],
  edges: [],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// calculateTransformerEnergyKwh
// ---------------------------------------------------------------------------

describe("calculateTransformerEnergyKwh", () => {
  it("returns 0 for empty readings", () => {
    expect(calculateTransformerEnergyKwh([])).toBe(0);
  });

  it("computes energy for single reading", () => {
    // 100 BRL / 0.5 BRL/kWh = 200 kWh
    expect(calculateTransformerEnergyKwh([makeReading(100, 0.5)])).toBe(200);
  });

  it("skips readings with zero unit rate", () => {
    expect(calculateTransformerEnergyKwh([makeReading(100, 0)])).toBe(0);
  });

  it("accumulates multiple readings", () => {
    const readings = [makeReading(100, 0.5), makeReading(50, 1.0)];
    // 200 + 50 = 250
    expect(calculateTransformerEnergyKwh(readings)).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// calculateTransformerDemandKw
// ---------------------------------------------------------------------------

describe("calculateTransformerDemandKva", () => {
  it("returns 0 for empty readings", () => {
    expect(calculateTransformerDemandKva([])).toBe(0);
  });

  it("uses CORRENTE_MAX * 0.375 * FATOR_TEMPERATURA and picks highest corrected reading", () => {
    const readings: BtTransformerReading[] = [
      { id: "r1", currentMaxA: 10, temperatureFactor: 1.2 },
      { id: "r2", currentMaxA: 12, temperatureFactor: 1.0 },
    ];

    // r1 = 10 * 0.375 * 1.2 = 4.5; r2 = 12 * 0.375 * 1.0 = 4.5
    expect(calculateTransformerDemandKva(readings)).toBe(4.5);
    // Backward-compatible alias should keep exact same result.
    expect(calculateTransformerDemandKw(readings)).toBe(4.5);
  });
});

// ---------------------------------------------------------------------------
// calculateTransformerMonthlyBill
// ---------------------------------------------------------------------------

describe("calculateTransformerMonthlyBill", () => {
  it("returns 0 for empty readings", () => {
    expect(calculateTransformerMonthlyBill([])).toBe(0);
  });

  it("sums billedBrl across all readings", () => {
    const readings = [
      makeReading(100, 1),
      makeReading(250, 1),
      makeReading(50, 1),
    ];
    expect(calculateTransformerMonthlyBill(readings)).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// getClandestinoKvaByArea
// ---------------------------------------------------------------------------

describe("getClandestinoKvaByArea", () => {
  it("returns 1.62 for minimum area (20 m²)", () => {
    expect(getClandestinoKvaByArea(20)).toBe(1.62);
  });

  it("returns 1.88 for 50 m²", () => {
    expect(getClandestinoKvaByArea(50)).toBe(1.88);
  });

  it("returns null for area below minimum (19 m²)", () => {
    expect(getClandestinoKvaByArea(19)).toBeNull();
  });

  it("returns null for area above maximum (401 m²)", () => {
    expect(getClandestinoKvaByArea(401)).toBeNull();
  });

  it("returns null for non-integer area", () => {
    expect(getClandestinoKvaByArea(42.5)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getClandestinoDiversificationFactorByClients
// ---------------------------------------------------------------------------

describe("getClandestinoDiversificationFactorByClients", () => {
  it("returns 3.88 for 1 client", () => {
    expect(getClandestinoDiversificationFactorByClients(1)).toBe(3.88);
  });

  it("returns 9.64 for 10 clients", () => {
    expect(getClandestinoDiversificationFactorByClients(10)).toBe(9.64);
  });

  it("returns null for 0 clients (below minimum)", () => {
    expect(getClandestinoDiversificationFactorByClients(0)).toBeNull();
  });

  it("returns null for non-integer clients", () => {
    expect(getClandestinoDiversificationFactorByClients(1.5)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateClandestinoDemandKvaByAreaAndClients
// ---------------------------------------------------------------------------

describe("calculateClandestinoDemandKvaByAreaAndClients", () => {
  it("computes demand for (50 m², 10 clients): 1.88 × 9.64 = 18.12", () => {
    // 1.88 * 9.64 = 18.1232 → toFixed(2) → 18.12
    expect(calculateClandestinoDemandKvaByAreaAndClients(50, 10)).toBe(18.12);
  });

  it("returns 0 when area is out of range", () => {
    expect(calculateClandestinoDemandKvaByAreaAndClients(19, 10)).toBe(0);
  });

  it("returns 0 when clients are out of range", () => {
    expect(calculateClandestinoDemandKvaByAreaAndClients(50, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculatePointDemandKva
// ---------------------------------------------------------------------------

describe("calculatePointDemandKva", () => {
  it("returns RAMAL DMDI for normal mode (AA24 / SUM(X))", () => {
    const result = calculatePointDemandKva({
      projectType: "ramais",
      transformerDemandKva: 12,
      clandestinoAreaM2: 0,
      clandestinoClients: 4,
    });
    expect(result).toBe(3);
  });

  it("uses clandestino area/client lookup for clandestino project type", () => {
    const result = calculatePointDemandKva({
      projectType: "clandestino",
      transformerDemandKva: 0,
      clandestinoAreaM2: 50,
      clandestinoClients: 10,
    });
    expect(result).toBe(18.12);
  });
});

// ---------------------------------------------------------------------------
// calculateAccumulatedDemandKva
// ---------------------------------------------------------------------------

describe("calculateAccumulatedDemandKva", () => {
  it("sums downstream + trecho for ramais", () => {
    const result = calculateAccumulatedDemandKva({
      projectType: "ramais",
      clandestinoAreaM2: 0,
      accumulatedClients: 8,
      downstreamAccumulatedKva: 6.0,
      totalTrechoKva: 3.0,
    });
    expect(result).toBe(9.0);
  });

  it("uses clandestino lookup ignoring downstream for clandestino", () => {
    const result = calculateAccumulatedDemandKva({
      projectType: "clandestino",
      clandestinoAreaM2: 50,
      accumulatedClients: 10,
      downstreamAccumulatedKva: 999,
      totalTrechoKva: 999,
    });
    expect(result).toBe(18.12);
  });
});

describe("calculateClandestinoDemandKva", () => {
  it("returns kVA directly from lookup table without implicit kW conversion", () => {
    expect(calculateClandestinoDemandKva(50)).toBe(1.88);
  });
});

// ---------------------------------------------------------------------------
// calculateBtSummary
// ---------------------------------------------------------------------------

describe("calculateBtSummary", () => {
  it("returns zeros for empty topology", () => {
    const summary = calculateBtSummary(emptyTopology());
    expect(summary.poles).toBe(0);
    expect(summary.edges).toBe(0);
    expect(summary.transformers).toBe(0);
    expect(summary.totalLengthMeters).toBe(0);
    expect(summary.transformerDemandKva).toBe(0);
    expect(summary.transformerDemandKw).toBe(0);
  });

  it("counts poles, edges, transformers and total length", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0, lng: 0, title: "P2" },
      ],
      transformers: [
        {
          id: "T1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 5.0,
          readings: [],
        },
      ],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          lengthMeters: 120,
          conductors: [],
        },
      ],
    };
    const summary = calculateBtSummary(topology);
    expect(summary.poles).toBe(2);
    expect(summary.transformers).toBe(1);
    expect(summary.edges).toBe(1);
    expect(summary.totalLengthMeters).toBe(120);
    expect(summary.transformerDemandKva).toBe(5.0);
    expect(summary.transformerDemandKw).toBe(5.0);
  });
});

describe("unit invariants (kVA semantics)", () => {
  it("keeps summary aliases consistent: transformerDemandKva === transformerDemandKw", () => {
    const topology: BtTopology = {
      poles: [],
      transformers: [
        {
          id: "T1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 12.34,
          readings: [],
        },
      ],
      edges: [],
    };

    const summary = calculateBtSummary(topology);
    expect(summary.transformerDemandKva).toBe(summary.transformerDemandKw);
  });

  it("keeps transformer estimated demand aliases consistent", () => {
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          ramais: [{ id: "r1", quantity: 2, ramalType: "5 CC" }],
        },
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
          readings: [{ id: "r1" }],
        },
      ],
      edges: [],
    };

    const estimated = calculateEstimatedDemandByTransformer(
      topology,
      "ramais",
      0,
    );
    expect(estimated[0].estimatedDemandKva).toBe(
      estimated[0].estimatedDemandKw,
    );
  });

  it("keeps sectioning impact aliases consistent", () => {
    const topology: BtTopology = {
      poles: [{ id: "P1", lat: 0, lng: 0, title: "P1" }],
      transformers: [],
      edges: [],
    };

    const impact = calculateSectioningImpact(topology, "ramais", 0);
    expect(impact.estimatedDemandKva).toBe(impact.estimatedDemandKw);
  });

  it("prioritizes reading-derived demand over stale persisted demand in summary", () => {
    const topology: BtTopology = {
      poles: [{ id: "P1", lat: 0, lng: 0, title: "P1" }],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 50,
          readings: [{ id: "r1", currentMaxA: 10, temperatureFactor: 1 }],
        },
      ],
      edges: [],
    };

    const summary = calculateBtSummary(topology);
    expect(summary.transformerDemandKva).toBe(3.75);
  });

  it("prioritizes reading-derived demand over stale persisted demand in estimated demand", () => {
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          ramais: [{ id: "r1", quantity: 2, ramalType: "5 CC" }],
        },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 50,
          readings: [{ id: "r1", currentMaxA: 10, temperatureFactor: 1 }],
        },
      ],
      edges: [],
    };

    const estimated = calculateEstimatedDemandByTransformer(
      topology,
      "ramais",
      0,
    );
    expect(estimated[0].estimatedDemandKva).toBe(3.75);
  });
});

// ---------------------------------------------------------------------------
// calculateAccumulatedDemandByPole
// ---------------------------------------------------------------------------

describe("calculateAccumulatedDemandByPole", () => {
  it("returns empty array for empty topology", () => {
    expect(
      calculateAccumulatedDemandByPole(emptyTopology(), "ramais", 0),
    ).toEqual([]);
  });

  it("computes star topology with clear critical hub (ramais)", () => {
    // Hub P1 → spokes P2 (3 clients), P3 (5 clients), P4 (2 clients)
    // Transformer demand 10 kW, totalClients = 10 → avgDemandPerClient = 1.0
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        {
          id: "P2",
          lat: 0,
          lng: 0,
          title: "P2",
          ramais: [{ id: "r1", quantity: 3, ramalType: "5 CC" }],
        },
        {
          id: "P3",
          lat: 0,
          lng: 0,
          title: "P3",
          ramais: [{ id: "r2", quantity: 5, ramalType: "5 CC" }],
        },
        {
          id: "P4",
          lat: 0,
          lng: 0,
          title: "P4",
          ramais: [{ id: "r3", quantity: 2, ramalType: "5 CC" }],
        },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 10.0,
          readings: [],
        },
      ],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", quantity: 3, wireGaugeMm2: 16 }],
        },
        {
          id: "E2",
          fromPoleId: "P1",
          toPoleId: "P3",
          conductors: [{ id: "c2", quantity: 5, wireGaugeMm2: 16 }],
        },
        {
          id: "E3",
          fromPoleId: "P1",
          toPoleId: "P4",
          conductors: [{ id: "c3", quantity: 2, wireGaugeMm2: 16 }],
        },
      ],
    };

    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);

    // P1 accumulates all downstream → highest demand
    expect(results[0].poleId).toBe("P1");
    expect(results[0].accumulatedClients).toBe(10);
    expect(results[0].accumulatedDemandKva).toBe(10.0);

    // P3 is next (5 clients)
    expect(results[1].poleId).toBe("P3");
    expect(results[1].accumulatedClients).toBe(5);
    expect(results[1].accumulatedDemandKva).toBe(5.0);
  });

  it("computes linear chain correctly (ramais)", () => {
    // P1→P2 (3 clients), P2→P3 (2 clients)
    // Transformer 5 kW, totalClients=5, avgPerClient=1.0
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        {
          id: "P2",
          lat: 0,
          lng: 0,
          title: "P2",
          ramais: [{ id: "r4", quantity: 3, ramalType: "5 CC" }],
        },
        {
          id: "P3",
          lat: 0,
          lng: 0,
          title: "P3",
          ramais: [{ id: "r5", quantity: 2, ramalType: "5 CC" }],
        },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 5.0,
          readings: [],
        },
      ],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", quantity: 3, wireGaugeMm2: 16 }],
        },
        {
          id: "E2",
          fromPoleId: "P2",
          toPoleId: "P3",
          conductors: [{ id: "c2", quantity: 2, wireGaugeMm2: 16 }],
        },
      ],
    };

    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    const byId = Object.fromEntries(results.map((r) => [r.poleId, r]));

    expect(byId["P3"].localClients).toBe(2);
    expect(byId["P3"].accumulatedClients).toBe(2);
    expect(byId["P3"].accumulatedDemandKva).toBe(2.0);

    expect(byId["P2"].localClients).toBe(3);
    expect(byId["P2"].accumulatedClients).toBe(5);
    expect(byId["P2"].accumulatedDemandKva).toBe(5.0);

    // P1 has no incoming clients but accumulates P2's subtree
    expect(byId["P1"].localClients).toBe(0);
    expect(byId["P1"].accumulatedClients).toBe(5);
    expect(byId["P1"].accumulatedDemandKva).toBe(5.0);
  });

  it("does not throw for cyclic edges (cycle detection fallback)", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0, lng: 0, title: "P2" },
      ],
      transformers: [],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", quantity: 2, wireGaugeMm2: 16 }],
        },
        {
          id: "E2",
          fromPoleId: "P2",
          toPoleId: "P1",
          conductors: [{ id: "c2", quantity: 1, wireGaugeMm2: 16 }],
        },
      ],
    };

    expect(() =>
      calculateAccumulatedDemandByPole(topology, "ramais", 0),
    ).not.toThrow();
    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    expect(results.length).toBeGreaterThan(0);
  });

  it("results are sorted descending by accumulatedDemandKva", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0, lng: 0, title: "P2" },
        { id: "P3", lat: 0, lng: 0, title: "P3" },
      ],
      transformers: [
        {
          id: "T1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 6.0,
          readings: [],
        },
      ],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", quantity: 4, wireGaugeMm2: 16 }],
        },
        {
          id: "E2",
          fromPoleId: "P1",
          toPoleId: "P3",
          conductors: [{ id: "c2", quantity: 2, wireGaugeMm2: 16 }],
        },
      ],
    };

    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].accumulatedDemandKva).toBeGreaterThanOrEqual(
        results[i].accumulatedDemandKva,
      );
    }
  });

  it("ignores edges marked for removal in accumulated graph traversal", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        {
          id: "P2",
          lat: 0,
          lng: 0,
          title: "P2",
          ramais: [{ id: "r2", quantity: 5, ramalType: "5 CC" }],
        },
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
          edgeChangeFlag: "remove",
          conductors: [{ id: "c1", quantity: 1, wireGaugeMm2: 16 }],
        },
      ],
    };

    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    const byId = Object.fromEntries(results.map((r) => [r.poleId, r]));

    expect(byId["P1"].accumulatedClients).toBe(0);
    expect(byId["P2"].accumulatedClients).toBe(5);
  });
});

describe("loadClandestinoWorkbookRules", () => {
  it("overrides hardcoded lookup tables when API returns DB-backed values", async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          areaToKva: { "20": 9.99, "50": 8.88 },
          clientToDiversifFactor: { "1": 7.77, "10": 6.66 },
        }),
      }),
    );

    const mod = await import("../../src/utils/btCalculations");
    const loaded = await mod.loadClandestinoWorkbookRules();

    expect(loaded).toBe(true);
    expect(mod.getClandestinoKvaByArea(20)).toBe(9.99);
    expect(mod.getClandestinoDiversificationFactorByClients(10)).toBe(6.66);
  });

  it("keeps hardcoded fallback when API request fails", async () => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const mod = await import("../../src/utils/btCalculations");
    const loaded = await mod.loadClandestinoWorkbookRules();

    expect(loaded).toBe(false);
    expect(mod.getClandestinoKvaByArea(20)).toBe(1.62);
    expect(mod.getClandestinoDiversificationFactorByClients(10)).toBe(9.64);
  });
});
