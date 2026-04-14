import { jest } from "@jest/globals";

// Must mock constantsService before the module under test is loaded
const getSyncMock = jest.fn();
jest.mock("../services/constantsService", () => ({
  constantsService: {
    getSync: getSyncMock,
  },
}));

let computeBtDerivedState: typeof import("../services/btDerivedService.js").computeBtDerivedState;

beforeAll(async () => {
  const mod = await import("../services/btDerivedService.js");
  computeBtDerivedState = mod.computeBtDerivedState;
});

// ─── shared topology builders ──────────────────────────────────────────────

const makeTopology = (
  overrides: Partial<Parameters<typeof computeBtDerivedState>[0]> = {},
) => ({
  poles: [
    {
      id: "p1",
      lat: -23.5,
      lng: -46.6,
      ramais: [{ quantity: 3, ramalType: "Ramal BT" }],
    },
    {
      id: "p2",
      lat: -23.51,
      lng: -46.61,
      ramais: [{ quantity: 2, ramalType: "Ramal BT" }],
    },
  ],
  transformers: [
    { id: "tr1", poleId: "p1", demandKw: 15, readings: [{ id: "r1" }] },
  ],
  edges: [{ fromPoleId: "p1", toPoleId: "p2", lengthMeters: 50 }],
  ...overrides,
});

const withClandestinoConstants = () => {
  getSyncMock.mockImplementation((_ns: unknown, key: unknown) => {
    if (key === "AREA_TO_KVA") return { "100": 2.0 };
    if (key === "CLIENT_TO_DIVERSIF_FACTOR")
      return { "1": 1.0, "2": 0.9, "3": 0.85, "5": 0.8 };
    return null;
  });
};

const withoutClandestinoConstants = () => {
  getSyncMock.mockReturnValue(null);
};

// ─── summary ───────────────────────────────────────────────────────────────

describe("computeBtDerivedState – summary", () => {
  beforeEach(() => withoutClandestinoConstants());

  it("returns pole/transformer/edge counts", () => {
    const topology = makeTopology();
    const result = computeBtDerivedState(topology, "ramais", 0);

    expect(result.summary.poles).toBe(2);
    expect(result.summary.transformers).toBe(1);
    expect(result.summary.edges).toBe(1);
  });

  it("accumulates totalLengthMeters from edges", () => {
    const topology = makeTopology({
      edges: [
        { fromPoleId: "p1", toPoleId: "p2", lengthMeters: 50 },
        { fromPoleId: "p2", toPoleId: "p1", lengthMeters: 30 },
      ],
    });
    const result = computeBtDerivedState(topology, "ramais", 0);
    expect(result.summary.totalLengthMeters).toBe(80);
  });

  it("returns transformerDemandKw as sum of transformer.demandKw", () => {
    const topology = makeTopology({
      transformers: [
        { id: "tr1", poleId: "p1", demandKw: 10, readings: [] },
        { id: "tr2", poleId: "p2", demandKw: 5, readings: [] },
      ],
    });
    const result = computeBtDerivedState(topology, "ramais", 0);
    expect(result.summary.transformerDemandKw).toBe(15);
  });
});

// ─── empty topology ─────────────────────────────────────────────────────────

describe("computeBtDerivedState – empty topology", () => {
  beforeEach(() => withoutClandestinoConstants());

  it("handles empty poles/transformers/edges without error", () => {
    const result = computeBtDerivedState(
      { poles: [], transformers: [], edges: [] },
      "geral",
      0,
    );

    expect(result.summary.poles).toBe(0);
    expect(result.summary.transformers).toBe(0);
    expect(result.accumulatedByPole).toHaveLength(0);
    expect(result.estimatedByTransformer).toHaveLength(0);
    expect(result.criticalPoleId).toBeNull();
  });
});

// ─── criticalPoleId ─────────────────────────────────────────────────────────

