import request from "supertest";
import app from "../app.js";
import { PerdasNaoTecnicasService } from "../services/perdasNaoTecnicasService.js";

beforeEach(() => {
  PerdasNaoTecnicasService._reset();
});

const baseUrl = "/api/perdas-nao-tecnicas";

describe("PerdasNaoTecnicas — Monitoramentos CRUD", () => {
  it("cria monitoramento com sucesso (201)", async () => {
    const res = await request(app).post(`${baseUrl}/monitoramentos`).send({
      nome: "Rede Urbana Sul",
      tenantId: "tenant-test",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("pnt-1");
    expect(res.body.status).toBe("ativo");
  });

  it("rejeita criação sem nome (400)", async () => {
    const res = await request(app).post(`${baseUrl}/monitoramentos`).send({
      tenantId: "tenant-test",
    });
    expect(res.status).toBe(400);
  });

  it("lista monitoramentos por tenantId", async () => {
    await request(app).post(`${baseUrl}/monitoramentos`).send({ nome: "AA", tenantId: "t1" });
    await request(app).post(`${baseUrl}/monitoramentos`).send({ nome: "BB", tenantId: "t2" });
    const res = await request(app).get(`${baseUrl}/monitoramentos?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("exige tenantId no GET lista (400)", async () => {
    const res = await request(app).get(`${baseUrl}/monitoramentos`);
    expect(res.status).toBe(400);
  });

  it("obtém monitoramento por ID", async () => {
    await request(app).post(`${baseUrl}/monitoramentos`).send({ nome: "CC", tenantId: "t1" });
    const res = await request(app).get(`${baseUrl}/monitoramentos/pnt-1`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("pnt-1");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app).get(`${baseUrl}/monitoramentos/nao-existe`);
    expect(res.status).toBe(404);
  });
});

describe("PerdasNaoTecnicas — Pontos de Medição", () => {
  beforeEach(async () => {
    await request(app).post(`${baseUrl}/monitoramentos`).send({ nome: "Mon Teste", tenantId: "t1" });
  });

  it("adiciona ponto de medição (201)", async () => {
    const res = await request(app).post(`${baseUrl}/monitoramentos/pnt-1/pontos`).send({
      codigo: "UC-001",
      energiaInjetadaKwh: 10000,
      energiaFaturadaKwh: 8500,
      energiaPerdidasTecnicasKwh: 500,
      periodoInicio: "2024-01-01",
      periodoFim: "2024-01-31",
    });
    expect(res.status).toBe(201);
    expect(res.body.pontosMedicao).toHaveLength(1);
  });

  it("rejeita ponto com energiaInjetada zero (400)", async () => {
    const res = await request(app).post(`${baseUrl}/monitoramentos/pnt-1/pontos`).send({
      codigo: "UC-002",
      energiaInjetadaKwh: 0,
      energiaFaturadaKwh: 0,
      periodoInicio: "2024-01-01",
      periodoFim: "2024-01-31",
    });
    expect(res.status).toBe(400);
  });
});

describe("PerdasNaoTecnicas — Cálculo", () => {
  beforeEach(async () => {
    await request(app).post(`${baseUrl}/monitoramentos`).send({ nome: "Mon", tenantId: "t1" });
    await request(app).post(`${baseUrl}/monitoramentos/pnt-1/pontos`).send({
      codigo: "UC-001",
      energiaInjetadaKwh: 10000,
      energiaFaturadaKwh: 8500,
      energiaPerdidasTecnicasKwh: 500,
      periodoInicio: "2024-01-01",
      periodoFim: "2024-01-31",
    });
  });

  it("calcula perdas e retorna nivelAlerta", async () => {
    const res = await request(app).post(`${baseUrl}/monitoramentos/pnt-1/calcular`);
    expect(res.status).toBe(200);
    expect(res.body.resultado).toBeDefined();
    expect(typeof res.body.resultado.indicePerdasNaoTecnicasPct).toBe("number");
    expect(["normal", "atencao", "critico"]).toContain(res.body.resultado.nivelAlerta);
    expect(res.body.resultado.hashIntegridade).toHaveLength(64);
  });

  it("retorna 422 ao calcular sem pontos", async () => {
    await request(app).post(`${baseUrl}/monitoramentos`).send({ nome: "Vazio", tenantId: "t1" });
    const res = await request(app).post(`${baseUrl}/monitoramentos/pnt-2/calcular`);
    expect(res.status).toBe(422);
  });

  it("registra ocorrência categorizada e inclui na distribuição", async () => {
    await request(app).post(`${baseUrl}/monitoramentos/pnt-1/ocorrencias`).send({
      categoria: "fraude_medicao",
      kwh: 200,
    });
    const res = await request(app).post(`${baseUrl}/monitoramentos/pnt-1/calcular`);
    expect(res.status).toBe(200);
    expect(res.body.resultado.distribuicaoPorCategoria.fraude_medicao).toBe(200);
  });

  it("encerra monitoramento com sucesso", async () => {
    const res = await request(app).post(`${baseUrl}/monitoramentos/pnt-1/encerrar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("encerrado");
  });
});

describe("PerdasNaoTecnicas — Categorias", () => {
  it("lista categorias disponíveis", async () => {
    const res = await request(app).get(`${baseUrl}/categorias`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain("fraude_medicao");
  });
});
