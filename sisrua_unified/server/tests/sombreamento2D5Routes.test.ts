/**
 * Testes T2-61 — Análise de Sombreamento 2.5D
 */

import request from "supertest";
import app from "../app.js";
import { Sombreamento2D5Service } from "../services/sombreamento2D5Service.js";

const BASE_ANALISE = {
  tenantId: "ten-01",
  projetoId: "proj-01",
  nomeAtivo: "Painel Solar A1",
  tipoAtivo: "painel_solar",
  coordenadas: { lat: -23.55, lon: -46.63 },
  alturaAtivo: 3.5,
  alturaObstrucao: 8.0,
  distanciaObstrucaoM: 12,
  orientacaoGraus: 180,
  dataAnalise: "2024-07-15",
};

beforeEach(() => Sombreamento2D5Service._reset());

describe("POST /api/sombreamento-2d5/analises", () => {
  it("deve criar análise com id e status pendente", async () => {
    const res = await request(app)
      .post("/api/sombreamento-2d5/analises")
      .send(BASE_ANALISE);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("sa-1");
    expect(res.body.status).toBe("pendente");
  });

  it("deve retornar 400 para payload inválido", async () => {
    const res = await request(app)
      .post("/api/sombreamento-2d5/analises")
      .send({ tenantId: "x" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sombreamento-2d5/analises", () => {
  it("deve listar análises", async () => {
    await request(app).post("/api/sombreamento-2d5/analises").send(BASE_ANALISE);
    const res = await request(app).get("/api/sombreamento-2d5/analises");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("deve filtrar por tenantId", async () => {
    await request(app).post("/api/sombreamento-2d5/analises").send(BASE_ANALISE);
    await request(app)
      .post("/api/sombreamento-2d5/analises")
      .send({ ...BASE_ANALISE, tenantId: "ten-02" });
    const res = await request(app).get(
      "/api/sombreamento-2d5/analises?tenantId=ten-01",
    );
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/sombreamento-2d5/analises/:id", () => {
  it("deve retornar 404 para id inexistente", async () => {
    const res = await request(app).get("/api/sombreamento-2d5/analises/sa-999");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sombreamento-2d5/analises/:id/calcular", () => {
  it("deve calcular sombreamento com perfil de 24 horas", async () => {
    await request(app).post("/api/sombreamento-2d5/analises").send(BASE_ANALISE);
    const res = await request(app).post(
      "/api/sombreamento-2d5/analises/sa-1/calcular",
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("calculado");
    expect(res.body.resultado).toBeDefined();
    expect(res.body.resultado.perfisHorarios).toHaveLength(24);
    expect(res.body.resultado.hashCalculo).toMatch(/^[a-f0-9]{64}$/);
  });

  it("deve classificar nível de impacto válido", async () => {
    await request(app).post("/api/sombreamento-2d5/analises").send(BASE_ANALISE);
    const res = await request(app).post(
      "/api/sombreamento-2d5/analises/sa-1/calcular",
    );
    expect(res.body.resultado.nivelImpacto).toMatch(
      /^(minimo|baixo|moderado|alto|critico)$/,
    );
  });
});

describe("POST /api/sombreamento-2d5/analises/:id/aprovar", () => {
  it("deve aprovar análise calculada", async () => {
    await request(app).post("/api/sombreamento-2d5/analises").send(BASE_ANALISE);
    await request(app).post("/api/sombreamento-2d5/analises/sa-1/calcular");
    const res = await request(app).post(
      "/api/sombreamento-2d5/analises/sa-1/aprovar",
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
  });

  it("deve retornar 422 se não estiver calculada", async () => {
    await request(app).post("/api/sombreamento-2d5/analises").send(BASE_ANALISE);
    const res = await request(app).post(
      "/api/sombreamento-2d5/analises/sa-1/aprovar",
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /api/sombreamento-2d5/tipos-ativo", () => {
  it("deve listar tipos incluindo painel_solar", async () => {
    const res = await request(app).get("/api/sombreamento-2d5/tipos-ativo");
    expect(res.status).toBe(200);
    expect(res.body).toContain("painel_solar");
  });
});
