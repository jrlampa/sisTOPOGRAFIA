import { vi } from "vitest";

const getSyncMock = vi.fn();
vi.mock("../services/constantsService", () => ({
  constantsService: {
    getSync: getSyncMock,
  },
}));

let computeBtDerivedState: typeof import("../services/btDerivedService.js").computeBtDerivedState;

beforeAll(async () => {
  const mod = await import("../services/btDerivedService.js");
  computeBtDerivedState = mod.computeBtDerivedState;
});

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

describe("computeBtDerivedState – Flow & Accumulation", () => {
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

  it("points to the pole with highest accumulatedDemandKva", () => {
    const topology = makeTopology();
    const result = computeBtDerivedState(topology, "geral", 0);
    expect(result.criticalPoleId).toBe("p1");
  });

  it("stops demand propagation at circuitBreakPoint poles", () => {
    const topology = {
      poles: [
        { id: "p1", lat: -23.5, lng: -46.6, ramais: [{ quantity: 4, ramalType: "Ramal BT" }] },
        { id: "p2", lat: -23.51, lng: -46.61, ramais: [{ quantity: 3, ramalType: "Ramal BT" }], circuitBreakPoint: true },
        { id: "p3", lat: -23.52, lng: -46.62, ramais: [{ quantity: 2, ramalType: "Ramal BT" }] },
      ],
      transformers: [{ id: "tr1", poleId: "p1", demandKw: 30, readings: [{ id: "r1" }] }],
      edges: [
        { fromPoleId: "p1", toPoleId: "p2", lengthMeters: 50 },
        { fromPoleId: "p2", toPoleId: "p3", lengthMeters: 50 },
      ],
    };
    const result = computeBtDerivedState(topology, "geral", 0);
    const p2Entry = result.accumulatedByPole.find((e) => e.poleId === "p2");
    expect(p2Entry?.accumulatedClients).toBe(3);
  });
});