describe("computeBtDerivedState – criticalPoleId", () => {
  beforeEach(() => withoutClandestinoConstants());

  it("is null when no poles exist", () => {
    const result = computeBtDerivedState(
      { poles: [], transformers: [], edges: [] },
      "geral",
      0,
    );
    expect(result.criticalPoleId).toBeNull();
  });

  it("points to the pole with highest accumulatedDemandKva", () => {
    // p1 has 3 clients, p2 has 2 clients; transformer is at p1 so p1 accumulates both
    const topology = makeTopology();
    const result = computeBtDerivedState(topology, "geral", 0);
    // p1 is the transformer root and accumulates downstream p2 → highest demand
    expect(result.criticalPoleId).toBe("p1");
  });
});

// ─── accumulatedByPole – ramais project type ────────────────────────────────

describe("computeBtDerivedState – accumulatedByPole (ramais)", () => {
  beforeEach(() => withoutClandestinoConstants());

  it("keeps root accumulated demand equal to transformer corrected demand", () => {
    const topology = {
      poles: [
        {
          id: "p1",
          lat: -23.5,
          lng: -46.6,
          ramais: [{ quantity: 66, ramalType: "Ramal BT" }],
        },
      ],
      transformers: [
        { id: "tr1", poleId: "p1", demandKw: 122.08, readings: [{ id: "r1" }] },
      ],
      edges: [],
    };

    const result = computeBtDerivedState(topology, "ramais", 0);
    const p1Entry = result.accumulatedByPole.find(
      (entry) => entry.poleId === "p1",
    );

    expect(p1Entry?.accumulatedDemandKva).toBe(122.08);
  });

  it("excludes clandestino ramais from localClients in ramais mode", () => {
    const pole = {
      id: "p1",
      lat: -23.5,
      lng: -46.6,
      ramais: [
        { quantity: 2, ramalType: "Ramal BT" },
        { quantity: 5, ramalType: "Clandestino" },
      ],
    };
    const result = computeBtDerivedState(
      { poles: [pole], transformers: [], edges: [] },
      "ramais",
      0,
    );
    const entry = result.accumulatedByPole.find((e) => e.poleId === "p1");
    expect(entry?.localClients).toBe(2);
  });

  it("returns sorted list with most-loaded pole first", () => {
    const topology = makeTopology();
    const result = computeBtDerivedState(topology, "geral", 0);
    for (let i = 1; i < result.accumulatedByPole.length; i++) {
      expect(
        result.accumulatedByPole[i - 1].accumulatedDemandKva,
      ).toBeGreaterThanOrEqual(
        result.accumulatedByPole[i].accumulatedDemandKva,
      );
    }
  });

  it("distributes local trecho demand using workbook ramal weights", () => {
    const topology = {
      poles: [
        {
          id: "p1",
          lat: -22.8,
          lng: -43.3,
          ramais: [{ quantity: 1, ramalType: "13 DX 6 AWG" }],
        },
        {
          id: "p2",
          lat: -22.81,
          lng: -43.31,
          ramais: [{ quantity: 1, ramalType: "13 QX 6 AWG" }],
        },
      ],
      transformers: [
        {
          id: "tr1",
          poleId: "p1",
          demandKw: 150,
          projectPowerKva: 225,
          readings: [{ id: "r1" }],
        },
      ],
      edges: [
        {
          fromPoleId: "p1",
          toPoleId: "p2",
          lengthMeters: 30,
          conductors: [{ conductorName: "185 Al - MX", quantity: 1 }],
        },
      ],
    };

    const result = computeBtDerivedState(topology, "ramais", 0);
    const byId = new Map(
      result.accumulatedByPole.map((entry) => [entry.poleId, entry]),
    );

    // 13 DX 6 AWG weight = 78, 13 QX 6 AWG weight = 72 (RAMAL!B5:U5)
    // With demand 150 and total weight 150 => local trecho should split to 78 and 72.
    expect(byId.get("p1")?.localTrechoDemandKva).toBe(78);
    expect(byId.get("p2")?.localTrechoDemandKva).toBe(72);

    expect(byId.get("p1")?.accumulatedDemandKva).toBe(150);
    expect(byId.get("p2")?.accumulatedDemandKva).toBe(72);
  });
});

// ─── accumulatedByPole – clandestino project type ───────────────────────────

