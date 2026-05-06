/**
 * vegetacaoInventarioRoutes.test.ts — Testes para Inventário de Vegetação (T2-46).
 */

import request from "supertest";
import app from "../app.js";
import { VegetacaoInventarioService } from "../services/vegetacaoInventarioService.js";

beforeEach(() => {
  VegetacaoInventarioService._reset();
});

const BASE = "/api/vegetacao-inventario";

const INVENTARIO_BASE = {
  nome: "Inventário Trecho Norte",
  tenantId: "tenant-veg-1",
};

const UNIDADE_BASE = {
  tipologia: "cerrado",
  statusConservacao: "secundaria_inicial",
  areaHectares: 2.5,
  municipio: "Barretos",
  uf: "SP",
};

describe("GET /tipologias", () => {
  it("retorna lista de tipologias vegetais", async () => {
    const res = await request(app).get(`${BASE}/tipologias`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("codigo");
    expect(res.body[0]).toHaveProperty("volumeM3PorHa");
  });
});

describe("POST /inventarios", () => {
  it("cria inventário com dados válidos", async () => {
    const res = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "inv-1");
    expect(res.body).toHaveProperty("status", "rascunho");
  });

  it("retorna 400 com nome muito curto", async () => {
    const res = await request(app)
      .post(`${BASE}/inventarios`)
      .send({ ...INVENTARIO_BASE, nome: "X" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 sem tenantId", async () => {
    const res = await request(app)
      .post(`${BASE}/inventarios`)
      .send({ nome: "Inventário Válido" });
    expect(res.status).toBe(400);
  });
});

describe("GET /inventarios", () => {
  it("retorna 400 sem tenantId", async () => {
    const res = await request(app).get(`${BASE}/inventarios`);
    expect(res.status).toBe(400);
  });

  it("retorna lista vazia para tenant sem inventários", async () => {
    const res = await request(app).get(`${BASE}/inventarios?tenantId=nenhum`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("retorna inventários do tenant correto", async () => {
    await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    const res = await request(app).get(`${BASE}/inventarios?tenantId=tenant-veg-1`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe("GET /inventarios/:id", () => {
  it("retorna 404 para inventário inexistente", async () => {
    const res = await request(app).get(`${BASE}/inventarios/inv-999`);
    expect(res.status).toBe(404);
  });

  it("retorna inventário existente", async () => {
    const criado = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    const res = await request(app).get(`${BASE}/inventarios/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(criado.body.id);
  });
});

describe("POST /inventarios/:id/unidades", () => {
  it("adiciona unidade de vegetação válida", async () => {
    const inv = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    const res = await request(app)
      .post(`${BASE}/inventarios/${inv.body.id}/unidades`)
      .send(UNIDADE_BASE);
    expect(res.status).toBe(201);
    expect(res.body.unidades.length).toBe(1);
    expect(res.body.unidades[0]).toHaveProperty("id", "uveg-1");
  });

  it("retorna 400 com tipologia inválida", async () => {
    const inv = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    const res = await request(app)
      .post(`${BASE}/inventarios/${inv.body.id}/unidades`)
      .send({ ...UNIDADE_BASE, tipologia: "floresta_nao_existe" });
    expect(res.status).toBe(400);
  });

  it("retorna 404 para inventário inexistente", async () => {
    const res = await request(app)
      .post(`${BASE}/inventarios/inv-999/unidades`)
      .send(UNIDADE_BASE);
    expect(res.status).toBe(404);
  });
});

describe("POST /inventarios/:id/calcular", () => {
  it("retorna 422 sem unidades cadastradas", async () => {
    const inv = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    const res = await request(app).post(`${BASE}/inventarios/${inv.body.id}/calcular`);
    expect(res.status).toBe(422);
  });

  it("calcula supressão vegetal corretamente", async () => {
    const inv = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    await request(app)
      .post(`${BASE}/inventarios/${inv.body.id}/unidades`)
      .send(UNIDADE_BASE);
    const res = await request(app).post(`${BASE}/inventarios/${inv.body.id}/calcular`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "calculado");
    expect(res.body.resultado).toHaveProperty("totalAreaHa");
    expect(res.body.resultado).toHaveProperty("totalVolumeM3");
    expect(res.body.resultado).toHaveProperty("compensacaoExigidaHa");
    expect(res.body.resultado).toHaveProperty("hashIntegridade");
    // cerrado, 2.5 ha, volume = 2.5 * 80 = 200 m³
    expect(res.body.resultado.totalVolumeM3).toBeCloseTo(200, 1);
  });
});

describe("POST /inventarios/:id/aprovar", () => {
  it("retorna 422 para inventário em rascunho", async () => {
    const inv = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    const res = await request(app).post(`${BASE}/inventarios/${inv.body.id}/aprovar`);
    expect(res.status).toBe(422);
  });

  it("aprova inventário calculado", async () => {
    const inv = await request(app).post(`${BASE}/inventarios`).send(INVENTARIO_BASE);
    await request(app)
      .post(`${BASE}/inventarios/${inv.body.id}/unidades`)
      .send(UNIDADE_BASE);
    await request(app).post(`${BASE}/inventarios/${inv.body.id}/calcular`);
    const res = await request(app).post(`${BASE}/inventarios/${inv.body.id}/aprovar`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "aprovado");
  });
});
