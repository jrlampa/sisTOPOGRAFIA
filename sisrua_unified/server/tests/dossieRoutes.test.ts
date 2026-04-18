/**
 * dossieRoutes.test.ts
 *
 * Testes para /api/dossie (dossieRoutes).
 * Serviço em memória — sem mock de banco.
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

const validDossie = {
  cicloReferencia: "2026-CICLO01",
  distribuidora: "Distribuidora Teste SA",
  cnpj: "12.345.678/0001-90",
  responsavelTecnico: "Engenheiro Responsável",
  prazoEntregaISO: "2026-06-30T23:59:59.000Z",
  autor: "admin",
};

beforeAll(async () => {
  const mod = await import("../routes/dossieRoutes.js");
  app = express();
  app.use(express.json());
  app.use("/", mod.default);
});

describe("dossieRoutes — dossiês", () => {
  it("GET / — retorna lista de dossiês", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.dossies)).toBe(true);
  });

  it("POST / — cria dossiê com dados válidos", async () => {
    const res = await request(app).post("/").send(validDossie);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.cicloReferencia).toBe(validDossie.cicloReferencia);
  });

  it("POST / — 400 sem cicloReferencia", async () => {
    const { cicloReferencia: _, ...body } = validDossie;
    const res = await request(app).post("/").send(body);
    expect(res.status).toBe(400);
  });

  it("POST / — 400 CNPJ inválido", async () => {
    const res = await request(app)
      .post("/")
      .send({ ...validDossie, cnpj: "00000000000000" });
    expect(res.status).toBe(400);
  });

  it("POST / — 400 prazoEntregaISO não é ISO 8601", async () => {
    const res = await request(app)
      .post("/")
      .send({ ...validDossie, prazoEntregaISO: "30/06/2026" });
    expect(res.status).toBe(400);
  });

  it("GET /:id — 404 para id inexistente", async () => {
    const res = await request(app).get("/nao-existe");
    expect(res.status).toBe(404);
  });

  it("GET /:id — retorna dossiê criado", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app).get(`/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });
});

describe("dossieRoutes — validação BDGD", () => {
  const bdgdReport = {
    generatedAt: new Date().toISOString(),
    aneelSpec: "BDGD-ANEEL-2024",
    layers: [
      {
        layer: "UCBT",
        description: "Unidades Consumidoras BT",
        totalRecords: 1000,
        validRecords: 980,
        issues: [],
        conformant: true,
      },
    ],
    totals: {
      layersChecked: 1,
      layersConformant: 1,
      totalRecords: 1000,
      totalIssues: 0,
      errors: 0,
      warnings: 0,
    },
    conformant: true,
  };

  it("POST /:id/validacao — 404 para dossiê inexistente", async () => {
    const res = await request(app)
      .post("/nao-existe/validacao")
      .send({ report: bdgdReport, autor: "analista" });
    expect(res.status).toBe(404);
  });

  it("POST /:id/validacao — 400 sem report", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app).post(`/${created.id}/validacao`).send({});
    expect(res.status).toBe(400);
  });

  it("POST /:id/validacao — vincula relatório BDGD", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app)
      .post(`/${created.id}/validacao`)
      .send({ report: bdgdReport, autor: "analista" });
    expect(res.status).toBe(200);
  });
});

describe("dossieRoutes — artefatos", () => {
  const validArtefato = {
    nome: "shapefile_postes_sp.zip",
    tipo: "shapefile",
    descricao: "Shapefile de postes da capital paulista",
    conteudo: "UEsDBBQAAAAI...",
    camadasCobertas: ["EQSE", "UGBT"],
    autor: "engenheiro1",
  };

  it("POST /:id/artefatos — 400 sem nome", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const { nome: _, ...body } = validArtefato;
    const res = await request(app).post(`/${created.id}/artefatos`).send(body);
    expect(res.status).toBe(400);
  });

  it("POST /:id/artefatos — 404 para dossiê inexistente", async () => {
    const res = await request(app)
      .post("/nao-existe/artefatos")
      .send(validArtefato);
    expect(res.status).toBe(404);
  });

  it("POST /:id/artefatos — adiciona artefato com hash", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app)
      .post(`/${created.id}/artefatos`)
      .send(validArtefato);
    expect(res.status).toBe(201);
    expect(res.body.artefatos.length).toBeGreaterThan(0);
    expect(res.body.artefatos[0].sha256).toBeDefined();
  });
});

describe("dossieRoutes — submissão e arquivamento", () => {
  it("POST /:id/submissao — 404 para dossiê inexistente", async () => {
    const res = await request(app)
      .post("/nao-existe/submissao")
      .send({ protocoloAneel: "PROT-2026-001", autor: "admin" });
    expect(res.status).toBe(404);
  });

  it("POST /:id/submissao — 400 sem protocoloAneel", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app)
      .post(`/${created.id}/submissao`)
      .send({ autor: "admin" });
    expect(res.status).toBe(400);
  });

  it("POST /:id/submissao — registra submissão", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app)
      .post(`/${created.id}/submissao`)
      .send({ protocoloAneel: "PROT-2026-001", autor: "admin" });
    expect(res.status).toBe(200);
  });

  it("POST /:id/arquivar — 400 sem autor", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app).post(`/${created.id}/arquivar`).send({});
    expect(res.status).toBe(400);
  });

  it("POST /:id/arquivar — 404 para id inexistente", async () => {
    const res = await request(app)
      .post("/nao-existe/arquivar")
      .send({ autor: "admin" });
    expect(res.status).toBe(404);
  });

  it("POST /:id/arquivar — arquiva dossiê", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app)
      .post(`/${created.id}/arquivar`)
      .send({ autor: "admin" });
    expect(res.status).toBe(200);
  });
});

describe("dossieRoutes — exportação e integridade", () => {
  it("GET /:id/exportar — 404 para dossiê inexistente", async () => {
    const res = await request(app).get("/nao-existe/exportar");
    expect(res.status).toBe(404);
  });

  it("GET /:id/exportar — exporta pacote com hash", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const res = await request(app).get(`/${created.id}/exportar`);
    expect(res.status).toBe(200);
    expect(res.body.integrityHash).toBeDefined();
  });

  it("POST /verificar-integridade — 400 sem pacote", async () => {
    const res = await request(app).post("/verificar-integridade").send({});
    expect(res.status).toBe(400);
  });

  it("POST /verificar-integridade — verifica pacote exportado", async () => {
    const created = (await request(app).post("/").send(validDossie)).body;
    const exported = (await request(app).get(`/${created.id}/exportar`)).body;
    const res = await request(app)
      .post("/verificar-integridade")
      .send({ pacote: exported });
    expect(res.status).toBe(200);
    expect(typeof res.body.integro).toBe("boolean");
  });
});
