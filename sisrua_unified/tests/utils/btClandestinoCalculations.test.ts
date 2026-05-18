import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

// ---------------------------------------------------------------------------
// btClandestinoCalculations.test.ts
//
// Tests for coverage of loadClandestinoWorkbookRules branches and
// calculateClandestinoDemandKva null-return path.
// ---------------------------------------------------------------------------

// We import the bare calculation helpers that don't require fetch.
import {
  getClandestinoKvaByArea,
  getClandestinoDiversificationFactorByClients,
  calculateClandestinoDemandKvaByAreaAndClients,
  calculateClandestinoDemandKva,
  getClandestinoAreaRange,
  getClandestinoClientsRange,
} from "../../src/utils/btClandestinoCalculations";

// ---------------------------------------------------------------------------
// lookup helpers (without workbook override)
// ---------------------------------------------------------------------------

describe("getClandestinoAreaRange / getClandestinoClientsRange", () => {
  it("returns valid min/max for area range", () => {
    const range = getClandestinoAreaRange();
    expect(range.min).toBeGreaterThan(0);
    expect(range.max).toBeGreaterThan(range.min);
  });

  it("returns valid min/max for clients range", () => {
    const range = getClandestinoClientsRange();
    expect(range.min).toBeGreaterThanOrEqual(1);
    expect(range.max).toBeGreaterThan(range.min);
  });
});

describe("calculateClandestinoDemandKva – null path (line 136)", () => {
  it("returns 0 for area outside the lookup table (e.g. 1 m²)", () => {
    expect(calculateClandestinoDemandKva(1)).toBe(0);
  });

  it("returns 0 for area above max (401 m²)", () => {
    expect(calculateClandestinoDemandKva(401)).toBe(0);
  });

  it("returns a positive value for a valid area (50 m²)", () => {
    expect(calculateClandestinoDemandKva(50)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// loadClandestinoWorkbookRules – async error branches
// We use vi.resetModules() to get a fresh module state for each branch test.
// ---------------------------------------------------------------------------

describe("loadClandestinoWorkbookRules – error branches", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when the API response is not ok", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn() });
    vi.stubGlobal("fetch", fetchMock);

    const { loadClandestinoWorkbookRules } = await import(
      "../../src/utils/btClandestinoCalculations"
    );

    await expect(loadClandestinoWorkbookRules()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns false when fetch rejects (network error)", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    const { loadClandestinoWorkbookRules } = await import(
      "../../src/utils/btClandestinoCalculations"
    );

    await expect(loadClandestinoWorkbookRules()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// loadClandestinoWorkbookRules – success branch (separate dynamic import)
// ---------------------------------------------------------------------------

describe("loadClandestinoWorkbookRules – success branch (via dynamic import)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when API responds with valid areaToKva and clientToDiversifFactor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        areaToKva: { "20": 1.62, "50": 1.88 },
        clientToDiversifFactor: { "1": 3.88, "10": 9.64 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const {
      loadClandestinoWorkbookRules,
      getClandestinoKvaByArea,
      getClandestinoDiversificationFactorByClients,
    } = await import("../../src/utils/btClandestinoCalculations");

    await expect(loadClandestinoWorkbookRules()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getClandestinoKvaByArea(20)).toBe(1.62);
    expect(getClandestinoDiversificationFactorByClients(10)).toBe(9.64);
  });
});

// ---------------------------------------------------------------------------
// Additional branch tests via helper functions
// ---------------------------------------------------------------------------

describe("getClandestinoKvaByArea – branch coverage", () => {
  it("returns null for non-integer float", () => {
    expect(getClandestinoKvaByArea(42.5)).toBeNull();
  });

  it("returns null for non-finite input (Infinity)", () => {
    expect(getClandestinoKvaByArea(Infinity)).toBeNull();
  });

  it("returns null for NaN input", () => {
    expect(getClandestinoKvaByArea(NaN)).toBeNull();
  });

  it("returns null for area 0 (below minimum)", () => {
    expect(getClandestinoKvaByArea(0)).toBeNull();
  });
});

describe("getClandestinoDiversificationFactorByClients – branch coverage", () => {
  it("returns null for fractional clients", () => {
    expect(getClandestinoDiversificationFactorByClients(2.7)).toBeNull();
  });

  it("returns null for non-finite input (NaN)", () => {
    expect(getClandestinoDiversificationFactorByClients(NaN)).toBeNull();
  });

  it("returns null for 0 clients", () => {
    expect(getClandestinoDiversificationFactorByClients(0)).toBeNull();
  });

  it("returns a positive factor for 1 client", () => {
    expect(getClandestinoDiversificationFactorByClients(1)).toBeGreaterThan(0);
  });
});

describe("calculateClandestinoDemandKvaByAreaAndClients – branch coverage", () => {
  it("returns 0 when area is null (out of range)", () => {
    expect(calculateClandestinoDemandKvaByAreaAndClients(1, 1)).toBe(0);
  });

  it("returns 0 when clients is null (out of range)", () => {
    expect(calculateClandestinoDemandKvaByAreaAndClients(50, 0)).toBe(0);
  });

  it("returns computed value when both are valid", () => {
    expect(
      calculateClandestinoDemandKvaByAreaAndClients(50, 10),
    ).toBeGreaterThan(0);
  });
});
