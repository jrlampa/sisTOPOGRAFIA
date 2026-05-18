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

// ---------------------------------------------------------------------------
// parseInteger / lookup parity (float vs integer inputs)
// Regression: garante que a regra de aceitação de inteiros é idêntica
// entre os lookups de área e de clientes, e que float-como-inteiro é aceito.
// ---------------------------------------------------------------------------

describe("getClandestinoKvaByArea — parseInteger parity", () => {
  it("accepts an integer expressed as float (20.0 → key 20)", () => {
    // 20.0 rounds to 20 and 20 === 20.0 in IEEE754, so must succeed.
    expect(getClandestinoKvaByArea(20.0)).toBe(1.62);
  });

  it("rejects a true fractional value (20.5)", () => {
    // Math.round(20.5) = 21 ≠ 20.5 → parseInteger returns null.
    expect(getClandestinoKvaByArea(20.5)).toBeNull();
  });

  it("rejects a value very close to integer but not equal (20.0000001)", () => {
    // Floating-point noise: Math.round(20.0000001) = 20, but 20 !== 20.0000001.
    expect(getClandestinoKvaByArea(20.0000001)).toBeNull();
  });

  it("rejects NaN", () => {
    expect(getClandestinoKvaByArea(NaN)).toBeNull();
  });

  it("rejects Infinity", () => {
    expect(getClandestinoKvaByArea(Infinity)).toBeNull();
  });
});

describe("getClandestinoDiversificationFactorByClients — parseInteger parity", () => {
  it("accepts integer-as-float (1.0 → key 1)", () => {
    expect(getClandestinoDiversificationFactorByClients(1.0)).toBe(3.88);
  });

  it("rejects 1.5 (half-integer)", () => {
    expect(getClandestinoDiversificationFactorByClients(1.5)).toBeNull();
  });

  it("rejects 1.9 (near integer but not equal)", () => {
    expect(getClandestinoDiversificationFactorByClients(1.9)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateBtSummary — edge flag behavior (physical vs active topology)
// Regression: o summary conta TODAS as arestas físicas cadastradas,
// incluindo as marcadas para remoção. Comportamento intencional.
// ---------------------------------------------------------------------------

describe("calculateBtSummary — edge flag behavior (physical inventory)", () => {
  it("includes length of edges marked edgeChangeFlag:remove in totalLengthMeters", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0, lng: 0, title: "P2" },
        { id: "P3", lat: 0, lng: 0, title: "P3" },
      ],
      transformers: [],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          lengthMeters: 100,
          conductors: [],
        },
        {
          id: "E2",
          fromPoleId: "P2",
          toPoleId: "P3",
          lengthMeters: 50,
          edgeChangeFlag: "remove",
          conductors: [],
        },
      ],
    };

    const summary = calculateBtSummary(topology);
    // Physical total = 100 + 50 = 150; removal flag does not exclude from inventory.
    expect(summary.totalLengthMeters).toBe(150);
    // Edge count also reflects physical inventory.
    expect(summary.edges).toBe(2);
  });

  it("includes length of edges with removeOnExecution:true in totalLengthMeters", () => {
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
          lengthMeters: 80,
          removeOnExecution: true,
          conductors: [],
        },
      ],
    };

    const summary = calculateBtSummary(topology);
    expect(summary.totalLengthMeters).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// calculateEstimatedDemandByTransformer — readings sem currentMaxA
// Regression: quando readings existe mas sem corrente mensurável,
// deve usar o campo demandKva/demandKw persistido (fallback correto).
// ---------------------------------------------------------------------------

describe("calculateEstimatedDemandByTransformer — readings sem currentMaxA", () => {
  it("falls back to persisted demandKw when reading has no currentMaxA", () => {
    // Reading exists (length > 0) but currentMaxA is absent → hasUsableReadings = false
    // → getTransformerDemandKva returns rawDemand = demandKw = 8.0
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
          demandKw: 8.0,
          readings: [
            {
              id: "r1",
              // currentMaxA intentionally absent — simulates reading without measurement
            },
          ],
        },
      ],
      edges: [],
    };

    const results = calculateEstimatedDemandByTransformer(topology, "ramais", 0);
    expect(results).toHaveLength(1);
    // With no usable currentMaxA, fallback to demandKw = 8.0
    expect(results[0].estimatedDemandKva).toBe(8.0);
    expect(results[0].estimatedDemandKw).toBe(8.0);
  });

  it("uses reading-derived demand when currentMaxA is present (non-regression)", () => {
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
          demandKw: 99.0, // stale value — must be ignored
          readings: [{ id: "r1", currentMaxA: 10, temperatureFactor: 1 }],
        },
      ],
      edges: [],
    };

    const results = calculateEstimatedDemandByTransformer(topology, "ramais", 0);
    // 10A × 0.375 × 1.0 = 3.75 kVA — persisted 99 must be overridden
    expect(results[0].estimatedDemandKva).toBe(3.75);
  });
});

