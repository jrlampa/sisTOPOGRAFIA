/**
 * dataRetentionRoutes.test.ts — Testes de integração das rotas de retenção de dados (Item 37 [T1]).
 */
import express from "express";
import request from "supertest";
import { clearPolicies } from "../services/dataRetentionService.js";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const TOKEN = "retencao-token-test";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();
  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: dataRetentionRoutes } = await import("../routes/dataRetentionRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/retencao", dataRetentionRoutes);
  return app;
}

beforeEach(() => clearPolicies());
afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

const validPolicy = {
  id: "pol-test-1",
  resourceType: "test_resource",
  maxAgeDays: 30,
  archiveOnExpiry: false,
  enabled: true,
};

// ─── GET /api/retencao/politicas ────────────────────────────────────────────

describe("GET /api/retencao/politicas", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/retencao/politicas");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/retencao/);
  });

  it("retorna lista vazia inicialmente (com token)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/retencao/politicas")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.politicas).toEqual([]);
  });

  it("não exige token quando METRICS_TOKEN não configurado", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/retencao/politicas");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.politicas)).toBe(true);
  });
});

// ─── GET /api/retencao/politicas/:resourceType ────────────────────────────

describe("GET /api/retencao/politicas/:resourceType", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/retencao/politicas/test_resource");
    expect(res.status).toBe(401);
  });

  it("retorna 404 para resourceType desconhecido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/retencao/politicas/nao_existe")
      .set("Authorization", AUTH);
    expect(res.status).toBe(404);
    expect(res.body.erro).toBeDefined();
  });

  it("retorna política após POST", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/retencao/politicas")
      .set("Authorization", AUTH)
      .send(validPolicy);
    const res = await request(app)
      .get("/api/retencao/politicas/test_resource")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe("test_resource");
    expect(res.body.maxAgeDays).toBe(30);
  });
});

// ─── POST /api/retencao/politicas ─────────────────────────────────────────

describe("POST /api/retencao/politicas", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).post("/api/retencao/politicas").send(validPolicy);
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido (campo obrigatório ausente)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/retencao/politicas")
      .set("Authorization", AUTH)
      .send({ id: "pol-1", resourceType: "tipo_x" });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBeDefined();
    expect(res.body.detalhes).toBeDefined();
  });

  it("cria política e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/retencao/politicas")
      .set("Authorization", AUTH)
      .send(validPolicy);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("pol-test-1");
    expect(res.body.resourceType).toBe("test_resource");
    expect(res.body.maxAgeDays).toBe(30);
    expect(res.body.archiveOnExpiry).toBe(false);
    expect(res.body.enabled).toBe(true);
  });

  it("cria política com campo maxCount", async () => {
    const app = await buildApp(TOKEN);
    const policyWithCount = { ...validPolicy, id: "pol-count", resourceType: "resource_count", maxCount: 50 };
    const res = await request(app)
      .post("/api/retencao/politicas")
      .set("Authorization", AUTH)
      .send(policyWithCount);
    expect(res.status).toBe(201);
    expect(res.body.maxCount).toBe(50);
  });

  it("GET /politicas após criar múltiplas políticas retorna todas", async () => {
    const app = await buildApp(TOKEN);
    const p2 = { id: "pol-2", resourceType: "resource_2", maxAgeDays: 60, archiveOnExpiry: true, enabled: true };
    await request(app).post("/api/retencao/politicas").set("Authorization", AUTH).send(validPolicy);
    await request(app).post("/api/retencao/politicas").set("Authorization", AUTH).send(p2);
    const res = await request(app).get("/api/retencao/politicas").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.politicas.length).toBe(2);
  });
});

// ─── POST /api/retencao/avaliar ───────────────────────────────────────────

describe("POST /api/retencao/avaliar", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/retencao/avaliar")
      .send({ resourceType: "test_resource", items: [{ id: "i1", createdAt: new Date().toISOString() }] });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido (items vazio)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/retencao/avaliar")
      .set("Authorization", AUTH)
      .send({ resourceType: "test_resource", items: [] });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBeDefined();
  });

  it("retorna resultado para política conhecida", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/retencao/politicas")
      .set("Authorization", AUTH)
      .send({ id: "pol-eval", resourceType: "eval_resource", maxAgeDays: 30, archiveOnExpiry: false, enabled: true });

    const now = new Date();
    const recent = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post("/api/retencao/avaliar")
      .set("Authorization", AUTH)
      .send({
        resourceType: "eval_resource",
        items: [
          { id: "item-recent", createdAt: recent },
          { id: "item-old", createdAt: old },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe("eval_resource");
    expect(res.body.toKeep).toContain("item-recent");
    expect(res.body.toDelete).toContain("item-old");
  });

  it("retorna todos em toKeep para política desabilitada", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/retencao/politicas")
      .set("Authorization", AUTH)
      .send({ id: "pol-disabled", resourceType: "disabled_resource", maxAgeDays: 1, archiveOnExpiry: false, enabled: false });

    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/retencao/avaliar")
      .set("Authorization", AUTH)
      .send({
        resourceType: "disabled_resource",
        items: [{ id: "item-x", createdAt: old }],
      });
    expect(res.status).toBe(200);
    expect(res.body.toKeep).toContain("item-x");
    expect(res.body.toDelete).toHaveLength(0);
  });

  it("com archiveOnExpiry=true, itens antigos vão para toArchive", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/retencao/politicas")
      .set("Authorization", AUTH)
      .send({ id: "pol-archive", resourceType: "archive_resource", maxAgeDays: 10, archiveOnExpiry: true, enabled: true });

    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/retencao/avaliar")
      .set("Authorization", AUTH)
      .send({
        resourceType: "archive_resource",
        items: [{ id: "item-archive", createdAt: old }],
      });
    expect(res.status).toBe(200);
    expect(res.body.toArchive).toContain("item-archive");
    expect(res.body.toDelete).toHaveLength(0);
  });
});