describe("computeBtDerivedState – accumulatedByPole (clandestino)", () => {
  beforeEach(() => withClandestinoConstants());

  it("uses only clandestino ramais for localClients", () => {
    const pole = {
      id: "p1",
      lat: -23.5,
      lng: -46.6,
      ramais: [
        { quantity: 3, ramalType: "Clandestino" },
        { quantity: 10, ramalType: "Ramal BT" },
      ],
    };
    const result = computeBtDerivedState(
      { poles: [pole], transformers: [], edges: [] },
      "clandestino",
      100,
    );
    const entry = result.accumulatedByPole.find((e) => e.poleId === "p1");
    expect(entry?.localClients).toBe(3);
  });

  it("returns 0 demand when constantsService has no data", () => {
    withoutClandestinoConstants();
    const pole = {
      id: "p1",
      lat: -23.5,
      lng: -46.6,
      ramais: [{ quantity: 3, ramalType: "Clandestino" }],
    };
    const result = computeBtDerivedState(
      { poles: [pole], transformers: [], edges: [] },
      "clandestino",
      100,
    );
    const entry = result.accumulatedByPole.find((e) => e.poleId === "p1");
    expect(entry?.localTrechoDemandKva).toBe(0);
  });
});

// ─── circuit break ──────────────────────────────────────────────────────────

describe("computeBtDerivedState – circuit break", () => {
  beforeEach(() => withoutClandestinoConstants());

  it("stops demand propagation at circuitBreakPoint poles", () => {
    const topology = {
      poles: [
        {
          id: "p1",
          lat: -23.5,
          lng: -46.6,
          ramais: [{ quantity: 4, ramalType: "Ramal BT" }],
        },
        {
          id: "p2",
          lat: -23.51,
          lng: -46.61,
          ramais: [{ quantity: 3, ramalType: "Ramal BT" }],
          circuitBreakPoint: true,
        },
        {
          id: "p3",
          lat: -23.52,
          lng: -46.62,
          ramais: [{ quantity: 2, ramalType: "Ramal BT" }],
        },
      ],
      transformers: [
        { id: "tr1", poleId: "p1", demandKw: 30, readings: [{ id: "r1" }] },
      ],
      edges: [
        { fromPoleId: "p1", toPoleId: "p2", lengthMeters: 50 },
        { fromPoleId: "p2", toPoleId: "p3", lengthMeters: 50 },
      ],
    };
    const result = computeBtDerivedState(topology, "geral", 0);
    // p3 is downstream of p2 (circuit break), so p3 should not accumulate p2's clients
    const p2Entry = result.accumulatedByPole.find((e) => e.poleId === "p2");
    expect(p2Entry?.accumulatedClients).toBe(3); // only p2's own, not p3
  });
});

// ─── estimatedByTransformer ─────────────────────────────────────────────────

