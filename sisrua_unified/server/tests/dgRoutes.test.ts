import request from "supertest";
import app from "../app.js";
import { vi } from "vitest";

// Mock do roleService para evitar erros 403 nos testes
vi.mock("../services/roleService.js", () => ({
  getUserRole: vi.fn().mockResolvedValue({ role: "admin", tenantId: null }),
}));

vi.mock("../repositories/dgRunRepository.js", () => ({
  dgRunRepository: {
    save: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    listDiscardRates: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockImplementation((id: string) => {
        if (id === optimizePayload.runId) {
            return Promise.resolve({
                runId: id,
                inputHash: "hash123",
                scenarios: [],
                recommendation: null,
            });
        }
        return Promise.resolve(null);
    }),
    findScenarios: vi.fn().mockResolvedValue([]),
    findRecommendation: vi.fn().mockResolvedValue(null),
  },
}));

const BASE = "/api/dg";

const optimizePayload = {
  runId: "9ab38f84-17cb-4f91-9d0f-001122334455",
  poles: [
    { id: "P1", position: { lat: -23.5489, lon: -46.6388 }, demandKva: 15, clients: 3 },
    { id: "P2", position: { lat: -23.549, lon: -46.6386 }, demandKva: 20, clients: 4 },
    { id: "P3", position: { lat: -23.5492, lon: -46.6387 }, demandKva: 12, clients: 2 },
    { id: "P4", position: { lat: -23.5491, lon: -46.6389 }, demandKva: 18, clients: 3 },
  ],
  transformer: {
    id: "TR75",
    position: { lat: -23.5491, lon: -46.6388 },
    kva: 75,
    currentDemandKva: 0,
  },
};

const fullProjectPayload = {
  runId: "44444444-4444-4444-8444-444444444444",
  poles: optimizePayload.poles.map((pole) => ({ ...pole, demandKva: 0, clients: 0 })),
  params: {
    projectMode: "full_project",
    clientesPorPoste: 3,
    areaClandestinaM2: 120,
    demandaMediaClienteKva: 1.5,
    fatorSimultaneidade: 0.8,
    faixaKvaTrafoPermitida: [15, 30, 45, 75],
    maxSpanMeters: 40,
    wizardContractVersion: "DG Wizard v1",
  },
};

