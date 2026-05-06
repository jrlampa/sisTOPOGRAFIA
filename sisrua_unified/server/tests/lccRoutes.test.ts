/**
 * lccRoutes.test.ts — Testes LCC Life Cycle Cost (T2-44).
 */

import request from "supertest";
import app from "../app.js";
import { LccService } from "../services/lccService.js";

beforeEach(() => {
  LccService._reset();
});

const TENANT = "tenant-lcc-test";

const ANALISE_BASE = {
  nome: "Análise LCC Rede BT Bairro Norte",
  tenantId: TENANT,
  taxaDesconto: 0.08,
  horizonte: 25,
};

const ATIVO_BASE = {
  descricao: "Transformador trifásico 75kVA",
  tipo: "transformador_75kva",
  quantidade: 3,
  vidaUtilAnos: 25,
  custos: [
    { ano: 0, categoria: "aquisicao", valorNominal: 18500 },
    { ano: 0, categoria: "instalacao", valorNominal: 2000 },
    { ano: 1, categoria: "manutencao", valorNominal: 500 },
    { ano: 3, categoria: "manutencao", valorNominal: 800 },
    { ano: 25, categoria: "descarte", valorNominal: 300 },
  ],
};

describe("POST /api/lcc/analises", () => {
  it("cria análise LCC", async () => {
    const res = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^lcc-/);
    expect(res.body.status).toBe("rascunho");
    expect(res.body.ativos).toHaveLength(0);
  });

  it("retorna 400 para payload inválido", async () => {
    const res = await request(app).post("/api/lcc/analises").send({ nome: "Sem horizonte" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para taxa de desconto > 1", async () => {
    const res = await request(app).post("/api/lcc/analises").send({
      ...ANALISE_BASE,
      taxaDesconto: 1.5,
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/lcc/analises", () => {
  it("lista análises do tenant", async () => {
    await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    const res = await request(app).get(`/api/lcc/analises?tenantId=${TENANT}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("retorna 400 sem tenantId", async () => {
    const res = await request(app).get("/api/lcc/analises");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/lcc/analises/:id", () => {
  it("busca análise por id", async () => {
    const criada = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    const res = await request(app).get(`/api/lcc/analises/${criada.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.nome).toBe(ANALISE_BASE.nome);
  });

  it("retorna 404 para id inexistente", async () => {
    const res = await request(app).get("/api/lcc/analises/lcc-9999");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/lcc/analises/:id/ativos", () => {
  it("adiciona ativo à análise", async () => {
    const criada = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    const res = await request(app)
      .post(`/api/lcc/analises/${criada.body.id}/ativos`)
      .send(ATIVO_BASE);
    expect(res.status).toBe(201);
    expect(res.body.ativos).toHaveLength(1);
    expect(res.body.ativos[0].id).toMatch(/^atv-/);
  });

  it("retorna 404 para análise inexistente", async () => {
    const res = await request(app).post("/api/lcc/analises/lcc-9999/ativos").send(ATIVO_BASE);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/lcc/analises/:id/calcular", () => {
  it("calcula LCC com ativos", async () => {
    const criada = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    await request(app).post(`/api/lcc/analises/${criada.body.id}/ativos`).send(ATIVO_BASE);
    const res = await request(app).post(`/api/lcc/analises/${criada.body.id}/calcular`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("calculado");
    expect(res.body.resultado).toBeDefined();
    expect(res.body.resultado.vplTotal).toBeGreaterThan(0);
    expect(res.body.resultado.custoNominalTotal).toBeGreaterThan(0);
    expect(res.body.resultado.custoAnualEquivalente).toBeGreaterThan(0);
    expect(res.body.resultado.distribuicaoPorCategoria.aquisicao.nominal).toBeGreaterThan(0);
    expect(res.body.resultado.hashIntegridade).toHaveLength(64);
  });

  it("retorna 422 para análise sem ativos", async () => {
    const criada = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    const res = await request(app).post(`/api/lcc/analises/${criada.body.id}/calcular`);
    expect(res.status).toBe(422);
  });
});

describe("POST /api/lcc/analises/:id/aprovar", () => {
  it("aprova análise calculada", async () => {
    const criada = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    await request(app).post(`/api/lcc/analises/${criada.body.id}/ativos`).send(ATIVO_BASE);
    await request(app).post(`/api/lcc/analises/${criada.body.id}/calcular`);
    const res = await request(app).post(`/api/lcc/analises/${criada.body.id}/aprovar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
  });

  it("retorna 422 para análise não calculada", async () => {
    const criada = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    const res = await request(app).post(`/api/lcc/analises/${criada.body.id}/aprovar`);
    expect(res.status).toBe(422);
  });
});

describe("POST /api/lcc/comparar", () => {
  it("compara duas alternativas LCC", async () => {
    // Alternativa A: cabo convencional
    const analiseA = await request(app).post("/api/lcc/analises").send({ ...ANALISE_BASE, nome: "Cabo Convencional" });
    await request(app).post(`/api/lcc/analises/${analiseA.body.id}/ativos`).send({
      descricao: "Cabo alumínio nu 70mm²",
      tipo: "cabo_nu",
      quantidade: 1000,
      vidaUtilAnos: 30,
      custos: [
        { ano: 0, categoria: "aquisicao", valorNominal: 14200 },
        { ano: 5, categoria: "manutencao", valorNominal: 2000 },
      ],
    });
    await request(app).post(`/api/lcc/analises/${analiseA.body.id}/calcular`);

    // Alternativa B: cabo protegido
    const analiseB = await request(app).post("/api/lcc/analises").send({ ...ANALISE_BASE, nome: "Cabo Protegido" });
    await request(app).post(`/api/lcc/analises/${analiseB.body.id}/ativos`).send({
      descricao: "Cabo protegido CAC 35mm²",
      tipo: "cabo_protegido",
      quantidade: 1000,
      vidaUtilAnos: 35,
      custos: [
        { ano: 0, categoria: "aquisicao", valorNominal: 45800 },
        { ano: 10, categoria: "manutencao", valorNominal: 1000 },
      ],
    });
    await request(app).post(`/api/lcc/analises/${analiseB.body.id}/calcular`);

    const res = await request(app).post("/api/lcc/comparar").send({
      idA: analiseA.body.id,
      idB: analiseB.body.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.nomeA).toBe("Cabo Convencional");
    expect(res.body.nomeB).toBe("Cabo Protegido");
    expect(["A", "B", "empate"]).toContain(res.body.alternativaMaisEconomica);
  });

  it("retorna 422 quando análise não calculada", async () => {
    const analiseA = await request(app).post("/api/lcc/analises").send(ANALISE_BASE);
    const analiseB = await request(app).post("/api/lcc/analises").send({ ...ANALISE_BASE, nome: "Análise Alternativa B" });
    const res = await request(app).post("/api/lcc/comparar").send({
      idA: analiseA.body.id,
      idB: analiseB.body.id,
    });
    expect(res.status).toBe(422);
  });
});
