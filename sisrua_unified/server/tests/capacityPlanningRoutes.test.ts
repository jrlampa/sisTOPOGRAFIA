/**
 * capacityPlanningRoutes.test.ts — Testes de integração das rotas de capacidade (Item 126 [T1]).
 */
import express from "express";
import request from "supertest";
import { _resetCapacity } from "../services/capacityPlanningService.js";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const TOKEN = "capacity-token-test";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();
  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: capacityPlanningRoutes } = await import("../routes/capacityPlanningRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/capacidade", capacityPlanningRoutes);
  return app;
}

beforeEach(() => _resetCapacity());
afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

const validSnapshot = {
  timestamp: new Date().toISOString(),
  jobsConcurrentes: 10,
  latenciaMediaMs: 150,
  memoriaUsadaMb: 512,
  cpuPct: 40,
  saturationScore: 0.4,
};

// ─── GET /api/capacidade/status ───────────────────────────────────────────

describe("GET /api/capacidade/status", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/capacidade/status");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/capacidade/);
  });

  it("retorna status inicial com snapshots=0", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/capacidade/status").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.snapshots).toBe(0);
    expect(res.body.ultima).toBeNull();
    expect(res.body.meta).toBeNull();
  });

  it("não exige token quando METRICS_TOKEN não configurado", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/capacidade/status");
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/capacidade/historico ───────────────────────────────────────

describe("GET /api/capacidade/historico", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/capacidade/historico");
    expect(res.status).toBe(401);
  });

  it("retorna histórico vazio inicialmente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/capacidade/historico").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.historico).toEqual([]);
  });

  it("retorna histórico após registrar snapshots", async () => {
    const app = await buildApp(TOKEN);
    await request(app).post("/api/capacidade/snapshots").set("Authorization", AUTH).send(validSnapshot);
    const res = await request(app).get("/api/capacidade/historico").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.historico).toHaveLength(1);
  });
});

// ─── POST /api/capacidade/snapshots ──────────────────────────────────────

describe("POST /api/capacidade/snapshots", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).post("/api/capacidade/snapshots").send(validSnapshot);
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/capacidade/snapshots")
      .set("Authorization", AUTH)
      .send({ jobsConcurrentes: -1 });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBeDefined();
  });

  it("registra snapshot e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/capacidade/snapshots")
      .set("Authorization", AUTH)
      .send(validSnapshot);
    expect(res.status).toBe(201);
    expect(res.body.jobsConcurrentes).toBe(10);
    expect(res.body.latenciaMediaMs).toBe(150);
    expect(res.body.cpuPct).toBe(40);
  });

  it("retorna 400 quando cpuPct > 100", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/capacidade/snapshots")
      .set("Authorization", AUTH)
      .send({ ...validSnapshot, cpuPct: 110 });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /api/capacidade/meta ────────────────────────────────────────────

describe("PUT /api/capacidade/meta", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).put("/api/capacidade/meta").send({ maxJobsConcurrentes: 100, latenciaAlvoMs: 500 });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/capacidade/meta")
      .set("Authorization", AUTH)
      .send({ maxJobsConcurrentes: -5 });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBeDefined();
  });

  it("define meta e retorna resultado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/capacidade/meta")
      .set("Authorization", AUTH)
      .send({ maxJobsConcurrentes: 100, latenciaAlvoMs: 500 });
    expect(res.status).toBe(200);
    expect(res.body.maxJobsConcurrentes).toBe(100);
    expect(res.body.latenciaAlvoMs).toBe(500);
    expect(typeof res.body.alertaAtivo).toBe("boolean");
    expect(typeof res.body.margemSeguranca).toBe("number");
  });

  it("status reflete meta definida", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/capacidade/meta")
      .set("Authorization", AUTH)
      .send({ maxJobsConcurrentes: 200, latenciaAlvoMs: 1000 });
    const res = await request(app).get("/api/capacidade/status").set("Authorization", AUTH);
    expect(res.body.meta?.maxJobsConcurrentes).toBe(200);
  });
});
