import { vi } from "vitest";
/**
 * ibgeAndElevationRoutes.test.ts
 *
 * Testes para:
 * - ibgeRoutes (location, states, municipios, boundary)
 * - elevationRoutes (profile, stats, batch)
 */

import request from "supertest";
import express from "express";

// ─── Mocks ───────────────────────────────────────────────────────────────────
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// IbgeService mock
const mockFindMunicipioByCoordinates = vi.fn();
const mockGetStates = vi.fn();
const mockGetMunicipiosByState = vi.fn();
const mockGetMunicipalityBoundary = vi.fn();
vi.mock("../services/ibgeService", () => ({
  IbgeService: {
    findMunicipioByCoordinates: mockFindMunicipioByCoordinates,
    getStates: mockGetStates,
    getMunicipiosByState: mockGetMunicipiosByState,
    getMunicipalityBoundary: mockGetMunicipalityBoundary,
  },
}));

// ElevationService mock
const mockGetElevationProfile = vi.fn();
const mockGetElevationAt = vi.fn();
const mockGetBatchElevations = vi.fn();
vi.mock("../services/elevationService", () => ({
  ElevationService: {
    getElevationProfile: mockGetElevationProfile,
    getElevationAt: mockGetElevationAt,
    getBatchElevations: mockGetBatchElevations,
  },
}));

// TopodataService mock
const mockIsWithinBrazil = vi.fn().mockReturnValue(true);
const mockGetCacheStats = vi
  .fn()
  .mockReturnValue({ size: 0, hits: 0, misses: 0 });
const mockClearCache = vi.fn();
const mockTopodataGetElevation = vi.fn().mockResolvedValue(760);
vi.mock("../services/topodataService", () => ({
  TopodataService: {
    isWithinBrazil: mockIsWithinBrazil,
    getCacheStats: mockGetCacheStats,
    clearCache: mockClearCache,
    getElevation: mockTopodataGetElevation,
  },
}));

// ─── Apps ─────────────────────────────────────────────────────────────────────
let ibgeApp: express.Application;
let elevationApp: express.Application;

beforeAll(async () => {
  const [ib, el] = await Promise.all([
    import("../routes/ibgeRoutes.js"),
    import("../routes/elevationRoutes.js"),
  ]);

  ibgeApp = express();
  ibgeApp.use(express.json());
  ibgeApp.use("/", ib.default);

  elevationApp = express();
  elevationApp.use(express.json());
  elevationApp.use("/", el.default);
});

// ════════════════════════════════════════════════════════════════════════════
// IBGE ROUTES
// ════════════════════════════════════════════════════════════════════════════

const sampleState = { id: "35", sigla: "SP", nome: "São Paulo" };
const sampleMunicipio = { id: "3550308", nome: "São Paulo" };

describe("ibgeRoutes — location (reverse geocoding)", () => {
  it("GET /location — 400 sem parâmetros", async () => {
    const res = await request(ibgeApp).get("/location");
    expect(res.status).toBe(400);
  });

  it("GET /location — 400 lat/lng inválidos", async () => {
    const res = await request(ibgeApp).get("/location?lat=999&lng=999");
    expect(res.status).toBe(400);
  });

  it("GET /location — 404 quando não encontrado", async () => {
    mockFindMunicipioByCoordinates.mockResolvedValue(null);
    const res = await request(ibgeApp).get("/location?lat=-23.5&lng=-46.6");
    expect(res.status).toBe(404);
  });

  it("GET /location — 200 quando encontrado", async () => {
    mockFindMunicipioByCoordinates.mockResolvedValue({
      ...sampleMunicipio,
      estado: sampleState,
    });
    const res = await request(ibgeApp).get("/location?lat=-23.5&lng=-46.6");
    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("São Paulo");
  });

  it("GET /location — 500 em erro interno", async () => {
    mockFindMunicipioByCoordinates.mockRejectedValue(new Error("API down"));
    const res = await request(ibgeApp).get("/location?lat=-23.5&lng=-46.6");
    expect(res.status).toBe(500);
  });
});

