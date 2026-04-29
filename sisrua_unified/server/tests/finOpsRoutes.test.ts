import { vi } from "vitest";
/**
 * finOpsRoutes.test.ts — Testes de integração das rotas FinOps (Item 130 [T1]).
 */
import express from "express";
import request from "supertest";
import { _resetFinOps } from "../services/finOpsService.js";

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const TOKEN = "finops-token-test";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  vi.resetModules();
  vi.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: finOpsRoutes } = await import("../routes/finOpsRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/finops", finOpsRoutes);
  return app;
}

beforeEach(() => _resetFinOps());
afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

const validCusto = {
  ambiente: "producao",
  categoria: "api_externa",
  valorUsd: 25.5,
  descricao: "Chamada para API de georreferenciamento",
};

// ─── GET /api/finops/resumo ────────────────────────────────────────────────

describe("GET /api/finops/resumo", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/finops/resumo");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/finops/);
  });

  it("retorna resumo inicial zerado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/finops/resumo").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.totalRegistros).toBe(0);
    expect(res.body.totalUsd).toBe(0);
  });

  it("não exige token quando METRICS_TOKEN não configurado", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/finops/resumo");
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/finops/custos ──────────────────────────────────────────────

describe("POST /api/finops/custos", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).post("/api/finops/custos").send(validCusto);
    expect(res.status).toBe(401);
  });

  it("retorna 400 com ambiente inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/finops/custos")
      .set("Authorization", AUTH)
      .send({ ...validCusto, ambiente: "staging" });
    expect(res.status).toBe(400);
    expect(res.body.detalhes).toBeDefined();
  });

  it("retorna 400 com valorUsd negativo", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/finops/custos")
      .set("Authorization", AUTH)
      .send({ ...validCusto, valorUsd: -5 });
    expect(res.status).toBe(400);
  });

  it("registra custo e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/finops/custos")
      .set("Authorization", AUTH)
      .send(validCusto);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.ambiente).toBe("producao");
    expect(res.body.valorUsd).toBe(25.5);
    expect(res.body.registradoEm).toBeDefined();
  });

  it("registra custo com tenantId opcional", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/finops/custos")
      .set("Authorization", AUTH)
      .send({ ...validCusto, tenantId: "empresa-abc" });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe("empresa-abc");
  });
});

// ─── GET /api/finops/consumo ──────────────────────────────────────────────

describe("GET /api/finops/consumo", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/finops/consumo?ano=2024&mes=6");
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem parâmetros ano/mes", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/finops/consumo").set("Authorization", AUTH);
    expect(res.status).toBe(400);
  });

  it("retorna consumo mensal", async () => {
    const now = new Date();
    const app = await buildApp(TOKEN);
    await request(app).post("/api/finops/custos").set("Authorization", AUTH).send(validCusto);
    const res = await request(app)
      .get(`/api/finops/consumo?ano=${now.getFullYear()}&mes=${now.getMonth() + 1}`)
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.ano).toBe(now.getFullYear());
    expect(res.body.mes).toBe(now.getMonth() + 1);
    expect(res.body.consumo.producao).toBeCloseTo(25.5);
  });
});

// ─── PUT /api/finops/orcamento ────────────────────────────────────────────

describe("PUT /api/finops/orcamento", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).put("/api/finops/orcamento").send({ ambiente: "dev", limiteMensalUsd: 100, alertaPct: 80 });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/finops/orcamento")
      .set("Authorization", AUTH)
      .send({ ambiente: "dev" });
    expect(res.status).toBe(400);
  });

  it("define orçamento e retorna sucesso", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/finops/orcamento")
      .set("Authorization", AUTH)
      .send({ ambiente: "dev", limiteMensalUsd: 500, alertaPct: 75 });
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.orcamento.ambiente).toBe("dev");
    expect(res.body.orcamento.limiteMensalUsd).toBe(500);
  });
});

// ─── GET /api/finops/alertas ──────────────────────────────────────────────

describe("GET /api/finops/alertas", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/finops/alertas?ano=2024&mes=6");
    expect(res.status).toBe(401);
  });

  it("retorna 400 sem parâmetros", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/finops/alertas").set("Authorization", AUTH);
    expect(res.status).toBe(400);
  });

  it("retorna alertas com campo emAlerta", async () => {
    const now = new Date();
    const app = await buildApp(TOKEN);
    await request(app).put("/api/finops/orcamento").set("Authorization", AUTH).send({ ambiente: "producao", limiteMensalUsd: 30, alertaPct: 80 });
    await request(app).post("/api/finops/custos").set("Authorization", AUTH).send({ ...validCusto, valorUsd: 25 });
    const res = await request(app)
      .get(`/api/finops/alertas?ano=${now.getFullYear()}&mes=${now.getMonth() + 1}`)
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alertas)).toBe(true);
    const prodAlerta = res.body.alertas.find((a: any) => a.ambiente === "producao");
    expect(prodAlerta).toBeDefined();
    expect(typeof prodAlerta.emAlerta).toBe("boolean");
  });
});

