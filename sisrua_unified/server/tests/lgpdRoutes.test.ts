/**
 * lgpdRoutes.test.ts
 *
 * Testes para /api/lgpd (lgpdRoutes):
 * - Fluxos de tratamento
 * - Direitos dos titulares
 * - Incidentes e playbook
 *
 * Serviços são em memória — sem mock de banco necessário.
 */

import request from "supertest";
import express from "express";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

let app: express.Application;

beforeAll(async () => {
  const mod = await import("../routes/lgpdRoutes.js");
  app = express();
  app.use(express.json());
  app.use("/", mod.default);
});

// ════════════════════════════════════════════════════════════════════════════
// FLUXOS DE TRATAMENTO
// ════════════════════════════════════════════════════════════════════════════

const validFluxo = {
  nome: "Cadastro de clientes",
  finalidade: "Gerenciamento de contratos de fornecimento de energia elétrica",
  baseLegal: "execucao_contrato",
  categorias: ["identificacao", "contato"],
  retencaoDias: 1825,
  compartilhaTerceiros: false,
  transferenciaInternacional: false,
  operador: "ANEEL-DEC",
};

describe("lgpdRoutes — fluxos de tratamento", () => {
  it("GET /fluxos — retorna lista", async () => {
    const res = await request(app).get("/fluxos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.fluxos)).toBe(true);
  });

  it("POST /fluxos — cria fluxo válido", async () => {
    const res = await request(app).post("/fluxos").send(validFluxo);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.nome).toBe(validFluxo.nome);
  });

  it("POST /fluxos — 400 sem nome", async () => {
    const { nome: _, ...body } = validFluxo;
    const res = await request(app).post("/fluxos").send(body);
    expect(res.status).toBe(400);
    expect(res.body.detalhes).toBeDefined();
  });

  it("POST /fluxos — 400 baseLegal inválida", async () => {
    const res = await request(app)
      .post("/fluxos")
      .send({ ...validFluxo, baseLegal: "interesse_x" });
    expect(res.status).toBe(400);
  });

  it("POST /fluxos — 400 categorias vazia", async () => {
    const res = await request(app)
      .post("/fluxos")
      .send({ ...validFluxo, categorias: [] });
    expect(res.status).toBe(400);
  });

  it("GET /fluxos/:id — 404 para id inexistente", async () => {
    const res = await request(app).get("/fluxos/nao-existe");
    expect(res.status).toBe(404);
  });

  it("GET /fluxos/:id — retorna fluxo criado", async () => {
    const created = (await request(app).post("/fluxos").send(validFluxo)).body;
    const res = await request(app).get(`/fluxos/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("GET /fluxos/:id/ripd — 404 para id inexistente", async () => {
    const res = await request(app).get("/fluxos/nao-existe/ripd");
    expect(res.status).toBe(404);
  });

  it("GET /fluxos/:id/ripd — retorna RIPD do fluxo", async () => {
    const created = (await request(app).post("/fluxos").send(validFluxo)).body;
    const res = await request(app).get(`/fluxos/${created.id}/ripd`);
    expect(res.status).toBe(200);
  });

  it("GET /ripd — retorna RIPD geral", async () => {
    const res = await request(app).get("/ripd");
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe("number");
    expect(Array.isArray(res.body.ripds)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DIREITOS DOS TITULARES
// ════════════════════════════════════════════════════════════════════════════

describe("lgpdRoutes — direitos dos titulares", () => {
  const validDireito = {
    titularId: "titular-abc-123",
    direito: "acesso",
    descricao: "Quero acessar todos os dados cadastrados em meu nome",
  };

  it("GET /direitos/abertos — retorna lista", async () => {
    const res = await request(app).get("/direitos/abertos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.solicitacoes)).toBe(true);
  });

  it("POST /direitos — cria solicitação válida", async () => {
    const res = await request(app).post("/direitos").send(validDireito);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.titularId).toBe(validDireito.titularId);
  });

  it("POST /direitos — 400 sem titularId", async () => {
    const { titularId: _, ...body } = validDireito;
    const res = await request(app).post("/direitos").send(body);
    expect(res.status).toBe(400);
  });

  it("POST /direitos — 400 direito inválido", async () => {
    const res = await request(app)
      .post("/direitos")
      .send({ ...validDireito, direito: "nao_existe" });
    expect(res.status).toBe(400);
  });

  it("GET /direitos/:titularId — retorna solicitações por titular", async () => {
    await request(app).post("/direitos").send(validDireito);
    const res = await request(app).get(`/direitos/${validDireito.titularId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.solicitacoes)).toBe(true);
    expect(res.body.solicitacoes.length).toBeGreaterThan(0);
  });

  it("PUT /direitos/:id/status — 400 sem status", async () => {
    const res = await request(app).put("/direitos/algum-id/status").send({});
    expect(res.status).toBe(400);
  });

  it("PUT /direitos/:id/status — 404 para id inexistente", async () => {
    const res = await request(app)
      .put("/direitos/nao-existe/status")
      .send({ status: "atendida" });
    expect(res.status).toBe(404);
  });

  it("PUT /direitos/:id/status — atualiza status de solicitação existente", async () => {
    const created = (await request(app).post("/direitos").send(validDireito))
      .body;
    const res = await request(app)
      .put(`/direitos/${created.id}/status`)
      .send({ status: "em_analise", resposta: "Em verificação" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("em_analise");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// INCIDENTES
// ════════════════════════════════════════════════════════════════════════════

const validIncidente = {
  titulo: "Vazamento de banco de dados de clientes",
  tipo: "acesso_nao_autorizado",
  severidade: "alta",
  titularesAfetadosEstimado: 500,
  categoriasEnvolvidas: ["identificacao", "contato"],
  descricao: "Acesso não autorizado detectado nos logs de auditoria às 14:30",
};

describe("lgpdRoutes — incidentes", () => {
  it("GET /incidentes — retorna lista", async () => {
    const res = await request(app).get("/incidentes");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.incidentes)).toBe(true);
  });

  it("GET /incidentes/abertos — retorna lista", async () => {
    const res = await request(app).get("/incidentes/abertos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.incidentes)).toBe(true);
  });

  it("GET /incidentes/prazos-vencidos — retorna lista", async () => {
    const res = await request(app).get("/incidentes/prazos-vencidos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.incidentes)).toBe(true);
  });

  it("POST /incidentes — cria incidente válido", async () => {
    const res = await request(app).post("/incidentes").send(validIncidente);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.severidade).toBe("alta");
  });

  it("POST /incidentes — 400 sem titulo", async () => {
    const { titulo: _, ...body } = validIncidente;
    const res = await request(app).post("/incidentes").send(body);
    expect(res.status).toBe(400);
  });

  it("POST /incidentes — 400 tipo inválido", async () => {
    const res = await request(app)
      .post("/incidentes")
      .send({ ...validIncidente, tipo: "hack" });
    expect(res.status).toBe(400);
  });

  it("POST /incidentes — 400 severidade inválida", async () => {
    const res = await request(app)
      .post("/incidentes")
      .send({ ...validIncidente, severidade: "extrema" });
    expect(res.status).toBe(400);
  });

  it("GET /incidentes/:id — 404 para id inexistente", async () => {
    const res = await request(app).get("/incidentes/nao-existe");
    expect(res.status).toBe(404);
  });

  it("GET /incidentes/:id — retorna incidente criado", async () => {
    const created = (
      await request(app).post("/incidentes").send(validIncidente)
    ).body;
    const res = await request(app).get(`/incidentes/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("PUT /incidentes/:id/etapa — 400 sem etapa", async () => {
    const res = await request(app).put("/incidentes/algum-id/etapa").send({});
    expect(res.status).toBe(400);
  });

  it("PUT /incidentes/:id/etapa — 404 para id inexistente", async () => {
    const res = await request(app)
      .put("/incidentes/nao-existe/etapa")
      .send({ etapa: "deteccao_triagem" });
    expect(res.status).toBe(404);
  });

  it("PUT /incidentes/:id/etapa — conclui etapa de incidente", async () => {
    const created = (
      await request(app).post("/incidentes").send(validIncidente)
    ).body;
    const res = await request(app)
      .put(`/incidentes/${created.id}/etapa`)
      .send({
        etapa: "deteccao_triagem",
        evidencia: "Log de acesso capturado",
      });
    expect(res.status).toBe(200);
  });
});
