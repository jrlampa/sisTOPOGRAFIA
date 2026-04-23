import request from "supertest";
import app from "../app.js";
import { AssinaturaNuvemService } from "../services/assinaturaNuvemService.js";

const BASE = "/api/assinatura-nuvem";

beforeEach(() => AssinaturaNuvemService._reset());

describe("assinaturaNuvemRoutes", () => {
  it("POST /lotes cria lote", async () => {
    const res = await request(app).post(`${BASE}/lotes`).send({
      tenantId: "t1",
      projetoId: "p1",
      provedor: "birdid",
      solicitadoPor: "Ana Lima",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("asn-1");
    expect(res.body.status).toBe("preparado");
  });

  it("POST /lotes/:id/documentos adiciona documento", async () => {
    await request(app)
      .post(`${BASE}/lotes`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        provedor: "birdid",
        solicitadoPor: "Ana Lima",
      });
    const res = await request(app)
      .post(`${BASE}/lotes/asn-1/documentos`)
      .send({ nomeArquivo: "doc1.pdf", conteudo: "conteudo" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ad-1");
  });

  it("POST /lotes/:id/enviar envia lote", async () => {
    await request(app)
      .post(`${BASE}/lotes`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        provedor: "birdid",
        solicitadoPor: "Ana Lima",
      });
    await request(app)
      .post(`${BASE}/lotes/asn-1/documentos`)
      .send({ nomeArquivo: "doc1.pdf", conteudo: "conteudo" });
    const res = await request(app).post(`${BASE}/lotes/asn-1/enviar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("enviado");
  });

  it("POST /lotes/:id/registrar-assinatura marca assinado", async () => {
    await request(app)
      .post(`${BASE}/lotes`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        provedor: "birdid",
        solicitadoPor: "Ana Lima",
      });
    await request(app)
      .post(`${BASE}/lotes/asn-1/documentos`)
      .send({ nomeArquivo: "doc1.pdf", conteudo: "conteudo" });
    await request(app).post(`${BASE}/lotes/asn-1/enviar`);
    const res = await request(app)
      .post(`${BASE}/lotes/asn-1/registrar-assinatura`)
      .send({ documentoId: "ad-1", status: "assinado" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("assinado");
  });

  it("POST /lotes/:id/cancelar cancela lote não assinado", async () => {
    await request(app)
      .post(`${BASE}/lotes`)
      .send({
        tenantId: "t1",
        projetoId: "p1",
        provedor: "safeid",
        solicitadoPor: "Ana Lima",
      });
    const res = await request(app).post(`${BASE}/lotes/asn-1/cancelar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelado");
  });

  it("GET /provedores retorna catálogo", async () => {
    const res = await request(app).get(`${BASE}/provedores`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("birdid");
    expect(res.body).toContain("safeid");
  });
});