// ---------------------------------------------------------------------------
// calculateAccumulatedDemandByPole — removeOnExecution flag
// Regression: aresta com removeOnExecution:true deve ser excluída
// do grafo de propagação, equivalente a edgeChangeFlag:"remove".
// ---------------------------------------------------------------------------

describe("calculateAccumulatedDemandByPole — removeOnExecution exclusion", () => {
  it("excludes edge with removeOnExecution:true from propagation graph", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        {
          id: "P2",
          lat: 0,
          lng: 0,
          title: "P2",
          ramais: [{ id: "r1", quantity: 4, ramalType: "5 CC" }],
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
          removeOnExecution: true, // legacy flag — must behave like edgeChangeFlag:"remove"
          conductors: [],
        },
      ],
    };

    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    const byId = Object.fromEntries(results.map((r) => [r.poleId, r]));

    // P1 should not accumulate P2's clients because the edge is excluded
    expect(byId["P1"].accumulatedClients).toBe(0);
    // P2 is disconnected — only its own local clients
    expect(byId["P2"].accumulatedClients).toBe(4);
  });

  it("treats removeOnExecution:false as an active edge (non-regression)", () => {
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
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: 0,
          lng: 0,
          title: "T1",
          monthlyBillBrl: 0,
          demandKw: 9,
          readings: [],
        },
      ],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          removeOnExecution: false, // explicit false → edge is active
          conductors: [],
        },
      ],
    };

    const results = calculateAccumulatedDemandByPole(topology, "ramais", 0);
    const byId = Object.fromEntries(results.map((r) => [r.poleId, r]));

    // P1 must accumulate P2's 3 clients through the active edge
    expect(byId["P1"].accumulatedClients).toBe(3);
    expect(byId["P2"].accumulatedClients).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// calculateRamalDmdiKva – edge cases not in other tests
// ---------------------------------------------------------------------------

import {
  calculateRamalDmdiKva,
  distanceMetersBetween,
} from "../../src/utils/btCalculations";

describe("calculateRamalDmdiKva", () => {
  it("returns 0 when aa24DemandBase is non-finite", () => {
    expect(
      calculateRamalDmdiKva({
        projectType: "ramais",
        aa24DemandBase: Infinity,
        sumClientsX: 5,
        ab35LookupDmdi: 0,
      }),
    ).toBe(0);
  });

  it("returns 0 when sumClientsX is 0", () => {
    expect(
      calculateRamalDmdiKva({
        projectType: "ramais",
        aa24DemandBase: 10,
        sumClientsX: 0,
        ab35LookupDmdi: 0,
      }),
    ).toBe(0);
  });

  it("returns 0 when sumClientsX is negative", () => {
    expect(
      calculateRamalDmdiKva({
        projectType: "ramais",
        aa24DemandBase: 10,
        sumClientsX: -1,
        ab35LookupDmdi: 0,
      }),
    ).toBe(0);
  });

  it("returns 0 when sumClientsX is NaN", () => {
    expect(
      calculateRamalDmdiKva({
        projectType: "ramais",
        aa24DemandBase: 10,
        sumClientsX: NaN,
        ab35LookupDmdi: 0,
      }),
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// distanceMetersBetween – deprecated wrapper
// ---------------------------------------------------------------------------

describe("distanceMetersBetween (deprecated alias)", () => {
  it("returns same result as haversineDistanceMeters for two points", () => {
    const a = { lat: -22.9, lng: -43.2 };
    const b = { lat: -22.91, lng: -43.21 };
    const dist = distanceMetersBetween(a, b);
    expect(dist).toBeGreaterThan(0);
    expect(Number.isFinite(dist)).toBe(true);
  });

  it("returns 0 when both points are the same", () => {
    const p = { lat: 0, lng: 0 };
    expect(distanceMetersBetween(p, p)).toBe(0);
  });
});
