/**
 * mechanicalAndAnalysisRoutes.test.ts
 *
 * Testes para os endpoints de cálculo mecânico e análise de cenários.
 * Mock das funções de cálculo para testar apenas o contrato HTTP.
 */

import request from "supertest";
import express from "express";
import { jest } from "@jest/globals";

// ─── Mock logger ─────────────────────────────────────────────────────────────
jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Mock posteCalc ───────────────────────────────────────────────────────────
const calculatePosteLoadMock = jest.fn<(...args: any[]) => any>();
const selecionarPosteMock = jest.fn<(...args: any[]) => any>();
const calculateForceVentoMock = jest.fn<(...args: any[]) => any>();
const calculateResultantForceMock = jest.fn<(...args: any[]) => any>();

jest.mock("../core/mechanicalCalc/posteCalc", () => ({
  calculatePosteLoad: calculatePosteLoadMock,
  selecionarPosteDeCatalogo: selecionarPosteMock,
  calculateForceVento: calculateForceVentoMock,
  calculateResultantForce: calculateResultantForceMock,
}));

// ─── Mock scenarioAnalysisService ─────────────────────────────────────────────
const calculateScenarioScoreMock = jest.fn<(...args: any[]) => any>();
const rankScenariosMock = jest.fn<(...args: any[]) => any>();
const compararCenariosMock = jest.fn<(...args: any[]) => any>();

jest.mock("../services/scenarioAnalysisService", () => ({
  calculateScenarioScore: calculateScenarioScoreMock,
  rankScenarios: rankScenariosMock,
  compararCenarios: compararCenariosMock,
}));

// ─── Mock listing utils ────────────────────────────────────────────────────────
jest.mock("../utils/listing", () => ({
  buildListMeta: jest.fn((...args: any[]) => ({})),
  comparePrimitiveValues: jest.fn((a: any, b: any, _order: any) =>
    a < b ? -1 : a > b ? 1 : 0,
  ),
}));

// ─── Mock schemas (createListQuerySchema) ─────────────────────────────────────
// We don't mock this - it's pure Zod, should work fine

// ─── Build app ────────────────────────────────────────────────────────────────
let app: express.Application;

beforeAll(async () => {
  const mod = await import("../routes/mechanicalAndAnalysisRoutes.js");
  app = express();
  app.use(express.json());
  app.use("/", mod.default);
});

beforeEach(() => {
  calculatePosteLoadMock.mockReset();
  selecionarPosteMock.mockReset();
  calculateForceVentoMock.mockReset();
  calculateResultantForceMock.mockReset();
  rankScenariosMock.mockReset();
  calculateScenarioScoreMock.mockReset();
  compararCenariosMock.mockReset();
});

// ─── Valid fixtures ────────────────────────────────────────────────────────────

const validPoste = {
  alturaM: 10,
  diametroTopoMm: 120,
  diametroBaseMm: 250,
  rupturaKnM: 600,
};

