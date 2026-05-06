import request from "supertest";
import app from "../app.js";
import { SpeedDraftService } from "../services/speedDraftService.js";

beforeEach(() => {
  SpeedDraftService._reset();
});

const baseUrl = "/api/speed-draft";

describe("SpeedDraft — Templates embutidos", () => {
  it("lista templates embutidos (CEMIG, COPEL, LIGHT)", async () => {
    const res = await request(app).get(`${baseUrl}/templates`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    const ids = res.body.map((t: { id: string }) => t.id);
    expect(ids).toContain("tpl-cemig-bt");
    expect(ids).toContain("tpl-copel-bt");
    expect(ids).toContain("tpl-light-bt");
  });

  it("filtra por concessionaria", async () => {
    const res = await request(app).get(`${baseUrl}/templates?concessionaria=CEMIG`);
    expect(res.status).toBe(200);
    expect(res.body.every((t: { concessionaria: string }) => t.concessionaria === "CEMIG")).toBe(true);
  });

  it("filtra por tipoRede", async () => {
    const res = await request(app).get(`${baseUrl}/templates?tipoRede=bt`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("obtém template embutido por ID", async () => {
    const res = await request(app).get(`${baseUrl}/templates/tpl-cemig-bt`);
    expect(res.status).toBe(200);
    expect(res.body.concessionaria).toBe("CEMIG");
    expect(res.body.vaoMaximoM).toBeLessThanOrEqual(40);
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app).get(`${baseUrl}/templates/nao-existe`);
    expect(res.status).toBe(404);
  });
});

describe("SpeedDraft — Criação de template personalizado", () => {
  const templateBase = {
    tenantId: "tenant-1",
    nome: "Energisa Nordeste BT",
    concessionaria: "ENERGISA",
    tipoRede: "bt",
    regiaoGeografica: "nordeste",
    tensaoNominalKv: 0.22,
    tipoPoste: "concreto",
    alturaPostePadrao: 10,
    vaoMaximoM: 40,
    tipoCondutor: "aluminio_multiplexado",
    secaoMinimaCondutorMm2: 16,
    secaoMaximaCondutorMm2: 70,
    fatorDemanda: 0.65,
    fatorCoincidencia: 0.60,
    materiaisPadrao: [
      { componente: "Cabo", especificacao: "CAA 3×25+16 mm²", unidade: "m" },
    ],
    versaoNorma: "NTE-011 (2018)",
    anoVigencia: 2018,
  };

  it("cria template personalizado (201)", async () => {
    const res = await request(app).post(`${baseUrl}/templates`).send(templateBase);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("tpl-4");
    expect(res.body.status).toBe("ativo");
    expect(res.body.concessionaria).toBe("ENERGISA");
  });

  it("rejeita vão máximo > 40 m (422)", async () => {
    const res = await request(app).post(`${baseUrl}/templates`).send({
      ...templateBase,
      vaoMaximoM: 50,
    });
    expect(res.status).toBe(400);
  });

  it("rejeita fator de demanda > 1 (400)", async () => {
    const res = await request(app).post(`${baseUrl}/templates`).send({
      ...templateBase,
      fatorDemanda: 1.5,
    });
    expect(res.status).toBe(400);
  });

  it("rejeita criação sem tenantId (400)", async () => {
    const { tenantId, ...semTenant } = templateBase;
    const res = await request(app).post(`${baseUrl}/templates`).send(semTenant);
    expect(res.status).toBe(400);
  });
});

describe("SpeedDraft — Status e Concessionárias", () => {
  it("atualiza status para obsoleto", async () => {
    const res = await request(app)
      .patch(`${baseUrl}/templates/tpl-cemig-bt/status`)
      .send({ status: "obsoleto" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("obsoleto");
  });

  it("rejeita status inválido (400)", async () => {
    const res = await request(app)
      .patch(`${baseUrl}/templates/tpl-cemig-bt/status`)
      .send({ status: "invalido" });
    expect(res.status).toBe(400);
  });

  it("lista concessionárias disponíveis", async () => {
    const res = await request(app).get(`${baseUrl}/concessionarias`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain("CEMIG");
    expect(res.body).toContain("LIGHT");
    expect(res.body).toContain("COPEL");
  });
});
