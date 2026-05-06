/**
 * complianceRoutes.test.ts — Items 97+98 [T1]
 * eMAG 3.1 Certification + ANEEL Provenance Dossier
 */

import request from "supertest";
import app from "../app.js";
import { EmagCertService } from "../services/emagCertService.js";
import { AneelProvenanceService } from "../services/aneelProvenanceService.js";

beforeEach(() => {
  EmagCertService._reset();
  AneelProvenanceService._reset();
});

describe("eMAG 3.1 Routes (97)", () => {
  it("GET /api/compliance/emag/requisitos — deve listar todos os requisitos", async () => {
    const res = await request(app).get("/api/compliance/emag/requisitos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("nivel");
  });

  it("GET /api/compliance/emag/requisitos?secao=... — deve filtrar por seção", async () => {
    const res = await request(app).get("/api/compliance/emag/requisitos?secao=1_marcacao");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((r: { secao: string }) => expect(r.secao).toBe("1_marcacao"));
  });

  it("POST /api/compliance/emag/inspecoes — deve criar inspeção", async () => {
    const res = await request(app)
      .post("/api/compliance/emag/inspecoes")
      .send({ titulo: "Inspeção v2.0", versaoSistema: "2.0.1", responsavel: "acessibilidade@empresa.com" });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^emag-/);
    expect(res.body.certificadoEmitido).toBe(false);
  });

  it("POST /api/compliance/emag/inspecoes — 400 para payload inválido", async () => {
    const res = await request(app).post("/api/compliance/emag/inspecoes").send({ titulo: "" });
    expect(res.status).toBe(400);
  });

  it("POST /api/compliance/emag/inspecoes/:id/evidencias — deve registrar evidência", async () => {
    const { body: insp } = await request(app).post("/api/compliance/emag/inspecoes").send({
      titulo: "I2", versaoSistema: "1.0.0", responsavel: "user@test.com",
    });
    // Obter id de requisito existente
    const { body: reqs } = await request(app).get("/api/compliance/emag/requisitos");
    const reqId = reqs[0].id;

    const res = await request(app)
      .post(`/api/compliance/emag/inspecoes/${insp.id}/evidencias`)
      .send({
        requisitoId: reqId,
        status: "conforme",
        descricao: "Todos os elementos HTML têm lang definido",
        responsavel: "user@test.com",
        artefato: "screenshot-01.png",
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("conforme");
  });

  it("POST /api/compliance/emag/inspecoes/:id/concluir — deve emitir certificado se >= 80%", async () => {
    const { body: insp } = await request(app).post("/api/compliance/emag/inspecoes").send({
      titulo: "I3", versaoSistema: "1.0.0", responsavel: "user@test.com",
    });
    const { body: reqs } = await request(app).get("/api/compliance/emag/requisitos");

    // Registrar evidências conformes para todos
    for (const req of reqs) {
      await request(app).post(`/api/compliance/emag/inspecoes/${insp.id}/evidencias`).send({
        requisitoId: req.id, status: "conforme", descricao: "Conforme", responsavel: "user@test.com",
      });
    }
    const res = await request(app).post(`/api/compliance/emag/inspecoes/${insp.id}/concluir`);
    expect(res.status).toBe(200);
    expect(res.body.percentualConformidade).toBe(100);
    expect(res.body.certificadoEmitido).toBe(true);
  });

  it("GET /api/compliance/emag/inspecoes — deve listar inspeções", async () => {
    await request(app).post("/api/compliance/emag/inspecoes").send({ titulo: "I4", versaoSistema: "1.0", responsavel: "u" });
    const res = await request(app).get("/api/compliance/emag/inspecoes");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("ANEEL Provenance Routes (98)", () => {
  it("POST /api/compliance/aneel/dossies — deve criar dossiê", async () => {
    const res = await request(app)
      .post("/api/compliance/aneel/dossies")
      .send({
        titulo: "Projeto Subestação Norte",
        projetoId: "proj-001",
        tenantId: "tenant-a",
        responsavelTecnico: "eng@empresa.com",
        creaResponsavel: "CREA-SP 123456",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^aneel-dos-/);
    expect(res.body.status).toBe("rascunho");
  });

  it("POST /api/compliance/aneel/dossies — 400 payload inválido", async () => {
    const res = await request(app).post("/api/compliance/aneel/dossies").send({ titulo: "" });
    expect(res.status).toBe(400);
  });

  it("POST /api/compliance/aneel/dossies/:id/artefatos — deve adicionar artefato com hash", async () => {
    const { body: dossie } = await request(app).post("/api/compliance/aneel/dossies").send({
      titulo: "D1", projetoId: "p1", tenantId: "t1", responsavelTecnico: "eng",
    });
    const res = await request(app)
      .post(`/api/compliance/aneel/dossies/${dossie.id}/artefatos`)
      .send({
        tipo: "dxf_projeto",
        nomeArquivo: "planta_bt.dxf",
        conteudo: "SECTION 0 ENTITIES END ",
        responsavelTecnico: "eng",
        versaoSistema: "2.1.0",
        descricao: "Planta rede BT",
      });
    expect(res.status).toBe(201);
    expect(res.body.hashSha256).toHaveLength(64);
    expect(res.body.tipo).toBe("dxf_projeto");
  });

  it("POST /api/compliance/aneel/dossies/:id/aprovar — deve aprovar e calcular hashPacote", async () => {
    const { body: d } = await request(app).post("/api/compliance/aneel/dossies").send({
      titulo: "D2", projetoId: "p2", tenantId: "t2", responsavelTecnico: "eng2",
    });
    await request(app).post(`/api/compliance/aneel/dossies/${d.id}/artefatos`).send({
      tipo: "relatorio_cqt", nomeArquivo: "cqt.pdf", conteudo: "cqt data",
      responsavelTecnico: "eng2", versaoSistema: "2.0.0",
    });
    const res = await request(app).post(`/api/compliance/aneel/dossies/${d.id}/aprovar`).send({
      conformidadeBdgd: true, conformidadeProdist: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
    expect(res.body.hashPacote).toHaveLength(64);
  });

  it("POST /api/compliance/aneel/dossies/:id/submeter — deve submeter dossiê aprovado", async () => {
    const { body: d } = await request(app).post("/api/compliance/aneel/dossies").send({
      titulo: "D3", projetoId: "p3", tenantId: "t3", responsavelTecnico: "eng3",
    });
    await request(app).post(`/api/compliance/aneel/dossies/${d.id}/artefatos`).send({
      tipo: "dxf_projeto", nomeArquivo: "proj.dxf", conteudo: "data",
      responsavelTecnico: "eng3", versaoSistema: "1.0.0",
    });
    await request(app).post(`/api/compliance/aneel/dossies/${d.id}/aprovar`).send({ conformidadeBdgd: true, conformidadeProdist: true });
    const res = await request(app).post(`/api/compliance/aneel/dossies/${d.id}/submeter`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("submetido_aneel");
    expect(res.body.submissaoAneel).toBeDefined();
  });

  it("POST /api/compliance/aneel/dossies/:id/submeter — 400 se não aprovado", async () => {
    const { body: d } = await request(app).post("/api/compliance/aneel/dossies").send({
      titulo: "D4", projetoId: "p4", tenantId: "t4", responsavelTecnico: "eng4",
    });
    const res = await request(app).post(`/api/compliance/aneel/dossies/${d.id}/submeter`);
    expect(res.status).toBe(400);
  });

  it("GET /api/compliance/aneel/dossies/:id/integridade — deve verificar hash intacto", async () => {
    const { body: d } = await request(app).post("/api/compliance/aneel/dossies").send({
      titulo: "D5", projetoId: "p5", tenantId: "t5", responsavelTecnico: "eng5",
    });
    await request(app).post(`/api/compliance/aneel/dossies/${d.id}/artefatos`).send({
      tipo: "art", nomeArquivo: "art123.pdf", conteudo: "ART data",
      responsavelTecnico: "eng5", versaoSistema: "3.0.0",
    });
    await request(app).post(`/api/compliance/aneel/dossies/${d.id}/aprovar`).send({ conformidadeBdgd: false, conformidadeProdist: true });
    const res = await request(app).get(`/api/compliance/aneel/dossies/${d.id}/integridade`);
    expect(res.status).toBe(200);
    expect(res.body.integro).toBe(true);
  });

  it("GET /api/compliance/aneel/dossies — deve listar com filtro por tenantId", async () => {
    await request(app).post("/api/compliance/aneel/dossies").send({
      titulo: "D6", projetoId: "p6", tenantId: "t-especial", responsavelTecnico: "eng6",
    });
    const res = await request(app).get("/api/compliance/aneel/dossies?tenantId=t-especial");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tenantId).toBe("t-especial");
  });
});
