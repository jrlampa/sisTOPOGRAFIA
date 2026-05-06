/**
 * investorAuditRoutes.test.ts — Testes para Investor Audit Reporting (T2-70).
 */

import request from "supertest";
import app from "../app.js";
import { InvestorAuditService } from "../services/investorAuditService.js";

beforeEach(() => {
  InvestorAuditService._reset();
});

const BASE = "/api/investor-audit";

const RELATORIO_BASE = {
  nome: "Due Diligence Expansão Norte 2026",
  tenantId: "tenant-audit-1",
  periodoReferencia: "Q1/2026",
};

const METRICA_BASE = {
  dimensao: "confiabilidade_sistema",
  nome: "Disponibilidade do Sistema",
  valor: 95,
};

const RISCO_BASE = {
  nivel: "medio",
  categoria: "Regulatório",
  descricao: "Pendência de renovação de licença ANEEL",
  mitigacao: "Protocolo de renovação antecipada em andamento",
};

describe("GET /dimensoes", () => {
  it("retorna dimensões de auditoria com pesos", async () => {
    const res = await request(app).get(`${BASE}/dimensoes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
    expect(res.body[0]).toHaveProperty("codigo");
    expect(res.body[0]).toHaveProperty("peso");
  });
});

describe("POST /relatorios", () => {
  it("cria relatório com dados válidos", async () => {
    const res = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "audit-1");
    expect(res.body).toHaveProperty("status", "rascunho");
    expect(res.body).toHaveProperty("periodoReferencia", "Q1/2026");
  });

  it("retorna 400 com nome muito curto", async () => {
    const res = await request(app)
      .post(`${BASE}/relatorios`)
      .send({ ...RELATORIO_BASE, nome: "X" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 sem periodoReferencia", async () => {
    const res = await request(app)
      .post(`${BASE}/relatorios`)
      .send({ nome: "Relatório Válido", tenantId: "t1" });
    expect(res.status).toBe(400);
  });
});

describe("GET /relatorios", () => {
  it("retorna 400 sem tenantId", async () => {
    const res = await request(app).get(`${BASE}/relatorios`);
    expect(res.status).toBe(400);
  });

  it("retorna lista de relatórios do tenant", async () => {
    await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app).get(`${BASE}/relatorios?tenantId=tenant-audit-1`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe("GET /relatorios/:id", () => {
  it("retorna 404 para relatório inexistente", async () => {
    const res = await request(app).get(`${BASE}/relatorios/audit-999`);
    expect(res.status).toBe(404);
  });
});

describe("POST /relatorios/:id/metricas", () => {
  it("adiciona métrica válida", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/metricas`)
      .send(METRICA_BASE);
    expect(res.status).toBe(201);
    expect(res.body.metricas.length).toBe(1);
    expect(res.body.metricas[0]).toHaveProperty("valor", 95);
  });

  it("retorna 400 com valor acima de 100", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/metricas`)
      .send({ ...METRICA_BASE, valor: 150 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 com dimensão inválida", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/metricas`)
      .send({ ...METRICA_BASE, dimensao: "dimensao_invalida" });
    expect(res.status).toBe(400);
  });
});

describe("POST /relatorios/:id/riscos", () => {
  it("adiciona risco válido", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/riscos`)
      .send(RISCO_BASE);
    expect(res.status).toBe(201);
    expect(res.body.riscos.length).toBe(1);
    expect(res.body.riscos[0]).toHaveProperty("nivel", "medio");
  });

  it("retorna 400 com nível de risco inválido", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/riscos`)
      .send({ ...RISCO_BASE, nivel: "extremo" });
    expect(res.status).toBe(400);
  });
});

describe("POST /relatorios/:id/calcular", () => {
  it("retorna 422 sem métricas cadastradas", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app).post(`${BASE}/relatorios/${rel.body.id}/calcular`);
    expect(res.status).toBe(422);
  });

  it("calcula score de auditoria corretamente", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/metricas`)
      .send({ dimensao: "confiabilidade_sistema", nome: "Disponibilidade", valor: 90 });
    await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/metricas`)
      .send({ dimensao: "conformidade_regulatoria", nome: "Conformidade ANEEL", valor: 85 });
    await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/riscos`)
      .send(RISCO_BASE);
    const res = await request(app).post(`${BASE}/relatorios/${rel.body.id}/calcular`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "calculado");
    expect(res.body.resultado).toHaveProperty("scoreGeral");
    expect(res.body.resultado).toHaveProperty("classificacao");
    expect(res.body.resultado).toHaveProperty("hashIntegridade");
    expect(res.body.resultado).toHaveProperty("totalRiscos");
    expect(res.body.resultado.scoreGeral).toBeGreaterThan(0);
  });
});

describe("POST /relatorios/:id/publicar", () => {
  it("retorna 422 para relatório não calculado", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    const res = await request(app).post(`${BASE}/relatorios/${rel.body.id}/publicar`);
    expect(res.status).toBe(422);
  });

  it("publica relatório calculado", async () => {
    const rel = await request(app).post(`${BASE}/relatorios`).send(RELATORIO_BASE);
    await request(app)
      .post(`${BASE}/relatorios/${rel.body.id}/metricas`)
      .send(METRICA_BASE);
    await request(app).post(`${BASE}/relatorios/${rel.body.id}/calcular`);
    const res = await request(app).post(`${BASE}/relatorios/${rel.body.id}/publicar`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "publicado");
  });
});
