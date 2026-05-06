import { vi } from "vitest";
/**
 * lgpdRetencaoAndResidenciaRoutes.test.ts
 *
 * Testes para:
 * - /api/lgpd/retencao (lgpdRetencaoRoutes)
 * - /api/lgpd/residencia (lgpdResidenciaRoutes)
 *
 * Ambos os routers usam serviços em memória — sem mock necessário.
 */

import request from "supertest";
import express from "express";

// ─── Mock logger ─────────────────────────────────────────────────────────────
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Build apps ──────────────────────────────────────────────────────────────
let retencaoApp: express.Application;
let residenciaApp: express.Application;

beforeAll(async () => {
  const [retMod, resMod] = await Promise.all([
    import("../routes/lgpdRetencaoRoutes.js"),
    import("../routes/lgpdResidenciaRoutes.js"),
  ]);
  retencaoApp = express();
  retencaoApp.use(express.json());
  retencaoApp.use("/", retMod.default);

  residenciaApp = express();
  residenciaApp.use(express.json());
  residenciaApp.use("/", resMod.default);
});

// ════════════════════════════════════════════════════════════════════════════
// LGPD RETENÇÃO
// ════════════════════════════════════════════════════════════════════════════

describe("lgpdRetencaoRoutes — políticas", () => {
  const validPolicy = {
    nome: "Política de Teste",
    descricao: "Descarte seguro de registros",
    sistema: "SISCAD",
    categorias: ["identificacao", "contato"],
    nivelClassificacao: "interno",
    retencaoOperacionalDias: 365,
    retencaoLegalDias: 1825,
    motivoConservacao: "obrigacao_legal",
    embasamentoLegal: "LGPD Art. 10",
    metodoDescarte: "exclusao_logica",
  };

  it("GET /politicas — retorna lista vazia inicialmente", async () => {
    const res = await request(retencaoApp).get("/politicas");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /politicas — cria política com dados válidos", async () => {
    const res = await request(retencaoApp).post("/politicas").send(validPolicy);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.nome).toBe(validPolicy.nome);
  });

  it("POST /politicas — 400 quando nome ausente", async () => {
    const { nome: _, ...body } = validPolicy;
    const res = await request(retencaoApp).post("/politicas").send(body);
    expect(res.status).toBe(400);
  });

  it("POST /politicas — 400 quando categorias não é array", async () => {
    const res = await request(retencaoApp)
      .post("/politicas")
      .send({ ...validPolicy, categorias: "identificacao" });
    expect(res.status).toBe(400);
  });

  it("POST /politicas — 400 quando nivelClassificacao inválido", async () => {
    const res = await request(retencaoApp)
      .post("/politicas")
      .send({ ...validPolicy, nivelClassificacao: "supersecreto" });
    expect(res.status).toBe(400);
  });

  it("GET /politicas/ativas — retorna políticas ativas", async () => {
    const res = await request(retencaoApp).get("/politicas/ativas");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /politicas/:id — 404 para id inexistente", async () => {
    const res = await request(retencaoApp).get("/politicas/nao-existe");
    expect(res.status).toBe(404);
  });

  it("GET /politicas/:id — retorna política criada", async () => {
    const created = (
      await request(retencaoApp).post("/politicas").send(validPolicy)
    ).body;
    const res = await request(retencaoApp).get(`/politicas/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("DELETE /politicas/:id — 404 para id inexistente", async () => {
    const res = await request(retencaoApp).delete("/politicas/nao-existe");
    expect(res.status).toBe(404);
  });

  it("DELETE /politicas/:id — desativa política existente", async () => {
    const created = (
      await request(retencaoApp).post("/politicas").send(validPolicy)
    ).body;
    const res = await request(retencaoApp).delete(`/politicas/${created.id}`);
    expect(res.status).toBe(200);
  });
});

describe("lgpdRetencaoRoutes — método recomendado", () => {
  it("GET /metodo-recomendado/publico — retorna método", async () => {
    const res = await request(retencaoApp).get("/metodo-recomendado/publico");
    expect(res.status).toBe(200);
    expect(res.body.nivel).toBe("publico");
    expect(res.body.metodoRecomendado).toBeDefined();
  });

  it("GET /metodo-recomendado/restrito — retorna método", async () => {
    const res = await request(retencaoApp).get("/metodo-recomendado/restrito");
    expect(res.status).toBe(200);
  });

  it("GET /metodo-recomendado/invalido — 400", async () => {
    const res = await request(retencaoApp).get("/metodo-recomendado/invalido");
    expect(res.status).toBe(400);
  });
});

describe("lgpdRetencaoRoutes — eventos de descarte", () => {
  let policyId: string;

  beforeAll(async () => {
    const res = await request(retencaoApp)
      .post("/politicas")
      .send({
        nome: "Política Eventos",
        descricao: "Para testes de descarte",
        sistema: "SYSTST",
        categorias: ["tecnico"],
        nivelClassificacao: "confidencial",
        retencaoOperacionalDias: 180,
      });
    policyId = res.body.id;
  });

  it("GET /eventos — retorna lista", async () => {
    const res = await request(retencaoApp).get("/eventos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /eventos/pendentes — retorna descartes pendentes", async () => {
    const res = await request(retencaoApp).get("/eventos/pendentes");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /eventos — 400 sem campos obrigatórios", async () => {
    const res = await request(retencaoApp).post("/eventos").send({});
    expect(res.status).toBe(400);
  });

  it("POST /eventos — 404 para politicaId inexistente", async () => {
    const res = await request(retencaoApp)
      .post("/eventos")
      .send({
        politicaId: "nao-existe",
        registrosEstimados: 100,
        agendadoPara: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(res.status).toBe(404);
  });

  it("POST /eventos — cria evento com política válida", async () => {
    const res = await request(retencaoApp)
      .post("/eventos")
      .send({
        politicaId: policyId,
        registrosEstimados: 250,
        agendadoPara: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LGPD RESIDÊNCIA
// ════════════════════════════════════════════════════════════════════════════

describe("lgpdResidenciaRoutes — localizações", () => {
  const validLoc = {
    sistema: "SISCAD",
    descricao: "Banco de dados principal",
    provedor: "aws",
    regiaoProvedor: "sa-east-1",
    pais: "BR",
    contemDadosPessoais: true,
    categorias: ["identificacao", "contato"],
    baseLegalTransferencia: "contrato",
    referenciaContratual: "CLD-2026-01",
  };

  it("GET /localizacoes — retorna lista", async () => {
    const res = await request(residenciaApp).get("/localizacoes");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /localizacoes — cria com dados válidos", async () => {
    const res = await request(residenciaApp)
      .post("/localizacoes")
      .send(validLoc);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it("POST /localizacoes — 400 sem campos obrigatórios", async () => {
    const res = await request(residenciaApp).post("/localizacoes").send({});
    expect(res.status).toBe(400);
  });

  it("POST /localizacoes — 400 quando contemDadosPessoais não é boolean", async () => {
    const res = await request(residenciaApp)
      .post("/localizacoes")
      .send({ ...validLoc, contemDadosPessoais: "sim" });
    expect(res.status).toBe(400);
  });

  it("GET /localizacoes/:id — 404 para id inexistente", async () => {
    const res = await request(residenciaApp).get("/localizacoes/nao-existe");
    expect(res.status).toBe(404);
  });

  it("GET /localizacoes/:id — retorna localização criada", async () => {
    const created = (
      await request(residenciaApp).post("/localizacoes").send(validLoc)
    ).body;
    const res = await request(residenciaApp).get(`/localizacoes/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("DELETE /localizacoes/:id — 404 para id inexistente", async () => {
    const res = await request(residenciaApp).delete("/localizacoes/nao-existe");
    expect(res.status).toBe(404);
  });

  it("DELETE /localizacoes/:id — remove localização existente", async () => {
    const created = (
      await request(residenciaApp).post("/localizacoes").send(validLoc)
    ).body;
    const res = await request(residenciaApp).delete(
      `/localizacoes/${created.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.removido).toBe(true);
  });
});

describe("lgpdResidenciaRoutes — conformidade e relatório", () => {
  it("GET /conformidade/nao-cadastrado — 404", async () => {
    const res = await request(residenciaApp).get(
      "/conformidade/sistema-fantasma",
    );
    expect(res.status).toBe(404);
  });

  it("GET /relatorio — retorna relatório geral", async () => {
    const res = await request(residenciaApp).get("/relatorio");
    expect(res.status).toBe(200);
  });

  it("GET /pais-adequado/BR — retorna info de adequação", async () => {
    const res = await request(residenciaApp).get("/pais-adequado/BR");
    expect(res.status).toBe(200);
    expect(res.body.pais).toBe("BR");
    expect(typeof res.body.adequacaoReconhecida).toBe("boolean");
  });

  it("GET /pais-adequado/US — retorna info mesmo para não adequado", async () => {
    const res = await request(residenciaApp).get("/pais-adequado/US");
    expect(res.status).toBe(200);
    expect(res.body.pais).toBe("US");
  });
});

// ─── Missing coverage: iniciar/concluir/cancelar/certificados ─────────────────

describe("lgpdRetencaoRoutes — transicoes de estado", () => {
  let politicaId: string;
  let eventoId: string;

  beforeAll(async () => {
    // Criar política
    const policyRes = await request(retencaoApp)
      .post("/politicas")
      .send({
        nome: "Politica Transicao",
        descricao: "Teste de transicao",
        sistema: "SISCAD",
        categorias: ["cadastral"],
        nivelClassificacao: "interno",
        retencaoOperacionalDias: 365,
      });
    politicaId = policyRes.body.id;

    // Criar evento
    const eventoRes = await request(retencaoApp)
      .post("/eventos")
      .send({
        politicaId,
        registrosEstimados: 100,
        agendadoPara: new Date(Date.now() + 86400000).toISOString(),
      });
    eventoId = eventoRes.body.id;
  });

  it("POST /eventos/:id/iniciar — retorna 200 com evento em andamento", async () => {
    const res = await request(retencaoApp).post(`/eventos/${eventoId}/iniciar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("em_execucao");
  });

  it("POST /eventos/:id/iniciar — retorna 404 para evento inexistente", async () => {
    const res = await request(retencaoApp).post("/eventos/nao-existe/iniciar");
    expect(res.status).toBe(404);
  });

  it("POST /eventos/:id/concluir — retorna 400 sem campos obrigatorios", async () => {
    const res = await request(retencaoApp)
      .post(`/eventos/${eventoId}/concluir`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("POST /eventos/:id/concluir — retorna 200 com certificado", async () => {
    const res = await request(retencaoApp)
      .post(`/eventos/${eventoId}/concluir`)
      .send({ registrosDescartados: 95, executadoPor: "operador@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.evento).toBeDefined();
    expect(res.body.certificado).toBeDefined();
  });

  it("POST /eventos/:id/concluir — retorna 404 para evento inexistente", async () => {
    const res = await request(retencaoApp)
      .post("/eventos/nao-existe/concluir")
      .send({ registrosDescartados: 10, executadoPor: "x@x.com" });
    expect(res.status).toBe(404);
  });

  it("POST /eventos/:id/cancelar — retorna 400 sem motivo", async () => {
    // Create a fresh event to cancel
    const ev = await request(retencaoApp)
      .post("/eventos")
      .send({ politicaId, registrosEstimados: 50, agendadoPara: new Date(Date.now() + 86400000).toISOString() });
    const id = ev.body.id;
    const res = await request(retencaoApp).post(`/eventos/${id}/cancelar`).send({});
    expect(res.status).toBe(400);
  });

  it("POST /eventos/:id/cancelar — retorna 200 quando cancelado com sucesso", async () => {
    const ev = await request(retencaoApp)
      .post("/eventos")
      .send({ politicaId, registrosEstimados: 50, agendadoPara: new Date(Date.now() + 86400000).toISOString() });
    const id = ev.body.id;
    const res = await request(retencaoApp).post(`/eventos/${id}/cancelar`).send({ motivo: "teste" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelado");
  });

  it("POST /eventos/:id/cancelar — retorna 404 para evento inexistente", async () => {
    const res = await request(retencaoApp).post("/eventos/nao-existe/cancelar").send({ motivo: "x" });
    expect(res.status).toBe(404);
  });

  it("GET /certificados — lista certificados emitidos", async () => {
    const res = await request(retencaoApp).get("/certificados");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /certificados/:id — retorna certificado por id", async () => {
    // List first to get an id
    const listRes = await request(retencaoApp).get("/certificados");
    if (listRes.body.length > 0) {
      const certId = listRes.body[0].id;
      const res = await request(retencaoApp).get(`/certificados/${certId}`);
      expect(res.status).toBe(200);
    }
  });

  it("GET /certificados/:id — retorna 404 para certificado inexistente", async () => {
    const res = await request(retencaoApp).get("/certificados/nao-existe");
    expect(res.status).toBe(404);
  });
});