describe("computeBtDerivedState – estimatedByTransformer", () => {
  beforeEach(() => withoutClandestinoConstants());

  it("returns empty array when no transformers", () => {
    const result = computeBtDerivedState(
      {
        poles: [{ id: "p1", lat: 0, lng: 0 }],
        transformers: [],
        edges: [],
      },
      "geral",
      0,
    );
    expect(result.estimatedByTransformer).toHaveLength(0);
  });

  it("uses measured demandKw for transformers with readings", () => {
    const topology = makeTopology();
    const result = computeBtDerivedState(topology, "geral", 0);
    const entry = result.estimatedByTransformer.find(
      (e) => e.transformerId === "tr1",
    );
    // tr1 has one reading, so measured value (15) should be used directly
    expect(entry?.estimatedDemandKw).toBe(15);
  });

  it("returns zero estimated demand for transformer without poleId link", () => {
    const topology = {
      poles: [
        {
          id: "p1",
          lat: 0,
          lng: 0,
          ramais: [{ quantity: 2, ramalType: "Ramal BT" }],
        },
      ],
      transformers: [{ id: "tr1", demandKw: 10, readings: [] }],
      edges: [],
    };
    const result = computeBtDerivedState(topology, "geral", 0);
    const entry = result.estimatedByTransformer.find(
      (e) => e.transformerId === "tr1",
    );
    expect(entry).toBeDefined();
    expect(entry?.assignedClients).toBe(0);
    expect(entry?.estimatedDemandKw).toBe(0);
  });

  it("assigns each pole to its closest transformer", () => {
    const topology = {
      poles: [
        {
          id: "p1",
          lat: 0,
          lng: 0,
          ramais: [{ quantity: 5, ramalType: "Ramal BT" }],
        },
        {
          id: "p2",
          lat: 0.001,
          lng: 0,
          ramais: [{ quantity: 3, ramalType: "Ramal BT" }],
        },
        {
          id: "p3",
          lat: 0.002,
          lng: 0,
          ramais: [{ quantity: 4, ramalType: "Ramal BT" }],
        },
      ],
      transformers: [
        { id: "tr1", poleId: "p1", demandKw: 20, readings: [{ id: "r1" }] },
        { id: "tr2", poleId: "p3", demandKw: 15, readings: [{ id: "r2" }] },
      ],
      edges: [
        { fromPoleId: "p1", toPoleId: "p2" },
        { fromPoleId: "p2", toPoleId: "p3" },
      ],
    };
    const result = computeBtDerivedState(topology, "geral", 0);
    const tr1 = result.estimatedByTransformer.find(
      (e) => e.transformerId === "tr1",
    );
    const tr2 = result.estimatedByTransformer.find(
      (e) => e.transformerId === "tr2",
    );
    // p1 (dist 0) and p2 (dist 1 from p1, dist 2 from p3) → p1 closer; p3 → tr2
    expect(tr1?.assignedClients).toBe(8); // p1(5) + p2(3)
    expect(tr2?.assignedClients).toBe(4); // p3(4)
  });
});

// ─── pointDemandKva ─────────────────────────────────────────────────────────

describe("computeBtDerivedState – pointDemandKva", () => {
  beforeEach(() => withoutClandestinoConstants());

  it("is 0 when there are no clients", () => {
    const result = computeBtDerivedState(
      {
        poles: [{ id: "p1", lat: 0, lng: 0, ramais: [] }],
        transformers: [
          { id: "tr1", poleId: "p1", demandKw: 10, readings: [{ id: "r1" }] },
        ],
        edges: [],
      },
      "geral",
      0,
    );
    expect(result.pointDemandKva).toBe(0);
  });

  it("divides transformer demand by total clients in non-clandestino mode", () => {
    // 3 + 2 = 5 clients; demandKw = 15 → pointDemand = 15/5 = 3
    const topology = makeTopology();
    const result = computeBtDerivedState(topology, "geral", 0);
    expect(result.pointDemandKva).toBeCloseTo(3, 2);
  });
});

// ─── CQT voltage propagation ────────────────────────────────────────────────

describe("computeBtDerivedState – CQT qtTr source", () => {
  beforeEach(() => withClandestinoConstants());

  it("uses transformer demand as QT_TR numerator instead of accumulated root demand", () => {
    const topology = {
      poles: [
        {
          id: "p1",
          lat: -23.5,
          lng: -46.6,
          ramais: [{ quantity: 1, ramalType: "Clandestino" }],
        },
        { id: "p2", lat: -23.51, lng: -46.61, ramais: [] },
      ],
      transformers: [
        {
          id: "tr1",
          poleId: "p1",
          demandKw: 10,
          projectPowerKva: 100,
          readings: [{ id: "r1" }],
        },
      ],
      edges: [
        {
          fromPoleId: "p1",
          toPoleId: "p2",
          lengthMeters: 0,
          conductors: [{ conductorName: "70 Al - MX", quantity: 1 }],
        },
      ],
    };

    const result = computeBtDerivedState(topology, "clandestino", 100);
    const p1 = result.accumulatedByPole.find((entry) => entry.poleId === "p1");

    // QT_MTTR% = (QT_MT + QT_TR) * 100
    // QT_MT = 0.0183
    // QT_TR = (demandKw / projectPowerKva) * 0.035 = (10/100)*0.035 = 0.0035
    // => dV% base expected = (0.0183 + 0.0035) * 100 = 2.18
    expect(p1).toBeDefined();
    expect(p1?.dvAccumPercent).toBeCloseTo(2.18, 2);
  });
});
