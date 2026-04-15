/**
 * vulnManagementRoutes.test.ts — Testes de integração das rotas de vulnerabilidades (Item 127 [T1]).
 */
import express from "express";
import request from "supertest";
import { _resetVulns } from "../services/vulnManagementService.js";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const TOKEN = "vuln-token-test";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();
  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: vulnManagementRoutes } = await import("../routes/vulnManagementRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/vulns", vulnManagementRoutes);
  return app;
}

beforeEach(() => _resetVulns());
afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

const validVuln = {
  titulo: "SQL Injection no módulo de busca",
  cvssScore: 8.5,
  severidade: "alta",
  status: "aberta",
  fonte: "pentest-2024",
  afetado: "api-busca-v2",
};

// ─── GET /api/vulns ────────────────────────────────────────────────────────

describe("GET /api/vulns", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/vulns/");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/vulns/);
  });

  it("retorna lista vazia inicialmente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/vulns/").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.vulnerabilidades).toEqual([]);
  });

  it("filtra por status via query", async () => {
    const app = await buildApp(TOKEN);
    await request(app).post("/api/vulns/").set("Authorization", AUTH).send(validVuln);
    await request(app).post("/api/vulns/").set("Authorization", AUTH).send({ ...validVuln, status: "resolvida" });
    const res = await request(app).get("/api/vulns/?status=aberta").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.vulnerabilidades.every((v: any) => v.status === "aberta")).toBe(true);
  });

  it("não exige token quando METRICS_TOKEN não configurado", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/vulns/");
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/vulns ───────────────────────────────────────────────────────

describe("POST /api/vulns", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).post("/api/vulns/").send(validVuln);
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/vulns/")
      .set("Authorization", AUTH)
      .send({ titulo: "x" });
    expect(res.status).toBe(400);
    expect(res.body.detalhes).toBeDefined();
  });

  it("registra vulnerabilidade e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/vulns/")
      .set("Authorization", AUTH)
      .send(validVuln);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.titulo).toBe(validVuln.titulo);
    expect(res.body.severidade).toBe("alta");
    expect(res.body.prazoSla).toBeDefined();
    expect(res.body.criadoEm).toBeDefined();
  });

  it("retorna 400 quando cvssScore > 10", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/vulns/")
      .set("Authorization", AUTH)
      .send({ ...validVuln, cvssScore: 11 });
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/vulns/:id/status ──────────────────────────────────────────

describe("PATCH /api/vulns/:id/status", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).patch("/api/vulns/fake-id/status").send({ status: "resolvida" });
    expect(res.status).toBe(401);
  });

  it("retorna 400 com corpo inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .patch("/api/vulns/fake-id/status")
      .set("Authorization", AUTH)
      .send({ status: "invalido" });
    expect(res.status).toBe(400);
  });

  it("retorna 404 para id desconhecido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .patch("/api/vulns/nao-existe/status")
      .set("Authorization", AUTH)
      .send({ status: "resolvida" });
    expect(res.status).toBe(404);
    expect(res.body.erro).toBeDefined();
  });

  it("atualiza status com sucesso", async () => {
    const app = await buildApp(TOKEN);
    const post = await request(app).post("/api/vulns/").set("Authorization", AUTH).send(validVuln);
    const id = post.body.id;
    const res = await request(app)
      .patch(`/api/vulns/${id}/status`)
      .set("Authorization", AUTH)
      .send({ status: "em_tratamento" });
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });
});

// ─── GET /api/vulns/resumo ─────────────────────────────────────────────────

describe("GET /api/vulns/resumo", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/vulns/resumo");
    expect(res.status).toBe(401);
  });

  it("retorna resumo com totais zerados inicialmente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/vulns/resumo").set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.porSeveridade).toBeDefined();
  });

  it("retorna contagens corretas após registrar vulns", async () => {
    const app = await buildApp(TOKEN);
    await request(app).post("/api/vulns/").set("Authorization", AUTH).send({ ...validVuln, severidade: "critica" });
    await request(app).post("/api/vulns/").set("Authorization", AUTH).send({ ...validVuln, severidade: "media" });
    const res = await request(app).get("/api/vulns/resumo").set("Authorization", AUTH);
    expect(res.body.total).toBe(2);
    expect(res.body.porSeveridade.critica).toBe(1);
    expect(res.body.porSeveridade.media).toBe(1);
  });
});