const validForca = {
  componente: { fx: 10, fy: 5 },
  momentoKnM: 50,
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /poste/calculate
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /poste/calculate", () => {
  it("returns 200 with calculation result", async () => {
    calculatePosteLoadMock.mockReturnValue({
      momentoResultante: 55,
      withinLimits: true,
    });
    const res = await request(app)
      .post("/poste/calculate")
      .send({ poste: validPoste, forcas: [validForca] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.momentoResultante).toBe(55);
  });

  it("returns 400 on missing poste", async () => {
    const res = await request(app)
      .post("/poste/calculate")
      .send({ forcas: [validForca] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("returns 400 on empty forcas array", async () => {
    const res = await request(app)
      .post("/poste/calculate")
      .send({ poste: validPoste, forcas: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when calculation throws", async () => {
    calculatePosteLoadMock.mockImplementation(() => {
      throw new Error("geometry error");
    });
    const res = await request(app)
      .post("/poste/calculate")
      .send({ poste: validPoste, forcas: [validForca] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("geometry error");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /poste/select
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /poste/select", () => {
  const catalog = [
    {
      modelo: "P1000",
      alturaM: 10,
      diametroTopoMm: 120,
      diametroBaseMm: 250,
      rupturaKnM: 600,
    },
  ];

  it("returns 200 with selected pole", async () => {
    selecionarPosteMock.mockReturnValue({ modelo: "P1000", adequado: true });
    const res = await request(app)
      .post("/poste/select")
      .send({ momentoFletorDaN_m: 500, catalogo: catalog });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.modelo).toBe("P1000");
  });

  it("returns 400 on missing momentoFletorDaN_m", async () => {
    const res = await request(app)
      .post("/poste/select")
      .send({ catalogo: catalog });
    expect(res.status).toBe(400);
  });

  it("returns 400 on empty catalog", async () => {
    const res = await request(app)
      .post("/poste/select")
      .send({ momentoFletorDaN_m: 500, catalogo: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when selection throws", async () => {
    selecionarPosteMock.mockImplementation(() => {
      throw new Error("no suitable pole");
    });
    const res = await request(app)
      .post("/poste/select")
      .send({ momentoFletorDaN_m: 500, catalogo: catalog });
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /conductor/forces
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /conductor/forces", () => {
  const validBody = {
    condutor: {
      codigo: "CA 3/0",
      vaoM: 33,
      diametroExternoM: 0.012,
      alturaInstalacaoM: 8,
    },
    vento: { velocidadeMs: 20, coeficienteArrasto: 1.2 },
  };

  it("returns 200 with force calculation", async () => {
    calculateForceVentoMock.mockReturnValue({
      componenteFxN: 100,
      componenteFyN: 50,
    });
    calculateResultantForceMock.mockReturnValue({ resultante: 111 });
    const res = await request(app).post("/conductor/forces").send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.forcas.componenteFxN).toBe(100);
  });

  it("returns 400 on missing condutor", async () => {
    const res = await request(app)
      .post("/conductor/forces")
      .send({ vento: validBody.vento });
    expect(res.status).toBe(400);
  });

  it("returns 400 when calculation throws", async () => {
    calculateForceVentoMock.mockImplementation(() => {
      throw new Error("invalid vano");
    });
    const res = await request(app).post("/conductor/forces").send(validBody);
    expect(res.status).toBe(400);
  });

  it("uses default alturaInstalacaoM of 8 when not provided", async () => {
    calculateForceVentoMock.mockReturnValue({
      componenteFxN: 100,
      componenteFyN: 50,
    });
    calculateResultantForceMock.mockReturnValue({ resultante: 100 });
    const bodyWithoutAltura = {
      condutor: { codigo: "CA 3/0", vaoM: 33, diametroExternoM: 0.012 },
      vento: { velocidadeMs: 20, coeficienteArrasto: 1.2 },
    };
    const res = await request(app)
      .post("/conductor/forces")
      .send(bodyWithoutAltura);
    expect(res.status).toBe(200);
    // calculateResultantForce should have been called with third arg = 8
    expect(calculateResultantForceMock.mock.calls[0][2]).toBe(8);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /analyze
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /analyze", () => {
  const validScenario = {
    cenarioId: "ATUAL",
    trafoKva: 225,
    resultadosEsq: {
      lado: "ESQUERDO",
      cargaTotalKva: 95,
      cqtPercent: 3.5,
      momentoFletorDaN_m: 50,
    },
    resultadosDir: {
      lado: "DIREITO",
      cargaTotalKva: 92,
      cqtPercent: 3.2,
      momentoFletorDaN_m: 48,
    },
  };

  it("returns 200 with ranking", async () => {
    rankScenariosMock.mockReturnValue([
      { cenarioId: "ATUAL", scoreGlobal: 85 },
    ]);
    const res = await request(app)
      .post("/analyze")
      .send({ scenarios: [validScenario] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ranking[0].cenarioId).toBe("ATUAL");
    expect(res.body.data.recomendacaoPrincipal).toContain("ATUAL");
  });

  it("handles empty ranking gracefully", async () => {
    rankScenariosMock.mockReturnValue([]);
    const res = await request(app)
      .post("/analyze")
      .send({ scenarios: [validScenario] });
    expect(res.status).toBe(200);
    expect(res.body.data.recomendacaoPrincipal).toContain("Nenhum");
  });

  it("returns 400 on missing scenarios", async () => {
    const res = await request(app).post("/analyze").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when ranking throws", async () => {
    rankScenariosMock.mockImplementation(() => {
      throw new Error("calc error");
    });
    const res = await request(app)
      .post("/analyze")
      .send({ scenarios: [validScenario] });
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /catalog/postes
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /catalog/postes", () => {
  it("returns 200 with list of postes", async () => {
    const res = await request(app).get("/catalog/postes");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("filters by materialTipo", async () => {
    const res = await request(app).get("/catalog/postes?materialTipo=CONCRETO");
    expect(res.status).toBe(200);
    expect(res.body.data.every((p: any) => p.materialTipo === "CONCRETO")).toBe(
      true,
    );
  });

  it("filters by search term", async () => {
    const res = await request(app).get("/catalog/postes?search=9/300");
    expect(res.status).toBe(200);
    // Just verify it doesn't crash
  });

  it("returns 400 for invalid limit", async () => {
    const res = await request(app).get("/catalog/postes?limit=99999");
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /catalog/condutores
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /catalog/condutores", () => {
  it("returns 200 with conductors list", async () => {
    const res = await request(app).get("/catalog/condutores");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("filters conductors by search", async () => {
    const res = await request(app).get("/catalog/condutores?search=70");
    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /catalog/vento-coeficientes
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /catalog/vento-coeficientes", () => {
  it("returns 200 with wind coefficient table", async () => {
    const res = await request(app).get("/catalog/vento-coeficientes");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(6);
  });

  it("filters by search term", async () => {
    const res = await request(app).get(
      "/catalog/vento-coeficientes?search=PRIMARIO",
    );
    expect(res.status).toBe(200);
    expect(res.body.data.every((c: any) => c.tipo.includes("PRIMARIO"))).toBe(
      true,
    );
  });

  it("returns 400 for invalid limit", async () => {
    const res = await request(app).get("/catalog/vento-coeficientes?limit=0");
    expect(res.status).toBe(400);
  });
});
