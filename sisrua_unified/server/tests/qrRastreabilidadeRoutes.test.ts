/**
 * Testes T2-66 — Rastreabilidade QR Code Industrial
 */

import request from "supertest";
import app from "../app.js";
import { QrRastreabilidadeService } from "../services/qrRastreabilidadeService.js";

const BASE = "/api/qr-rastreabilidade";

beforeEach(() => QrRastreabilidadeService._reset());

const ativoPayload = {
  tenantId: "t1",
  codigoAsset: "TRF-001",
  nomeAsset: "Transformador Principal",
  tipoAsset: "transformador",
  enderecoInstalacao: "Rua das Flores, 123",
  municipio: "São Paulo",
  uf: "SP",
};

describe("POST /ativos", () => {
  it("cria ativo com QR code e status gerado", async () => {
    const res = await request(app).post(`${BASE}/ativos`).send(ativoPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("at-1");
    expect(res.body.status).toBe("gerado");
    expect(res.body.qrCode).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(res.body.qrUrl).toContain(res.body.qrCode);
  });

  it("cria evento de criação automático", async () => {
    const res = await request(app).post(`${BASE}/ativos`).send(ativoPayload);
    expect(res.body.eventos).toHaveLength(1);
    expect(res.body.eventos[0].tipoEvento).toBe("criacao");
    expect(res.body.eventos[0].hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejeita sem tenantId", async () => {
    const res = await request(app).post(`${BASE}/ativos`).send({ ...ativoPayload, tenantId: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /ativos", () => {
  it("lista vazia", async () => {
    const res = await request(app).get(`${BASE}/ativos`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filtra por tenantId", async () => {
    await request(app).post(`${BASE}/ativos`).send({ ...ativoPayload, tenantId: "tA" });
    await request(app).post(`${BASE}/ativos`).send({ ...ativoPayload, tenantId: "tB" });
    const res = await request(app).get(`${BASE}/ativos?tenantId=tA`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tenantId).toBe("tA");
  });
});

describe("GET /ativos/:id", () => {
  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app).get(`${BASE}/ativos/at-999`);
    expect(res.status).toBe(404);
  });

  it("retorna ativo existente", async () => {
    await request(app).post(`${BASE}/ativos`).send(ativoPayload);
    const res = await request(app).get(`${BASE}/ativos/at-1`);
    expect(res.status).toBe(200);
    expect(res.body.nomeAsset).toBe("Transformador Principal");
  });
});

describe("GET /ativos/qr/:qrCode", () => {
  it("retorna ativo pelo QR code", async () => {
    const criado = await request(app).post(`${BASE}/ativos`).send(ativoPayload);
    const qrCode = criado.body.qrCode;
    const res = await request(app).get(`${BASE}/ativos/qr/${qrCode}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("at-1");
  });

  it("retorna 404 para QR code inválido", async () => {
    const res = await request(app).get(`${BASE}/ativos/qr/codigo-invalido-123`);
    expect(res.status).toBe(404);
  });
});

describe("POST /ativos/:id/eventos", () => {
  it("registra evento com hash de integridade", async () => {
    await request(app).post(`${BASE}/ativos`).send(ativoPayload);
    const res = await request(app).post(`${BASE}/ativos/at-1/eventos`).send({
      tipoEvento: "inspecao",
      descricao: "Inspeção periódica realizada",
      tecnicoResponsavel: "João Técnico",
      dataEvento: "2025-01-15",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ev-2"); // ev-1 é automático
    expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retorna 422 para ativo inexistente", async () => {
    const res = await request(app).post(`${BASE}/ativos/at-999/eventos`).send({
      tipoEvento: "inspecao",
      descricao: "Inspeção periódica",
      tecnicoResponsavel: "Técnico",
      dataEvento: "2025-01-15",
    });
    expect(res.status).toBe(422);
  });
});

describe("POST /ativos/:id/instalar", () => {
  it("instala ativo e muda status para instalado", async () => {
    await request(app).post(`${BASE}/ativos`).send(ativoPayload);
    const res = await request(app).post(`${BASE}/ativos/at-1/instalar`).send({
      dataInstalacao: "2025-01-15",
      tecnicoResponsavel: "João Técnico",
      localizacaoLat: -23.5505,
      localizacaoLon: -46.6333,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("instalado");
    expect(res.body.dataInstalacao).toBe("2025-01-15");
  });

  it("rejeita instalação de ativo já instalado", async () => {
    await request(app).post(`${BASE}/ativos`).send(ativoPayload);
    await request(app).post(`${BASE}/ativos/at-1/instalar`).send({
      dataInstalacao: "2025-01-15",
      tecnicoResponsavel: "João Técnico",
    });
    const res = await request(app).post(`${BASE}/ativos/at-1/instalar`).send({
      dataInstalacao: "2025-01-16",
      tecnicoResponsavel: "Maria Técnica",
    });
    expect(res.status).toBe(422);
  });
});

describe("GET /tipos-asset", () => {
  it("lista tipos de asset disponíveis", async () => {
    const res = await request(app).get(`${BASE}/tipos-asset`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("transformador");
    expect(res.body).toContain("poste");
  });
});
