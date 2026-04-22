/**
 * sinapiRoutes.test.ts — Testes SINAPI/ORSE (T2-42).
 */

import request from "supertest";
import app from "../app.js";
import { SinapiService } from "../services/sinapiService.js";

beforeEach(() => {
  SinapiService._reset();
});

const TENANT = "tenant-sinapi-test";

describe("GET /api/sinapi/catalogo", () => {
  it("retorna todos os itens do catálogo", async () => {
    const res = await request(app).get("/api/sinapi/catalogo");
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.itens)).toBe(true);
  });

  it("filtra por categoria", async () => {
    const res = await request(app).get("/api/sinapi/catalogo?categoria=transformadores");
    expect(res.status).toBe(200);
    expect(res.body.itens.every((i: { categoria: string }) => i.categoria === "transformadores")).toBe(true);
  });

  it("filtra por busca textual", async () => {
    const res = await request(app).get("/api/sinapi/catalogo?busca=poste");
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("retorna 400 para categoria inválida", async () => {
    const res = await request(app).get("/api/sinapi/catalogo?categoria=INVALIDA");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sinapi/catalogo/:codigo", () => {
  it("retorna item pelo código SINAPI", async () => {
    const res = await request(app).get("/api/sinapi/catalogo/74133%2F002");
    expect(res.status).toBe(200);
    expect(res.body.codigo).toBe("74133/002");
  });

  it("retorna 404 para código inexistente", async () => {
    const res = await request(app).get("/api/sinapi/catalogo/99999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/sinapi/categorias", () => {
  it("lista categorias disponíveis", async () => {
    const res = await request(app).get("/api/sinapi/categorias");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categorias)).toBe(true);
    expect(res.body.categorias).toContain("transformadores");
  });
});

describe("POST /api/sinapi/orcamento", () => {
  it("gera orçamento com itens válidos", async () => {
    const payload = {
      descricao: "Rede BT Bairro Teste",
      tenantId: TENANT,
      uf: "RJ",
      itens: [
        { codigoSinapi: "74131/001", quantidade: 10 },
        { codigoSinapi: "74129/003", quantidade: 500 },
      ],
    };
    const res = await request(app).post("/api/sinapi/orcamento").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^orc-/);
    expect(res.body.custoDirectoTotal).toBeGreaterThan(0);
    expect(res.body.itens).toHaveLength(2);
    expect(res.body.hashIntegridade).toHaveLength(64);
  });

  it("aplica preço unitário customizado quando fornecido", async () => {
    const payload = {
      descricao: "Teste preço customizado",
      tenantId: TENANT,
      uf: "SP",
      itens: [
        { codigoSinapi: "74133/001", quantidade: 2, precoUnitarioAplicado: 5000 },
      ],
    };
    const res = await request(app).post("/api/sinapi/orcamento").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.itens[0].precoUnitario).toBe(5000);
    expect(res.body.custoDirectoTotal).toBe(10000);
  });

  it("retorna 422 para código de item inexistente", async () => {
    const payload = {
      descricao: "Teste inválido",
      tenantId: TENANT,
      uf: "MG",
      itens: [{ codigoSinapi: "INEXISTENTE-999", quantidade: 1 }],
    };
    const res = await request(app).post("/api/sinapi/orcamento").send(payload);
    expect(res.status).toBe(422);
    expect(res.body.itensNaoEncontrados).toContain("INEXISTENTE-999");
  });

  it("retorna 400 para payload inválido", async () => {
    const res = await request(app).post("/api/sinapi/orcamento").send({ uf: "XX" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sinapi/orcamentos", () => {
  it("lista orçamentos do tenant", async () => {
    await request(app).post("/api/sinapi/orcamento").send({
      descricao: "ORC 1",
      tenantId: TENANT,
      uf: "SP",
      itens: [{ codigoSinapi: "74131/001", quantidade: 1 }],
    });
    const res = await request(app).get(`/api/sinapi/orcamentos?tenantId=${TENANT}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("retorna 400 sem tenantId", async () => {
    const res = await request(app).get("/api/sinapi/orcamentos");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sinapi/orcamento/:id", () => {
  it("busca orçamento pelo id", async () => {
    const criado = await request(app).post("/api/sinapi/orcamento").send({
      descricao: "ORC Busca",
      tenantId: TENANT,
      uf: "RJ",
      itens: [{ codigoSinapi: "74139/001", quantidade: 20 }],
    });
    const id = criado.body.id;
    const res = await request(app).get(`/api/sinapi/orcamento/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it("retorna 404 para id inexistente", async () => {
    const res = await request(app).get("/api/sinapi/orcamento/orc-9999");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/sinapi/orcamento/:id/status", () => {
  it("atualiza status do orçamento", async () => {
    const criado = await request(app).post("/api/sinapi/orcamento").send({
      descricao: "ORC Status",
      tenantId: TENANT,
      uf: "MG",
      itens: [{ codigoSinapi: "97630", quantidade: 50 }],
    });
    const res = await request(app)
      .patch(`/api/sinapi/orcamento/${criado.body.id}/status`)
      .send({ status: "validado" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("validado");
  });

  it("retorna 400 para status inválido", async () => {
    const res = await request(app)
      .patch("/api/sinapi/orcamento/orc-1/status")
      .send({ status: "INVALIDO" });
    expect(res.status).toBe(400);
  });
});
