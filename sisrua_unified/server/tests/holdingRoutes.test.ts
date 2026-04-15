/**
 * holdingRoutes.test.ts — Testes de integração das rotas de holdings (Item 129 [T1]).
 */
import express from "express";
import request from "supertest";
import { _resetHoldings } from "../services/holdingService.js";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const TOKEN = "holding-token-test";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();
  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: holdingRoutes } = await import("../routes/holdingRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/holdings", holdingRoutes);
  return app;
}

beforeEach(() => _resetHoldings());
afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

// ─── GET /api/holdings ─────────────────────────────────────────────────────

describe("GET /api/holdings", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/holdings/");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/holdings/);
  });

  it("retorna lista vazia inicialmente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/holdings/").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.holdings).toEqual([]);
  });

  it("não exige token quando METRICS_TOKEN não configurado", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/holdings/");
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/holdings ────────────────────────────────────────────────────

describe("POST /api/holdings", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).post("/api/holdings/").send({ nome: "Corp", slug: "corp" });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com slug inválido (caracteres não permitidos)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/holdings/")
      .set("Authorization", AUTH)
      .send({ nome: "Corp", slug: "Corp_Invalid!" });
    expect(res.status).toBe(400);
    expect(res.body.detalhes).toBeDefined();
  });

  it("retorna 400 com corpo faltando nome", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/holdings/")
      .set("Authorization", AUTH)
      .send({ slug: "corp" });
    expect(res.status).toBe(400);
  });

  it("cria holding e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/holdings/")
      .set("Authorization", AUTH)
      .send({ nome: "Grupo Teste", slug: "grupo-teste" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.nome).toBe("Grupo Teste");
    expect(res.body.slug).toBe("grupo-teste");
    expect(res.body.ativa).toBe(true);
  });
});

// ─── POST /api/holdings/:holdingId/tenants ────────────────────────────────

describe("POST /api/holdings/:holdingId/tenants", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).post("/api/holdings/h-123/tenants").send({ tenantId: "t-1", papel: "principal" });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com papel inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/holdings/h-123/tenants")
      .set("Authorization", AUTH)
      .send({ tenantId: "t-1", papel: "dono" });
    expect(res.status).toBe(400);
  });

  it("associa tenant e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const hRes = await request(app).post("/api/holdings/").set("Authorization", AUTH).send({ nome: "Corp", slug: "corp" });
    const holdingId = hRes.body.id;
    const res = await request(app)
      .post(`/api/holdings/${holdingId}/tenants`)
      .set("Authorization", AUTH)
      .send({ tenantId: "tenant-x", papel: "subsidiaria" });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe("tenant-x");
    expect(res.body.holdingId).toBe(holdingId);
    expect(res.body.papel).toBe("subsidiaria");
  });
});

// ─── GET /api/holdings/:holdingId/tenants ────────────────────────────────

describe("GET /api/holdings/:holdingId/tenants", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/holdings/h-123/tenants");
    expect(res.status).toBe(401);
  });

  it("retorna tenants da holding", async () => {
    const app = await buildApp(TOKEN);
    const hRes = await request(app).post("/api/holdings/").set("Authorization", AUTH).send({ nome: "Corp2", slug: "corp2" });
    const holdingId = hRes.body.id;
    await request(app).post(`/api/holdings/${holdingId}/tenants`).set("Authorization", AUTH).send({ tenantId: "ta", papel: "principal" });
    const res = await request(app).get(`/api/holdings/${holdingId}/tenants`).set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.tenants[0].tenantId).toBe("ta");
  });
});

// ─── GET /api/holdings/:holdingId/auditoria ──────────────────────────────

describe("GET /api/holdings/:holdingId/auditoria", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/holdings/h-123/auditoria");
    expect(res.status).toBe(401);
  });

  it("retorna auditoria com totalTenants", async () => {
    const app = await buildApp(TOKEN);
    const hRes = await request(app).post("/api/holdings/").set("Authorization", AUTH).send({ nome: "GrupoAudit", slug: "grupo-audit" });
    const holdingId = hRes.body.id;
    await request(app).post(`/api/holdings/${holdingId}/tenants`).set("Authorization", AUTH).send({ tenantId: "t1", papel: "principal" });
    await request(app).post(`/api/holdings/${holdingId}/tenants`).set("Authorization", AUTH).send({ tenantId: "t2", papel: "empreiteira" });
    const res = await request(app).get(`/api/holdings/${holdingId}/auditoria`).set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.holdingId).toBe(holdingId);
    expect(res.body.totalTenants).toBe(2);
    expect(res.body.tenants).toContain("t1");
  });
});
