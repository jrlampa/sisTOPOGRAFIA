/**
 * Testes T2-67 — Ciclo As-Built Mobile
 */

import request from "supertest";
import app from "../app.js";
import { AsBuiltMobileService } from "../services/asBuiltMobileService.js";

const BASE = "/api/as-built";

beforeEach(() => AsBuiltMobileService._reset());

const registroPayload = {
  tenantId: "t1",
  projetoId: "proj-001",
  nomeProjeto: "Rede MT Bairro Norte",
  responsavelCampo: "Técnico de Campo",
  data: "2025-01-15",
  observacoesCampo: "Condições climáticas adversas durante medição",
};

const desvioPayload = {
  assetId: "at-001",
  tipoDesvio: "posicao",
  descricao: "Poste deslocado 1,5m em relação ao projeto",
  valorOriginal: "Coord X=100.0",
  valorExecutado: "Coord X=101.5",
  impacto: "medio",
};

describe("POST /registros", () => {
  it("cria registro As-Built com status em_campo", async () => {
    const res = await request(app).post(`${BASE}/registros`).send(registroPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ab-1");
    expect(res.body.status).toBe("em_campo");
    expect(res.body.desvios).toHaveLength(0);
  });

  it("rejeita sem tenantId", async () => {
    const res = await request(app)
      .post(`${BASE}/registros`)
      .send({ ...registroPayload, tenantId: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /registros", () => {
  it("lista vazia", async () => {
    const res = await request(app).get(`${BASE}/registros`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filtra por tenantId", async () => {
    await request(app).post(`${BASE}/registros`).send({ ...registroPayload, tenantId: "tA" });
    await request(app).post(`${BASE}/registros`).send({ ...registroPayload, tenantId: "tB" });
    const res = await request(app).get(`${BASE}/registros?tenantId=tA`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tenantId).toBe("tA");
  });
});

describe("GET /registros/:id", () => {
  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app).get(`${BASE}/registros/ab-999`);
    expect(res.status).toBe(404);
  });

  it("retorna registro existente", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    const res = await request(app).get(`${BASE}/registros/ab-1`);
    expect(res.status).toBe(200);
    expect(res.body.nomeProjeto).toBe("Rede MT Bairro Norte");
  });
});

describe("POST /registros/:id/desvios", () => {
  it("adiciona desvio ao registro", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    const res = await request(app)
      .post(`${BASE}/registros/ab-1/desvios`)
      .send(desvioPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("dv-1");
    expect(res.body.tipoDesvio).toBe("posicao");
    expect(res.body.impacto).toBe("medio");
    expect(res.body.statusDesvio).toBe("pendente");
  });

  it("rejeita desvio para registro inexistente", async () => {
    const res = await request(app)
      .post(`${BASE}/registros/ab-999/desvios`)
      .send(desvioPayload);
    expect(res.status).toBe(422);
  });
});

describe("POST /registros/:id/sincronizar", () => {
  it("sincroniza registro com desvios", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    await request(app).post(`${BASE}/registros/ab-1/desvios`).send(desvioPayload);
    const res = await request(app).post(`${BASE}/registros/ab-1/sincronizar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("sincronizado");
  });

  it("rejeita sincronização sem desvios", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    const res = await request(app).post(`${BASE}/registros/ab-1/sincronizar`);
    expect(res.status).toBe(422);
  });
});

describe("POST /registros/:id/aprovar", () => {
  it("aprova registro sincronizado com hash de integridade", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    await request(app).post(`${BASE}/registros/ab-1/desvios`).send(desvioPayload);
    await request(app).post(`${BASE}/registros/ab-1/sincronizar`);
    const res = await request(app)
      .post(`${BASE}/registros/ab-1/aprovar`)
      .send({ aprovadoPor: "Engenheiro Sênior" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
    expect(res.body.aprovadoPor).toBe("Engenheiro Sênior");
    expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.aprovadoEm).toBeDefined();
  });

  it("rejeita aprovação de registro não sincronizado", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    const res = await request(app)
      .post(`${BASE}/registros/ab-1/aprovar`)
      .send({ aprovadoPor: "Engenheiro" });
    expect(res.status).toBe(422);
  });
});

describe("POST /registros/:id/rejeitar", () => {
  it("rejeita registro com motivo", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    await request(app).post(`${BASE}/registros/ab-1/desvios`).send(desvioPayload);
    const res = await request(app)
      .post(`${BASE}/registros/ab-1/rejeitar`)
      .send({ motivo: "Desvios acima do tolerado pela norma técnica" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejeitado");
    expect(res.body.motivoRejeicao).toBe("Desvios acima do tolerado pela norma técnica");
  });

  it("rejeita sem motivo", async () => {
    await request(app).post(`${BASE}/registros`).send(registroPayload);
    const res = await request(app)
      .post(`${BASE}/registros/ab-1/rejeitar`)
      .send({ motivo: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /tipos-desvio", () => {
  it("lista tipos de desvio disponíveis", async () => {
    const res = await request(app).get(`${BASE}/tipos-desvio`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("posicao");
    expect(res.body).toContain("altura");
  });
});
