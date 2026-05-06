/**
 * Testes T2-108 — Verificador NBR 9050 (Calçadas)
 */

import request from "supertest";
import app from "../app.js";
import { NbrCalcadasService } from "../services/nbrCalcadasService.js";

const BASE_REGISTRO = {
  tenantId: "ten-01",
  logradouro: "Av. Paulista, 1000",
  municipio: "São Paulo",
  uf: "SP",
  tipoVia: "coletora",
  larguraTotalM: 4.2,
  faixaServicoM: 0.8,
  faixaLivreM: 1.8,
  faixaAcessoM: 0.8,
  tecnicoResponsavel: "Arq. Lima",
  dataVistoria: "2024-06-20",
};

beforeEach(() => NbrCalcadasService._reset());

describe("POST /api/nbr-calcadas/registros", () => {
  it("deve criar registro com status pendente", async () => {
    const res = await request(app)
      .post("/api/nbr-calcadas/registros")
      .send(BASE_REGISTRO);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("rc-1");
    expect(res.body.status).toBe("pendente");
  });

  it("deve retornar 400 para payload inválido", async () => {
    const res = await request(app)
      .post("/api/nbr-calcadas/registros")
      .send({ tenantId: "x" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/nbr-calcadas/registros", () => {
  it("deve listar registros", async () => {
    await request(app).post("/api/nbr-calcadas/registros").send(BASE_REGISTRO);
    const res = await request(app).get("/api/nbr-calcadas/registros");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("deve filtrar por tenantId", async () => {
    await request(app).post("/api/nbr-calcadas/registros").send(BASE_REGISTRO);
    await request(app)
      .post("/api/nbr-calcadas/registros")
      .send({ ...BASE_REGISTRO, tenantId: "ten-02" });
    const res = await request(app).get(
      "/api/nbr-calcadas/registros?tenantId=ten-01",
    );
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/nbr-calcadas/registros/:id", () => {
  it("deve retornar 404 para id inexistente", async () => {
    const res = await request(app).get("/api/nbr-calcadas/registros/rc-999");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/nbr-calcadas/registros/:id/obstaculos", () => {
  it("deve adicionar obstáculo ao registro", async () => {
    await request(app).post("/api/nbr-calcadas/registros").send(BASE_REGISTRO);
    const res = await request(app)
      .post("/api/nbr-calcadas/registros/rc-1/obstaculos")
      .send({
        tipo: "poste_iluminacao",
        posicaoM: 10,
        larguraM: 0.4,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ob-1");
    expect(res.body.tipo).toBe("poste_iluminacao");
  });
});

describe("POST /api/nbr-calcadas/registros/:id/analisar", () => {
  it("deve marcar como conforme quando score >= 70", async () => {
    await request(app).post("/api/nbr-calcadas/registros").send(BASE_REGISTRO);
    const res = await request(app).post(
      "/api/nbr-calcadas/registros/rc-1/analisar",
    );
    expect(res.status).toBe(200);
    expect(res.body.resultado).toBeDefined();
    expect(res.body.resultado.scoreConformidade).toBeGreaterThanOrEqual(70);
    expect(res.body.status).toBe("conforme");
  });

  it("deve marcar como nao_conforme com faixa livre insuficiente", async () => {
    await request(app)
      .post("/api/nbr-calcadas/registros")
      .send({ ...BASE_REGISTRO, faixaLivreM: 0.9, larguraTotalM: 2.0 });
    const res = await request(app).post(
      "/api/nbr-calcadas/registros/rc-1/analisar",
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("nao_conforme");
    expect(res.body.resultado.scoreConformidade).toBeLessThan(70);
    expect(res.body.resultado.desvios.length).toBeGreaterThan(0);
  });

  it("deve gerar hash de análise", async () => {
    await request(app).post("/api/nbr-calcadas/registros").send(BASE_REGISTRO);
    const res = await request(app).post(
      "/api/nbr-calcadas/registros/rc-1/analisar",
    );
    expect(res.body.resultado.hashAnalise).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("GET /api/nbr-calcadas/tipos-via", () => {
  it("deve retornar tipos de via", async () => {
    const res = await request(app).get("/api/nbr-calcadas/tipos-via");
    expect(res.status).toBe(200);
    expect(res.body).toContain("coletora");
  });
});

describe("GET /api/nbr-calcadas/larguras-minimas", () => {
  it("deve retornar mapa de larguras mínimas", async () => {
    const res = await request(app).get("/api/nbr-calcadas/larguras-minimas");
    expect(res.status).toBe(200);
    expect(res.body.local).toBeDefined();
    expect(res.body.arterial).toBeDefined();
  });
});
