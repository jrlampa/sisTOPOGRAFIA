import { vi } from "vitest";
/**
 * cqtLookupTables.test.ts
 *
 * Testes para server/constants/cqtLookupTables.ts.
 * Cobre as funções getTrafosZByScenario, getCabosByScenario e
 * getDisjuntoresByScenario em ambos os modos: baseline e DB cache.
 */

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Mocks configuráveis ──────────────────────────────────────────────────────
const { mockGetSync } = vi.hoisted(() => ({
  mockGetSync: vi.fn(),
}));

vi.mock("../config", () => ({
  config: {
    useDbConstantsCqt: false,
    useDbConstantsConfig: false,
  },
}));

vi.mock("../services/constantsService.js", () => ({
  constantsService: {
    getSync: mockGetSync,
  },
}));

import {
  TRAFOS_Z_BASELINE,
  CABOS_BASELINE,
  DISJUNTORES_BASELINE,
  getTrafosZByScenario,
  getCabosByScenario,
  getDisjuntoresByScenario,
} from "../constants/cqtLookupTables.js";

import { config } from "../config.js";

// ════════════════════════════════════════════════════════════════════════════
// Constantes baseline
// ════════════════════════════════════════════════════════════════════════════

describe("cqtLookupTables — constantes baseline", () => {
  it("TRAFOS_Z_BASELINE contém ao menos um trafo", () => {
    expect(Array.isArray(TRAFOS_Z_BASELINE)).toBe(true);
    expect(TRAFOS_Z_BASELINE.length).toBeGreaterThan(0);
  });

  it("cada TrafosZRow tem trafoKva e qtFactor numéricos", () => {
    for (const row of TRAFOS_Z_BASELINE) {
      expect(typeof row.trafoKva).toBe("number");
      expect(typeof row.qtFactor).toBe("number");
    }
  });

  it("CABOS_BASELINE contém cabos com campo name e ampacity", () => {
    expect(CABOS_BASELINE.length).toBeGreaterThan(0);
    for (const cabo of CABOS_BASELINE) {
      expect(typeof cabo.name).toBe("string");
      expect(typeof cabo.ampacity).toBe("number");
    }
  });

  it("DISJUNTORES_BASELINE contém disjuntores com campo ib e disjuntor", () => {
    expect(DISJUNTORES_BASELINE.length).toBeGreaterThan(0);
    for (const d of DISJUNTORES_BASELINE) {
      expect(typeof d.ib).toBe("number");
      expect(typeof d.disjuntor).toBe("number");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getTrafosZByScenario
// ════════════════════════════════════════════════════════════════════════════

describe("cqtLookupTables — getTrafosZByScenario", () => {
  beforeEach(() => {
    mockGetSync.mockReset();
    (config as any).useDbConstantsCqt = false;
  });

  it("retorna TRAFOS_Z_BASELINE quando useDbConstantsCqt=false", () => {
    const result = getTrafosZByScenario("atual");
    expect(result).toEqual(TRAFOS_Z_BASELINE);
  });

  it("retorna TRAFOS_Z_BASELINE sem argumento", () => {
    const result = getTrafosZByScenario();
    expect(result).toEqual(TRAFOS_Z_BASELINE);
  });

  it("retorna cache quando useDbConstantsCqt=true e cache disponível", () => {
    (config as any).useDbConstantsCqt = true;
    const cached = [{ trafoKva: 999, qtFactor: 0.1 }];
    mockGetSync.mockReturnValue(cached);
    const result = getTrafosZByScenario("proj1");
    expect(result).toEqual(cached);
  });

  it("retorna TRAFOS_Z_BASELINE quando useDbConstantsCqt=true mas cache retorna null", () => {
    (config as any).useDbConstantsCqt = true;
    mockGetSync.mockReturnValue(null);
    const result = getTrafosZByScenario("proj2");
    expect(result).toEqual(TRAFOS_Z_BASELINE);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getCabosByScenario
// ════════════════════════════════════════════════════════════════════════════

describe("cqtLookupTables — getCabosByScenario", () => {
  beforeEach(() => {
    mockGetSync.mockReset();
    (config as any).useDbConstantsCqt = false;
  });

  it("retorna CABOS_BASELINE quando useDbConstantsCqt=false", () => {
    const result = getCabosByScenario("atual");
    expect(result).toEqual(CABOS_BASELINE);
  });

  it("retorna CABOS_BASELINE sem argumento", () => {
    expect(getCabosByScenario()).toEqual(CABOS_BASELINE);
  });

  it("retorna cache quando useDbConstantsCqt=true e cache disponível", () => {
    (config as any).useDbConstantsCqt = true;
    const cached = [
      {
        name: "Cabo X",
        ampacity: 200,
        resistance: 0.1,
        reactance: 0.05,
        alpha: 0.004,
        divisorR: 1.28,
      },
    ];
    mockGetSync.mockReturnValue(cached);
    const result = getCabosByScenario("proj1");
    expect(result).toEqual(cached);
  });

  it("retorna CABOS_BASELINE quando useDbConstantsCqt=true mas cache retorna undefined", () => {
    (config as any).useDbConstantsCqt = true;
    mockGetSync.mockReturnValue(undefined);
    const result = getCabosByScenario("proj2");
    expect(result).toEqual(CABOS_BASELINE);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getDisjuntoresByScenario
// ════════════════════════════════════════════════════════════════════════════

describe("cqtLookupTables — getDisjuntoresByScenario", () => {
  beforeEach(() => {
    mockGetSync.mockReset();
    (config as any).useDbConstantsCqt = false;
  });

  it("retorna DISJUNTORES_BASELINE quando useDbConstantsCqt=false", () => {
    expect(getDisjuntoresByScenario("atual")).toEqual(DISJUNTORES_BASELINE);
  });

  it("retorna DISJUNTORES_BASELINE sem argumento", () => {
    expect(getDisjuntoresByScenario()).toEqual(DISJUNTORES_BASELINE);
  });

  it("retorna cache quando useDbConstantsCqt=true e cache disponível", () => {
    (config as any).useDbConstantsCqt = true;
    const cached = [{ ib: 999, disjuntor: 1000 }];
    mockGetSync.mockReturnValue(cached);
    expect(getDisjuntoresByScenario("proj1")).toEqual(cached);
  });

  it("retorna DISJUNTORES_BASELINE quando useDbConstantsCqt=true mas cache retorna null", () => {
    (config as any).useDbConstantsCqt = true;
    mockGetSync.mockReturnValue(null);
    expect(getDisjuntoresByScenario("proj2")).toEqual(DISJUNTORES_BASELINE);
  });
});