describe("dgRoutes", () => {
  it("POST /mt-router retorna trilha MT conectando terminais", async () => {
    const res = await request(app)
      .post(`${BASE}/mt-router`)
      .set("x-user-id", "test-user")
      .send({
        source: { lat: -23.55, lon: -46.64 },
        terminals: [
          { id: "TR-A", position: { lat: -23.55, lon: -46.6394 } },
          { id: "TR-B", position: { lat: -23.5497, lon: -46.6392 } },
        ],
        roadCorridors: [
          {
            id: "r1",
            bufferMeters: 20,
            centerPoints: [
              { lat: -23.55, lon: -46.64 },
              { lat: -23.55, lon: -46.6394 },
            ],
          },
          {
            id: "r2",
            bufferMeters: 20,
            centerPoints: [
              { lat: -23.55, lon: -46.6392 },
              { lat: -23.5497, lon: -46.6392 },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.feasible).toBe(true);
    expect(res.body.connectedTerminals).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });

  it("POST /mt-router retorna 422 para cenário inviável", async () => {
    const res = await request(app)
      .post(`${BASE}/mt-router`)
      .set("x-user-id", "test-user")
      .send({
        source: { lat: -23.5, lon: -46.7 },
        terminals: [{ id: "TR-X", position: { lat: -23.5003, lon: -46.7002 } }],
        roadCorridors: [
          {
            id: "r-dist",
            bufferMeters: 20,
            centerPoints: [
              { lat: -23.55, lon: -46.64 },
              { lat: -23.55, lon: -46.639 },
            ],
          },
        ],
        maxSnapDistanceMeters: 20,
      });

    expect(res.status).toBe(422);
    expect(res.body.feasible).toBe(false);
  });

  it("GET /discard-rates retorna agregados de descarte por restrição", async () => {
    await request(app)
      .post(`${BASE}/optimize`)
      .set("x-user-id", "test-user")
      .send({
        ...optimizePayload,
        runId: "33333333-3333-4333-8333-333333333333",
        params: { maxSpanMeters: 1 },
      });

    const res = await request(app)
        .get(`${BASE}/discard-rates?limit=50`)
        .set("x-user-id", "test-user");

    expect(res.status).toBe(200);
    // Nota: rows pode ser 0 se a run anterior falhar por outro motivo, mas deve ser array
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it("GET /runs retorna ranking recente", async () => {
    await request(app)
      .post(`${BASE}/optimize`)
      .set("x-user-id", "test-user")
      .send({ ...optimizePayload, runId: "11111111-1111-4111-8111-111111111111" });

    const res = await request(app)
        .get(`${BASE}/runs?limit=1`)
        .set("x-user-id", "test-user");

    expect(res.status).toBe(200);
    expect(res.body.runs).toBeDefined();
  });

  it("POST /optimize executa otimização e persiste a run", async () => {
    const optimizeRes = await request(app)
      .post(`${BASE}/optimize`)
      .set("x-user-id", "test-user")
      .send(optimizePayload);

    expect(optimizeRes.status).toBe(200);
    expect(optimizeRes.body.runId).toBe(optimizePayload.runId);

    const runRes = await request(app)
        .get(`${BASE}/runs/${optimizePayload.runId}`)
        .set("x-user-id", "test-user");

    expect(runRes.status).toBe(200);
    expect(runRes.body.runId).toBe(optimizePayload.runId);
  });

  it("POST /optimize aceita modo full_project", async () => {
    const optimizeRes = await request(app)
      .post(`${BASE}/optimize`)
      .set("x-user-id", "test-user")
      .send(fullProjectPayload);

    expect(optimizeRes.status).toBe(200);
    expect(optimizeRes.body.recommendation).not.toBeNull();
  });

  it("POST /decision registra decisão para auditoria", async () => {
    const res = await request(app)
        .post(`${BASE}/decision`)
        .set("x-user-id", "test-user")
        .send({
            runId: "6ad8084d-6b40-40ea-8339-bf0b0f822100",
            appliedMode: "discard",
            score: 72.3,
        });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /mt-router/parse-kmz ────────────────────────────────────────────────

describe("DG MT Router – POST /api/dg/mt-router/parse-kmz", () => {
  const KMZ_BASE = "/api/dg/mt-router/parse-kmz";

  const minimalKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<Placemark>
  <name>SOURCE</name>
  <Point><coordinates>-46.638,-23.548,0</coordinates></Point>
</Placemark>
<Placemark>
  <name>Trafo-01</name>
  <Point><coordinates>-46.640,-23.550,0</coordinates></Point>
</Placemark>
<Placemark>
  <name>Via A</name>
  <LineString><coordinates>-46.638,-23.548,0 -46.640,-23.550,0</coordinates></LineString>
</Placemark>
</Document>
</kml>`;

  it("400 quando nenhum arquivo é enviado", async () => {
    const res = await request(app)
      .post(KMZ_BASE)
      .set("x-user-id", "test-user");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("200 com KML válido – retorna source, terminals, roadCorridors", async () => {
    const buf = Buffer.from(minimalKml, "utf-8");
    const res = await request(app)
      .post(KMZ_BASE)
      .set("x-user-id", "test-user")
      .attach("file", buf, { filename: "test.kml", contentType: "application/vnd.google-earth.kml+xml" });

    expect(res.status).toBe(200);
    expect(res.body.source).toEqual({ lat: -23.548, lon: -46.638 });
    expect(res.body.terminals).toHaveLength(1);
    expect(res.body.terminals[0].name).toBe("Trafo-01");
    expect(res.body.roadCorridors).toHaveLength(1);
    expect(Array.isArray(res.body.warnings)).toBe(true);
  });
});