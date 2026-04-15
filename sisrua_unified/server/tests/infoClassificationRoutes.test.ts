/**
 * infoClassificationRoutes.test.ts — Testes de integração das rotas de classificação (Item 128 [T1]).
 */
import express from "express";
import request from "supertest";
import { _resetClassificacoes } from "../services/infoClassificationService.js";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const TOKEN = "classificacao-token-test";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();
  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: infoClassificationRoutes } = await import("../routes/infoClassificationRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/classificacao", infoClassificationRoutes);
  return app;
}

beforeEach(() => _resetClassificacoes());
afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

const validClassificar = {
  recursoId: "doc-001",
  recursoTipo: "documento",
  nivel: "confidencial",
  justificativa: "Contém dados pessoais",
  classificadoPor: "admin",
};

// ─── GET /api/classificacao/resumo ─────────────────────────────────────────

describe("GET /api/classificacao/resumo", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/classificacao/resumo");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/classificacao/);
  });

  it("retorna resumo com zeros inicialmente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/classificacao/resumo").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.publico).toBe(0);
    expect(res.body.interno).toBe(0);
    expect(res.body.confidencial).toBe(0);
    expect(res.body.restrito).toBe(0);
  });

  it("não exige token quando METRICS_TOKEN não configurado", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/classificacao/resumo");
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/classificacao/recursos/:recursoId ────────────────────────────

describe("GET /api/classificacao/recursos/:recursoId", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/classificacao/recursos/doc-001");
    expect(res.status).toBe(401);
  });

  it("retorna 404 para recurso não classificado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/classificacao/recursos/nao-existe").set("Authorization", AUTH);
    expect(res.status).toBe(404);
    expect(res.body.erro).toBeDefined();
  });

  it("retorna classificação após POST", async () => {
    const app = await buildApp(TOKEN);
    await request(app).post("/api/classificacao/recursos").set("Authorization", AUTH).send(validClassificar);
    const res = await request(app).get("/api/classificacao/recursos/doc-001").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.recursoId).toBe("doc-001");
    expect(res.body.nivel).toBe("confidencial");
  });
});

// ─── POST /api/classificacao/recursos ─────────────────────────────────────

describe("POST /api/classificacao/recursos", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).post("/api/classificacao/recursos").send(validClassificar);
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/classificacao/recursos")
      .set("Authorization", AUTH)
      .send({ recursoId: "r1" });
    expect(res.status).toBe(400);
    expect(res.body.detalhes).toBeDefined();
  });

  it("retorna 400 com nível inválido via Zod", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/classificacao/recursos")
      .set("Authorization", AUTH)
      .send({ ...validClassificar, nivel: "secretissimo" });
    expect(res.status).toBe(400);
  });

  it("classifica recurso e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/classificacao/recursos")
      .set("Authorization", AUTH)
      .send(validClassificar);
    expect(res.status).toBe(201);
    expect(res.body.recursoId).toBe("doc-001");
    expect(res.body.nivel).toBe("confidencial");
    expect(res.body.classificadoEm).toBeDefined();
    expect(res.body.revisaoEm).toBeDefined();
  });
});

// ─── GET /api/classificacao/nivel/:nivel ──────────────────────────────────

describe("GET /api/classificacao/nivel/:nivel", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/classificacao/nivel/interno");
    expect(res.status).toBe(401);
  });

  it("retorna 400 para nível inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/classificacao/nivel/invalido").set("Authorization", AUTH);
    expect(res.status).toBe(400);
    expect(res.body.erro).toBeDefined();
  });

  it("retorna lista vazia para nível sem recursos", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/classificacao/nivel/restrito").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.recursos).toEqual([]);
  });

  it("retorna recursos do nível correto", async () => {
    const app = await buildApp(TOKEN);
    await request(app).post("/api/classificacao/recursos").set("Authorization", AUTH).send(validClassificar);
    await request(app).post("/api/classificacao/recursos").set("Authorization", AUTH).send({ ...validClassificar, recursoId: "doc-002", nivel: "publico" });
    const res = await request(app).get("/api/classificacao/nivel/confidencial").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.nivel).toBe("confidencial");
    expect(res.body.total).toBe(1);
    expect(res.body.recursos[0].recursoId).toBe("doc-001");
  });
});
