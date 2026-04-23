import request from "supertest";
import app from "../app.js";
import { AcervoGedService } from "../services/acervoGedService.js";

const BASE = "/api/acervo-ged";

beforeEach(() => AcervoGedService._reset());

describe("acervoGedRoutes", () => {
  it("POST /documentos cria documento", async () => {
    const res = await request(app).post(`${BASE}/documentos`).send({
      tenantId: "t1",
      projetoId: "p1",
      titulo: "Memorial Técnico",
      tipoDocumento: "memorial_descritivo",
      classificacaoSigilo: "restrito",
      retencaoAnos: 10,
      conteudo: "conteudo tecnico",
      criadoPor: "Engenheiro A",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("gd-1");
    expect(res.body.status).toBe("rascunho");
  });

  it("GET /documentos lista e filtra", async () => {
    await request(app)
      .post(`${BASE}/documentos`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        titulo: "Doc1",
        tipoDocumento: "laudo",
        classificacaoSigilo: "publico",
        retencaoAnos: 5,
        conteudo: "abc",
        criadoPor: "Aaa",
      });
    await request(app)
      .post(`${BASE}/documentos`)
      .send({
        tenantId: "t2",
        projetoId: "p2",
        titulo: "Doc2",
        tipoDocumento: "laudo",
        classificacaoSigilo: "publico",
        retencaoAnos: 5,
        conteudo: "abc",
        criadoPor: "Bbb",
      });
    const res = await request(app).get(`${BASE}/documentos?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /documentos/:id/enviar-revisao muda status", async () => {
    await request(app)
      .post(`${BASE}/documentos`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        titulo: "Doc1",
        tipoDocumento: "laudo",
        classificacaoSigilo: "publico",
        retencaoAnos: 5,
        conteudo: "abc",
        criadoPor: "Aaa",
      });
    const res = await request(app).post(
      `${BASE}/documentos/gd-1/enviar-revisao`,
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("em_revisao");
  });

  it("POST /documentos/:id/revisoes cria revisão", async () => {
    await request(app)
      .post(`${BASE}/documentos`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        titulo: "Doc1",
        tipoDocumento: "laudo",
        classificacaoSigilo: "publico",
        retencaoAnos: 5,
        conteudo: "abc",
        criadoPor: "Aaa",
      });
    await request(app).post(`${BASE}/documentos/gd-1/enviar-revisao`);
    const res = await request(app)
      .post(`${BASE}/documentos/gd-1/revisoes`)
      .send({ revisadoPor: "Revisor", observacao: "ok" });
    expect(res.status).toBe(400);
  });

  it("POST /documentos/:id/revisoes cria revisão com observacao válida", async () => {
    await request(app)
      .post(`${BASE}/documentos`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        titulo: "Doc1",
        tipoDocumento: "laudo",
        classificacaoSigilo: "publico",
        retencaoAnos: 5,
        conteudo: "abc",
        criadoPor: "Aaa",
      });
    await request(app).post(`${BASE}/documentos/gd-1/enviar-revisao`);
    const res = await request(app)
      .post(`${BASE}/documentos/gd-1/revisoes`)
      .send({ revisadoPor: "Revisor", observacao: "Revisão técnica ok" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("rv-1");
  });

  it("POST /documentos/:id/aprovar aprova", async () => {
    await request(app)
      .post(`${BASE}/documentos`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        titulo: "Doc1",
        tipoDocumento: "laudo",
        classificacaoSigilo: "publico",
        retencaoAnos: 5,
        conteudo: "abc",
        criadoPor: "Aaa",
      });
    await request(app).post(`${BASE}/documentos/gd-1/enviar-revisao`);
    const res = await request(app).post(`${BASE}/documentos/gd-1/aprovar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
  });

  it("POST /documentos/:id/arquivar arquiva", async () => {
    await request(app)
      .post(`${BASE}/documentos`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        titulo: "Doc1",
        tipoDocumento: "laudo",
        classificacaoSigilo: "publico",
        retencaoAnos: 5,
        conteudo: "abc",
        criadoPor: "Aaa",
      });
    const res = await request(app).post(`${BASE}/documentos/gd-1/arquivar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("arquivado");
  });

  it("GET /tipos-documento retorna catálogo", async () => {
    const res = await request(app).get(`${BASE}/tipos-documento`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("art");
  });
});
