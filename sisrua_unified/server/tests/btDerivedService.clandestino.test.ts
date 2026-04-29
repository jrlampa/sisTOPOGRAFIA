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

const withClandestinoConstants = () => {
  getSyncMock.mockImplementation((_ns: unknown, key: unknown) => {
    if (key === "AREA_TO_KVA") return { "100": 2.0 };
    if (key === "CLIENT_TO_DIVERSIF_FACTOR")
      return { "1": 1.0, "2": 0.9, "3": 0.85, "5": 0.8 };
    return null;
  });
};

describe("computeBtDerivedState – Clandestino", () => {
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
    const result = computeBtDerivedState({ poles: [pole], transformers: [], edges: [] }, "clandestino", 100);
    const entry = result.accumulatedByPole.find((e) => e.poleId === "p1");
    expect(entry?.localClients).toBe(3);
  });

  it("returns 0 demand for fractional area (100.5) — parity with frontend", () => {
    const pole = { id: "p1", lat: -23.5, lng: -46.6, ramais: [{ quantity: 3, ramalType: "Clandestino" }] };
    const result = computeBtDerivedState({ poles: [pole], transformers: [], edges: [] }, "clandestino", 100.5);
    expect(result.clandestinoDisplay.finalDemandKva).toBe(0);
  });
});