describe("ibgeRoutes — states", () => {
  it("GET /states — retorna lista de estados", async () => {
    mockGetStates.mockResolvedValue([sampleState]);
    const res = await request(ibgeApp).get("/states");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.states)).toBe(true);
    expect(res.body.total).toBeDefined();
  });

  it("GET /states — filtra por search", async () => {
    mockGetStates.mockResolvedValue([
      sampleState,
      { id: "33", sigla: "RJ", nome: "Rio de Janeiro" },
    ]);
    const res = await request(ibgeApp).get("/states?search=paulo");
    expect(res.status).toBe(200);
    expect(res.body.states.length).toBe(1);
    expect(res.body.states[0].sigla).toBe("SP");
  });

  it("GET /states — 500 em erro interno", async () => {
    mockGetStates.mockRejectedValue(new Error("IBGE API down"));
    const res = await request(ibgeApp).get("/states");
    expect(res.status).toBe(500);
  });
});

describe("ibgeRoutes — municipios", () => {
  it("GET /municipios/SP — retorna municipios", async () => {
    mockGetMunicipiosByState.mockResolvedValue([sampleMunicipio]);
    const res = await request(ibgeApp).get("/municipios/SP");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.municipios)).toBe(true);
  });

  it("GET /municipios/x — 400 para UF inválida (1 char)", async () => {
    const res = await request(ibgeApp).get("/municipios/X");
    expect(res.status).toBe(400);
  });

  it("GET /municipios/SP — filtra por search", async () => {
    mockGetMunicipiosByState.mockResolvedValue([
      sampleMunicipio,
      { id: "3501608", nome: "Americana" },
    ]);
    const res = await request(ibgeApp).get("/municipios/SP?search=ameri");
    expect(res.status).toBe(200);
    expect(res.body.municipios.length).toBe(1);
  });

  it("GET /municipios/SP — 500 em erro interno", async () => {
    mockGetMunicipiosByState.mockRejectedValue(new Error("IBGE API down"));
    const res = await request(ibgeApp).get("/municipios/SP");
    expect(res.status).toBe(500);
  });
});

