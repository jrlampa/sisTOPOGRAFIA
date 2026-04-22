/**
 * servidoesFundiariosRoutes.test.ts — Testes para Gestão de Servidões Fundiárias (T2-55).
 */

import request from "supertest";
import app from "../app.js";
import { ServidoesFundiariosService } from "../services/servidoesFundiariosService.js";

beforeEach(() => {
  ServidoesFundiariosService._reset();
});

const BASE = "/api/servidoes-fundiarios";

const PROCESSO_BASE = {
  nome: "Servidão Trecho LT-230kV Norte",
  tenantId: "tenant-srv-1",
  concessionaria: "CEMIG Distribuição",
  tensaoKv: 13.8,
};

const IMOVEL_BASE = {
  matricula: "12345",
  proprietario: "João da Silva",
  municipio: "Uberlândia",
  uf: "MG",
  areaAfetadaM2: 1500,
  larguraFaixaM: 10,
  coordenadas: [
    { lat: -18.9188, lng: -48.2773 },
    { lat: -18.9210, lng: -48.2790 },
  ],
};

describe("POST /processos", () => {
  it("cria processo com dados válidos", async () => {
    const res = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "srv-1");
    expect(res.body).toHaveProperty("status", "rascunho");
  });

  it("retorna 400 com nome muito curto", async () => {
    const res = await request(app)
      .post(`${BASE}/processos`)
      .send({ ...PROCESSO_BASE, nome: "X" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 sem tenantId", async () => {
    const res = await request(app)
      .post(`${BASE}/processos`)
      .send({ nome: "Processo Válido" });
    expect(res.status).toBe(400);
  });
});

describe("GET /processos", () => {
  it("retorna 400 sem tenantId", async () => {
    const res = await request(app).get(`${BASE}/processos`);
    expect(res.status).toBe(400);
  });

  it("retorna lista vazia para tenant sem processos", async () => {
    const res = await request(app).get(`${BASE}/processos?tenantId=nenhum`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("retorna processos do tenant correto", async () => {
    await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    const res = await request(app).get(`${BASE}/processos?tenantId=tenant-srv-1`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe("GET /processos/:id", () => {
  it("retorna 404 para processo inexistente", async () => {
    const res = await request(app).get(`${BASE}/processos/srv-999`);
    expect(res.status).toBe(404);
  });

  it("retorna processo existente", async () => {
    const criado = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    const res = await request(app).get(`${BASE}/processos/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(criado.body.id);
  });
});

describe("POST /processos/:id/imoveis", () => {
  it("adiciona imóvel válido ao processo", async () => {
    const proc = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    const res = await request(app)
      .post(`${BASE}/processos/${proc.body.id}/imoveis`)
      .send(IMOVEL_BASE);
    expect(res.status).toBe(201);
    expect(res.body.imoveis.length).toBe(1);
    expect(res.body.imoveis[0]).toHaveProperty("id", "imovel-1");
    expect(res.body.imoveis[0]).toHaveProperty("matricula", "12345");
  });

  it("retorna 400 com UF inválida (mais de 2 chars)", async () => {
    const proc = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    const res = await request(app)
      .post(`${BASE}/processos/${proc.body.id}/imoveis`)
      .send({ ...IMOVEL_BASE, uf: "MINAS" });
    expect(res.status).toBe(400);
  });

  it("retorna 404 para processo inexistente", async () => {
    const res = await request(app)
      .post(`${BASE}/processos/srv-999/imoveis`)
      .send(IMOVEL_BASE);
    expect(res.status).toBe(404);
  });
});

describe("POST /processos/:id/memorial", () => {
  it("retorna 422 sem imóveis cadastrados", async () => {
    const proc = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    const res = await request(app).post(`${BASE}/processos/${proc.body.id}/memorial`);
    expect(res.status).toBe(422);
  });

  it("gera memorial descritivo com sucesso", async () => {
    const proc = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    await request(app)
      .post(`${BASE}/processos/${proc.body.id}/imoveis`)
      .send(IMOVEL_BASE);
    const res = await request(app).post(`${BASE}/processos/${proc.body.id}/memorial`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "memorial_gerado");
    expect(res.body.memorial).toHaveProperty("texto");
    expect(res.body.memorial).toHaveProperty("hashIntegridade");
    expect(res.body.memorial.texto).toContain("MEMORIAL DESCRITIVO");
  });
});

describe("POST /processos/:id/cartas-anuencia", () => {
  it("emite cartas de anuência para processo com imóveis", async () => {
    const proc = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    await request(app)
      .post(`${BASE}/processos/${proc.body.id}/imoveis`)
      .send(IMOVEL_BASE);
    const res = await request(app).post(`${BASE}/processos/${proc.body.id}/cartas-anuencia`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "carta_enviada");
    expect(Array.isArray(res.body.cartasAnuencia)).toBe(true);
    expect(res.body.cartasAnuencia[0].texto).toContain("CARTA DE ANUÊNCIA");
  });
});

describe("POST /processos/:id/aprovar", () => {
  it("retorna 422 para processo em rascunho sem memorial", async () => {
    const proc = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    const res = await request(app).post(`${BASE}/processos/${proc.body.id}/aprovar`);
    expect(res.status).toBe(422);
  });

  it("aprova processo com memorial gerado", async () => {
    const proc = await request(app).post(`${BASE}/processos`).send(PROCESSO_BASE);
    await request(app)
      .post(`${BASE}/processos/${proc.body.id}/imoveis`)
      .send(IMOVEL_BASE);
    await request(app).post(`${BASE}/processos/${proc.body.id}/memorial`);
    const res = await request(app).post(`${BASE}/processos/${proc.body.id}/aprovar`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "aprovado");
  });
});
