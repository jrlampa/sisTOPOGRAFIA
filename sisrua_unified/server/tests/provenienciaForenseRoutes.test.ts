import request from "supertest";
import app from "../app.js";
import { ProvenienciaForenseService } from "../services/provenienciaForenseService.js";

const BASE = "/api/proveniencia-forense";

beforeEach(() => ProvenienciaForenseService._reset());

describe("provenienciaForenseRoutes", () => {
  it("POST /dossies cria dossiê", async () => {
    const res = await request(app).post(`${BASE}/dossies`).send({ tenantId: "t1", projetoId: "p1", titulo: "Dossie Forense" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("pf-1");
  });

  it("GET /dossies filtra por tenant", async () => {
    await request(app).post(`${BASE}/dossies`).send({ tenantId: "t1", projetoId: "p1", titulo: "Dossie A" });
    await request(app).post(`${BASE}/dossies`).send({ tenantId: "t2", projetoId: "p2", titulo: "Dossie B" });
    const res = await request(app).get(`${BASE}/dossies?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /dossies/:id/artefatos adiciona artefato", async () => {
    await request(app).post(`${BASE}/dossies`).send({ tenantId: "t1", projetoId: "p1", titulo: "Dossie A" });
    const res = await request(app).post(`${BASE}/dossies/pf-1/artefatos`).send({ nomeArquivo: "arquivo.pdf", mimeType: "application/pdf", tamanhoBytes: 1000, conteudo: "conteudo" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("af-1");
    expect(res.body.hashSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("POST /dossies/:id/selo-temporal sela dossiê", async () => {
    await request(app).post(`${BASE}/dossies`).send({ tenantId: "t1", projetoId: "p1", titulo: "Dossie A" });
    await request(app).post(`${BASE}/dossies/pf-1/artefatos`).send({ nomeArquivo: "arquivo.pdf", mimeType: "application/pdf", tamanhoBytes: 1000, conteudo: "conteudo" });
    const res = await request(app).post(`${BASE}/dossies/pf-1/selo-temporal`).send({ provedor: "rfc3161_homologado" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("selado");
    expect(res.body.seloTemporal.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("POST /dossies/:id/assinar-icp assina dossiê selado", async () => {
    await request(app).post(`${BASE}/dossies`).send({ tenantId: "t1", projetoId: "p1", titulo: "Dossie A" });
    await request(app).post(`${BASE}/dossies/pf-1/artefatos`).send({ nomeArquivo: "arquivo.pdf", mimeType: "application/pdf", tamanhoBytes: 1000, conteudo: "conteudo" });
    await request(app).post(`${BASE}/dossies/pf-1/selo-temporal`).send({ provedor: "rfc3161_homologado" });
    const res = await request(app).post(`${BASE}/dossies/pf-1/assinar-icp`).send({ certificadoSerial: "SERIAL-12345" });
    expect(res.status).toBe(200);
    expect(res.body.assinaturaIcpBrasil).toMatch(/^[a-f0-9]{64}$/);
  });

  it("GET /dossies/:id/verificar-integridade retorna íntegro", async () => {
    await request(app).post(`${BASE}/dossies`).send({ tenantId: "t1", projetoId: "p1", titulo: "Dossie A" });
    await request(app).post(`${BASE}/dossies/pf-1/artefatos`).send({ nomeArquivo: "arquivo.pdf", mimeType: "application/pdf", tamanhoBytes: 1000, conteudo: "conteudo" });
    await request(app).post(`${BASE}/dossies/pf-1/selo-temporal`).send({ provedor: "rfc3161_homologado" });
    const res = await request(app).get(`${BASE}/dossies/pf-1/verificar-integridade`);
    expect(res.status).toBe(200);
    expect(res.body.integro).toBe(true);
  });

  it("GET /provedores-rfc3161 retorna catálogo", async () => {
    const res = await request(app).get(`${BASE}/provedores-rfc3161`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("rfc3161_homologado");
  });
});
