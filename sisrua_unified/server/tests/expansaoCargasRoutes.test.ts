import request from "supertest";
import app from "../app.js";
import { ExpansaoCargasService } from "../services/expansaoCargasService.js";

beforeEach(() => {
  ExpansaoCargasService._reset();
});

const baseUrl = "/api/expansao-cargas";

describe("ExpansaoCargas — Simulações CRUD", () => {
  it("cria simulação com sucesso (201)", async () => {
    const res = await request(app).post(`${baseUrl}/simulacoes`).send({
      nome: "Loteamento Vila Nova",
      tenantId: "tenant-1",
      transformadorKva: 75,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("sim-1");
    expect(res.body.status).toBe("rascunho");
    expect(res.body.transformadorKva).toBe(75);
  });

  it("rejeita criação com transformadorKva zero (400)", async () => {
    const res = await request(app).post(`${baseUrl}/simulacoes`).send({
      nome: "Teste",
      tenantId: "t1",
      transformadorKva: 0,
    });
    expect(res.status).toBe(400);
  });

  it("lista simulações por tenantId", async () => {
    await request(app).post(`${baseUrl}/simulacoes`).send({ nome: "S1", tenantId: "t1", transformadorKva: 45 });
    await request(app).post(`${baseUrl}/simulacoes`).send({ nome: "S2", tenantId: "t2", transformadorKva: 75 });
    const res = await request(app).get(`${baseUrl}/simulacoes?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("exige tenantId no GET lista (400)", async () => {
    const res = await request(app).get(`${baseUrl}/simulacoes`);
    expect(res.status).toBe(400);
  });

  it("obtém simulação por ID", async () => {
    await request(app).post(`${baseUrl}/simulacoes`).send({ nome: "S1", tenantId: "t1", transformadorKva: 45 });
    const res = await request(app).get(`${baseUrl}/simulacoes/sim-1`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("sim-1");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app).get(`${baseUrl}/simulacoes/nao-existe`);
    expect(res.status).toBe(404);
  });
});

describe("ExpansaoCargas — Cargas", () => {
  beforeEach(async () => {
    await request(app).post(`${baseUrl}/simulacoes`).send({ nome: "Sim", tenantId: "t1", transformadorKva: 75 });
  });

  it("adiciona carga existente (201)", async () => {
    const res = await request(app).post(`${baseUrl}/simulacoes/sim-1/cargas-existentes`).send({
      descricao: "Residências atuais",
      potenciaKva: 20,
    });
    expect(res.status).toBe(201);
    expect(res.body.cargasExistentes).toHaveLength(1);
  });

  it("adiciona nova carga (201)", async () => {
    const res = await request(app).post(`${baseUrl}/simulacoes/sim-1/novas-cargas`).send({
      descricao: "Loteamento A",
      tipoCarga: "residencial_padrao",
      potenciaKva: 3,
      quantidade: 50,
    });
    expect(res.status).toBe(201);
    expect(res.body.novasCargas).toHaveLength(1);
  });

  it("rejeita tipoCarga inválido (400)", async () => {
    const res = await request(app).post(`${baseUrl}/simulacoes/sim-1/novas-cargas`).send({
      descricao: "Teste",
      tipoCarga: "tipo_invalido",
      potenciaKva: 5,
      quantidade: 10,
    });
    expect(res.status).toBe(400);
  });
});

describe("ExpansaoCargas — Simulação e Aprovação", () => {
  beforeEach(async () => {
    await request(app).post(`${baseUrl}/simulacoes`).send({ nome: "Sim", tenantId: "t1", transformadorKva: 75 });
    await request(app).post(`${baseUrl}/simulacoes/sim-1/cargas-existentes`).send({ descricao: "Cargas atuais", potenciaKva: 20 });
    await request(app).post(`${baseUrl}/simulacoes/sim-1/novas-cargas`).send({
      descricao: "Novo loteamento",
      tipoCarga: "residencial_padrao",
      potenciaKva: 3,
      quantidade: 10,
    });
  });

  it("simula e retorna resultado com viabilidade", async () => {
    const res = await request(app).post(`${baseUrl}/simulacoes/sim-1/simular`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("simulado");
    expect(res.body.resultado).toBeDefined();
    expect(typeof res.body.resultado.viavel).toBe("boolean");
    expect(typeof res.body.resultado.carregamentoPrevistoPct).toBe("number");
    expect(res.body.resultado.recomendacao).toBeTruthy();
  });

  it("detecta sobrecarga com carga acima do limite", async () => {
    await request(app).post(`${baseUrl}/simulacoes/sim-1/novas-cargas`).send({
      descricao: "Grande industria",
      tipoCarga: "industrial_pequeno",
      potenciaKva: 100,
      quantidade: 5,
    });
    const res = await request(app).post(`${baseUrl}/simulacoes/sim-1/simular`);
    expect(res.status).toBe(200);
    expect(res.body.resultado.viavel).toBe(false);
  });

  it("aprova simulação calculada", async () => {
    await request(app).post(`${baseUrl}/simulacoes/sim-1/simular`);
    const res = await request(app).post(`${baseUrl}/simulacoes/sim-1/aprovar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
  });

  it("rejeita aprovação sem simulação prévia (422)", async () => {
    await request(app).post(`${baseUrl}/simulacoes`).send({ nome: "Nova", tenantId: "t1", transformadorKva: 45 });
    const res = await request(app).post(`${baseUrl}/simulacoes/sim-2/aprovar`);
    expect(res.status).toBe(422);
  });
});
