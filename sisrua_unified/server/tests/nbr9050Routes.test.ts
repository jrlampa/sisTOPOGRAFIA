/**
 * Testes T2-60 — Verificação NBR 9050 Automática
 */

import request from "supertest";
import app from "../app.js";
import { Nbr9050Service } from "../services/nbr9050Service.js";

const BASE_ANALISE = {
  tenantId: "ten-01",
  projetoId: "proj-01",
  logradouro: "Rua das Palmeiras, 100",
  municipio: "São Paulo",
  uf: "SP",
  analistaTecnico: "Eng. Souza",
  dataAnalise: "2024-06-01",
};

beforeEach(() => Nbr9050Service._reset());

describe("POST /api/nbr-9050/analises", () => {
  it("deve criar análise com id e status pendente", async () => {
    const res = await request(app)
      .post("/api/nbr-9050/analises")
      .send(BASE_ANALISE);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("nb-1");
    expect(res.body.status).toBe("pendente");
  });

  it("deve retornar 400 se dados inválidos", async () => {
    const res = await request(app)
      .post("/api/nbr-9050/analises")
      .send({ tenantId: "a" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/nbr-9050/analises", () => {
  it("deve retornar lista vazia", async () => {
    const res = await request(app).get("/api/nbr-9050/analises");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("deve filtrar por tenantId", async () => {
    await request(app).post("/api/nbr-9050/analises").send(BASE_ANALISE);
    await request(app)
      .post("/api/nbr-9050/analises")
      .send({ ...BASE_ANALISE, tenantId: "ten-02" });
    const res = await request(app).get("/api/nbr-9050/analises?tenantId=ten-01");
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/nbr-9050/analises/:id", () => {
  it("deve retornar 404 para análise inexistente", async () => {
    const res = await request(app).get("/api/nbr-9050/analises/nb-999");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/nbr-9050/analises/:id/itens", () => {
  it("deve registrar item e retornar criterio e resultado", async () => {
    await request(app).post("/api/nbr-9050/analises").send(BASE_ANALISE);
    const res = await request(app)
      .post("/api/nbr-9050/analises/nb-1/itens")
      .send({
        criterio: "largura_calcada_minima",
        resultado: "conforme",
        valorMedido: 2.0,
      });
    expect(res.status).toBe(201);
    expect(res.body.criterio).toBe("largura_calcada_minima");
    expect(res.body.resultado).toBe("conforme");
    expect(res.body.limiteNorma).toBeDefined();
  });
});

describe("POST /api/nbr-9050/analises/:id/processar", () => {
  it("deve processar análise com score e hash", async () => {
    await request(app).post("/api/nbr-9050/analises").send(BASE_ANALISE);
    await request(app).post("/api/nbr-9050/analises/nb-1/itens").send({
      criterio: "largura_calcada_minima",
      resultado: "conforme",
    });
    const res = await request(app)
      .post("/api/nbr-9050/analises/nb-1/processar")
      .send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.scoreConformidade).toBe("number");
    expect(res.body.hashAnalise).toMatch(/^[a-f0-9]{64}$/);
  });

  it("score ≥ 80 → status aprovado", async () => {
    await request(app).post("/api/nbr-9050/analises").send(BASE_ANALISE);
    for (const criterio of [
      "largura_calcada_minima",
      "rampa_acesso_deficiente",
      "piso_tatil_direcional",
      "piso_tatil_atencao",
      "travessia_pedestre",
      "sinalizacao_visual",
      "sinalizacao_sonora",
      "mobiliario_zona_livre",
      "inclinacao_transversal",
    ]) {
      await request(app)
        .post("/api/nbr-9050/analises/nb-1/itens")
        .send({ criterio, resultado: "conforme" });
    }
    const res = await request(app)
      .post("/api/nbr-9050/analises/nb-1/processar")
      .send({});
    expect(res.body.scoreConformidade).toBeGreaterThanOrEqual(80);
    expect(res.body.status).toBe("aprovado");
  });

  it("score < 80 → status reprovado", async () => {
    await request(app).post("/api/nbr-9050/analises").send(BASE_ANALISE);
    for (const criterio of [
      "largura_calcada_minima",
      "rampa_acesso_deficiente",
      "piso_tatil_direcional",
    ]) {
      await request(app)
        .post("/api/nbr-9050/analises/nb-1/itens")
        .send({ criterio, resultado: "nao_conforme" });
    }
    const res = await request(app)
      .post("/api/nbr-9050/analises/nb-1/processar")
      .send({});
    expect(res.body.status).toBe("reprovado");
  });

  it("deve retornar 422 sem itens", async () => {
    await request(app).post("/api/nbr-9050/analises").send(BASE_ANALISE);
    const res = await request(app)
      .post("/api/nbr-9050/analises/nb-1/processar")
      .send({});
    expect(res.status).toBe(422);
  });
});

describe("GET /api/nbr-9050/criterios", () => {
  it("deve retornar lista com largura_calcada_minima", async () => {
    const res = await request(app).get("/api/nbr-9050/criterios");
    expect(res.status).toBe(200);
    const criterios = res.body as Array<{ criterio: string }>;
    expect(criterios.some((c) => c.criterio === "largura_calcada_minima")).toBe(
      true,
    );
  });
});
