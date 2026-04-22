/**
 * Testes T2-59 — Motor Least-Cost Path (LCP)
 */

import request from "supertest";
import app from "../app.js";
import { LcpService } from "../services/lcpService.js";

const BASE_SEGMENTOS = [
  { tipoTerritorio: "urbano", comprimentoM: 500 },
  { tipoTerritorio: "rural", comprimentoM: 1200 },
];

const BASE_PROJETO = {
  tenantId: "ten-01",
  projetoId: "proj-01",
  nomeProjeto: "Projeto Fibra Norte",
  pontoOrigem: { lat: -23.55, lon: -46.63 },
  pontoDestino: { lat: -23.56, lon: -46.62 },
  segmentosEntrada: BASE_SEGMENTOS,
};

beforeEach(() => LcpService._reset());

describe("POST /api/lcp/projetos", () => {
  it("deve criar projeto com id e status rascunho", async () => {
    const res = await request(app).post("/api/lcp/projetos").send(BASE_PROJETO);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("lcp-1");
    expect(res.body.status).toBe("rascunho");
    expect(res.body.nomeProjeto).toBe("Projeto Fibra Norte");
  });

  it("deve retornar 400 se dados inválidos", async () => {
    const res = await request(app).post("/api/lcp/projetos").send({ tenantId: "a" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/lcp/projetos", () => {
  it("deve retornar lista vazia", async () => {
    const res = await request(app).get("/api/lcp/projetos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("deve filtrar por tenantId", async () => {
    await request(app).post("/api/lcp/projetos").send(BASE_PROJETO);
    await request(app).post("/api/lcp/projetos").send({ ...BASE_PROJETO, tenantId: "ten-02" });
    const res = await request(app).get("/api/lcp/projetos?tenantId=ten-01");
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/lcp/projetos/:id", () => {
  it("deve retornar 404 para projeto inexistente", async () => {
    const res = await request(app).get("/api/lcp/projetos/lcp-999");
    expect(res.status).toBe(404);
  });

  it("deve retornar projeto existente", async () => {
    await request(app).post("/api/lcp/projetos").send(BASE_PROJETO);
    const res = await request(app).get("/api/lcp/projetos/lcp-1");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("lcp-1");
  });
});

describe("POST /api/lcp/projetos/:id/calcular", () => {
  it("deve calcular traçado e retornar resultado completo", async () => {
    await request(app).post("/api/lcp/projetos").send(BASE_PROJETO);
    const res = await request(app).post("/api/lcp/projetos/lcp-1/calcular");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("calculado");
    expect(res.body.resultado).toBeDefined();
    expect(res.body.resultado.custoEstimadoBRL).toBeGreaterThan(0);
    expect(res.body.resultado.nivelDificuldade).toMatch(/^(baixo|medio|alto|critico)$/);
    expect(res.body.resultado.hashCalculo).toMatch(/^[a-f0-9]{64}$/);
  });

  it("deve retornar 422 se já aprovado", async () => {
    await request(app).post("/api/lcp/projetos").send(BASE_PROJETO);
    await request(app).post("/api/lcp/projetos/lcp-1/calcular");
    await request(app).post("/api/lcp/projetos/lcp-1/aprovar").send({ aprovadoPor: "Eng. Silva" });
    const res = await request(app).post("/api/lcp/projetos/lcp-1/calcular");
    expect(res.status).toBe(422);
  });
});

describe("POST /api/lcp/projetos/:id/aprovar", () => {
  it("deve aprovar traçado calculado", async () => {
    await request(app).post("/api/lcp/projetos").send(BASE_PROJETO);
    await request(app).post("/api/lcp/projetos/lcp-1/calcular");
    const res = await request(app).post("/api/lcp/projetos/lcp-1/aprovar").send({ aprovadoPor: "Eng. Costa" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
    expect(res.body.aprovadoPor).toBe("Eng. Costa");
  });

  it("deve retornar 422 se não calculado", async () => {
    await request(app).post("/api/lcp/projetos").send(BASE_PROJETO);
    const res = await request(app).post("/api/lcp/projetos/lcp-1/aprovar").send({ aprovadoPor: "Eng. Costa" });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/lcp/configuracao-padrao", () => {
  it("deve retornar configuração com custoUrbanoPorM", async () => {
    const res = await request(app).get("/api/lcp/configuracao-padrao");
    expect(res.status).toBe(200);
    expect(res.body.custoUrbanoPorM).toBeDefined();
    expect(typeof res.body.custoUrbanoPorM).toBe("number");
  });
});