describe("ibgeRoutes — boundary", () => {
  const geojson = { type: "FeatureCollection", features: [] };

  it("GET /boundary/municipio/3550308 — retorna boundary", async () => {
    mockGetMunicipalityBoundary.mockResolvedValue(geojson);
    const res = await request(ibgeApp).get("/boundary/municipio/3550308");
    expect(res.status).toBe(200);
  });

  it("GET /boundary/municipio/nao-numerico — 400", async () => {
    const res = await request(ibgeApp).get("/boundary/municipio/abc");
    expect(res.status).toBe(400);
  });

  it("GET /boundary/municipio/0000000 — 404 quando não encontrado", async () => {
    mockGetMunicipalityBoundary.mockResolvedValue(null);
    const res = await request(ibgeApp).get("/boundary/municipio/0000000");
    expect(res.status).toBe(404);
  });

  it("GET /boundary/municipio/3550308 — 500 em erro", async () => {
    mockGetMunicipalityBoundary.mockRejectedValue(new Error("Error"));
    const res = await request(ibgeApp).get("/boundary/municipio/3550308");
    expect(res.status).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ELEVATION ROUTES
// ════════════════════════════════════════════════════════════════════════════

const startPt = { lat: -23.5, lng: -46.6 };
const endPt = { lat: -23.6, lng: -46.7 };

describe("elevationRoutes — profile", () => {
  const profile = [
    { dist: 0, elev: 760 },
    { dist: 1000, elev: 780 },
  ];

  it("POST /profile — 400 sem body", async () => {
    const res = await request(elevationApp).post("/profile").send({});
    expect(res.status).toBe(400);
  });

  it("POST /profile — 400 lat fora de range", async () => {
    const res = await request(elevationApp)
      .post("/profile")
      .send({ start: { lat: 999, lng: -46.6 }, end: endPt, steps: 5 });
    expect(res.status).toBe(400);
  });

  it("POST /profile — 200 com dados válidos", async () => {
    mockGetElevationProfile.mockResolvedValue(profile);
    const res = await request(elevationApp)
      .post("/profile")
      .send({ start: startPt, end: endPt, steps: 10 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.profile)).toBe(true);
  });

  it("POST /profile — 500 em erro", async () => {
    mockGetElevationProfile.mockRejectedValue(new Error("API down"));
    const res = await request(elevationApp)
      .post("/profile")
      .send({ start: startPt, end: endPt, steps: 10 });
    expect(res.status).toBe(500);
  });
});

describe("elevationRoutes — profile/export", () => {
  const profile = [
    { dist: 0, elev: 760 },
    { dist: 1000, elev: 780 },
  ];

  it("POST /profile/export — 400 sem body", async () => {
    const res = await request(elevationApp).post("/profile/export").send({});
    expect(res.status).toBe(400);
  });

  it("POST /profile/export — retorna CSV quando format=csv", async () => {
    mockGetElevationProfile.mockResolvedValue(profile);
    const res = await request(elevationApp)
      .post("/profile/export")
      .send({ start: startPt, end: endPt, steps: 2, format: "csv" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
  });

  it("POST /profile/export — retorna KML quando format=kml", async () => {
    mockGetElevationProfile.mockResolvedValue(profile);
    const res = await request(elevationApp)
      .post("/profile/export")
      .send({ start: startPt, end: endPt, steps: 2, format: "kml" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("kml");
  });

  it("POST /profile/export — 500 em erro", async () => {
    mockGetElevationProfile.mockRejectedValue(new Error("fail"));
    const res = await request(elevationApp)
      .post("/profile/export")
      .send({ start: startPt, end: endPt, steps: 2, format: "csv" });
    expect(res.status).toBe(500);
  });
});

describe("elevationRoutes — stats", () => {
  it("GET /stats — 400 sem parâmetros", async () => {
    const res = await request(elevationApp).get("/stats");
    expect(res.status).toBe(400);
  });

  it("GET /stats — 400 radius muito grande", async () => {
    const res = await request(elevationApp).get(
      "/stats?lat=-23.5&lng=-46.6&radius=99999",
    );
    expect(res.status).toBe(400);
  });

  it("GET /stats — 200 com dados válidos", async () => {
    mockGetElevationAt.mockResolvedValue(760);
    const res = await request(elevationApp).get(
      "/stats?lat=-23.5&lng=-46.6&radius=500",
    );
    expect(res.status).toBe(200);
    expect(typeof res.body.min_elevation_m).toBe("number");
  });

  it("GET /stats — 500 em erro interno", async () => {
    mockGetElevationAt.mockRejectedValue(new Error("fail"));
    const res = await request(elevationApp).get(
      "/stats?lat=-23.5&lng=-46.6&radius=500",
    );
    expect(res.status).toBe(500);
  });
});

describe("elevationRoutes — batch", () => {
  it("POST /batch — 400 sem body", async () => {
    const res = await request(elevationApp).post("/batch").send({});
    expect(res.status).toBe(400);
  });

  it("POST /batch — 400 array de pontos vazio", async () => {
    const res = await request(elevationApp).post("/batch").send({ points: [] });
    expect(res.status).toBe(400);
  });

  it("POST /batch — 200 com pontos válidos", async () => {
    mockGetElevationAt.mockResolvedValue(760);
    const res = await request(elevationApp)
      .post("/batch")
      .send({
        points: [
          { lat: -23.5, lng: -46.6 },
          { lat: -23.6, lng: -46.7 },
        ],
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body.summary.total).toBe(2);
  });

  it("POST /batch — 500 em erro interno", async () => {
    mockGetElevationAt.mockRejectedValue(new Error("fail"));
    const res = await request(elevationApp)
      .post("/batch")
      .send({ points: [{ lat: -23.5, lng: -46.6 }] });
    expect(res.status).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// elevationRoutes — cache
// ════════════════════════════════════════════════════════════════════════════

describe("elevationRoutes — cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /cache/status — 200 com stats do cache", async () => {
    mockGetCacheStats.mockReturnValue({
      files: 3,
      totalSizeMB: 0.5,
      tiles: ["a.tif"],
    });
    const res = await request(elevationApp).get("/cache/status");
    expect(res.status).toBe(200);
    expect(res.body.files).toBe(3);
    expect(res.body.isBrazilianTerritory).toBe(true);
  });

  it("GET /cache/status — 500 em erro interno", async () => {
    mockGetCacheStats.mockImplementation(() => {
      throw new Error("disk error");
    });
    const res = await request(elevationApp).get("/cache/status");
    expect(res.status).toBe(500);
  });

  it("POST /cache/clear — 200 limpa o cache", async () => {
    mockClearCache.mockReturnValue(undefined);
    const res = await request(elevationApp).post("/cache/clear").send({});
    expect(res.status).toBe(200);
    expect(mockClearCache).toHaveBeenCalled();
  });

  it("POST /cache/clear — 500 em erro interno", async () => {
    mockClearCache.mockImplementationOnce(() => {
      throw new Error("fail");
    });
    const res = await request(elevationApp).post("/cache/clear").send({});
    expect(res.status).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// elevationRoutes — compare
// ════════════════════════════════════════════════════════════════════════════

describe("elevationRoutes — compare", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /compare — 400 sem parâmetros", async () => {
    const res = await request(elevationApp).get("/compare");
    expect(res.status).toBe(400);
  });

  it("GET /compare — 200 com dados válidos", async () => {
    mockTopodataGetElevation.mockResolvedValue(800);
    mockIsWithinBrazil.mockReturnValue(true);
    const res = await request(elevationApp).get("/compare?lat=-23.5&lng=-46.6");
    expect(res.status).toBe(200);
    expect(res.body.location).toBeDefined();
    expect(res.body.topodata).toBeDefined();
  });

  it("GET /compare — 500 em erro interno", async () => {
    mockTopodataGetElevation.mockRejectedValue(new Error("fail"));
    const res = await request(elevationApp).get("/compare?lat=-23.5&lng=-46.6");
    expect(res.status).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// elevationRoutes — stats sem dados
// ════════════════════════════════════════════════════════════════════════════

describe("elevationRoutes — stats sem dados", () => {
  it("GET /stats — 404 quando não há pontos de elevação disponíveis", async () => {
    mockGetElevationAt.mockResolvedValue(null);
    const res = await request(elevationApp).get(
      "/stats?lat=-23.5&lng=-46.6&radius=1000",
    );
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// elevationRoutes — slope
// ════════════════════════════════════════════════════════════════════════════

describe("elevationRoutes — slope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /slope — 400 sem parâmetros", async () => {
    const res = await request(elevationApp).get("/slope");
    expect(res.status).toBe(400);
  });

  it("GET /slope — 200 com dados válidos", async () => {
    mockGetElevationAt.mockResolvedValue(500);
    const res = await request(elevationApp).get(
      "/slope?lat=-23.5&lng=-46.6&radius=500",
    );
    expect(res.status).toBe(200);
    expect(res.body.location).toBeDefined();
    expect(typeof res.body.slope_percentage).toBe("number");
  });

  it("GET /slope — 404 quando dados insuficientes (null)", async () => {
    mockGetElevationAt.mockResolvedValue(null);
    const res = await request(elevationApp).get(
      "/slope?lat=-23.5&lng=-46.6&radius=500",
    );
    expect(res.status).toBe(404);
  });

  it("GET /slope — 500 em erro interno", async () => {
    mockGetElevationAt.mockRejectedValue(new Error("fail"));
    const res = await request(elevationApp).get(
      "/slope?lat=-23.5&lng=-46.6&radius=500",
    );
    expect(res.status).toBe(500);
  });
});

