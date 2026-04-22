import request from "supertest";
import app from "../app.js";
import { LicencaSocialService } from "../services/licencaSocialService.js";

beforeEach(() => {
  LicencaSocialService._reset();
});

const baseUrl = "/api/licenca-social";

describe("LicencaSocial — Consultas CRUD", () => {
  it("cria consulta com sucesso (201)", async () => {
    const res = await request(app).post(`${baseUrl}/consultas`).send({
      nome: "Audiência Pública LT 230kV",
      tenantId: "tenant-1",
      municipio: "São Paulo",
      uf: "SP",
      tipo: "audiencia_publica",
      dataInicio: "2024-03-01",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ls-1");
    expect(res.body.status).toBe("planejado");
    expect(res.body.uf).toBe("SP");
  });

  it("rejeita UF com comprimento errado (400)", async () => {
    const res = await request(app).post(`${baseUrl}/consultas`).send({
      nome: "Reunião",
      tenantId: "t1",
      municipio: "Belo Horizonte",
      uf: "MG2",
      tipo: "reuniao_comunitaria",
      dataInicio: "2024-03-01",
    });
    expect(res.status).toBe(400);
  });

  it("rejeita tipo inválido (400)", async () => {
    const res = await request(app).post(`${baseUrl}/consultas`).send({
      nome: "Teste",
      tenantId: "t1",
      municipio: "Curitiba",
      uf: "PR",
      tipo: "tipo_invalido",
      dataInicio: "2024-03-01",
    });
    expect(res.status).toBe(400);
  });

  it("lista consultas por tenantId", async () => {
    await request(app).post(`${baseUrl}/consultas`).send({
      nome: "LT Norte", tenantId: "t1", municipio: "São Paulo", uf: "SP", tipo: "audiencia_publica", dataInicio: "2024-01-01",
    });
    await request(app).post(`${baseUrl}/consultas`).send({
      nome: "LT Sul", tenantId: "t2", municipio: "Rio de Janeiro", uf: "RJ", tipo: "consulta_publica", dataInicio: "2024-01-01",
    });
    const res = await request(app).get(`${baseUrl}/consultas?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("exige tenantId no GET lista (400)", async () => {
    const res = await request(app).get(`${baseUrl}/consultas`);
    expect(res.status).toBe(400);
  });

  it("obtém consulta por ID", async () => {
    await request(app).post(`${baseUrl}/consultas`).send({
      nome: "Consulta X", tenantId: "t1", municipio: "BH", uf: "MG", tipo: "consulta_publica", dataInicio: "2024-01-01",
    });
    const res = await request(app).get(`${baseUrl}/consultas/ls-1`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ls-1");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app).get(`${baseUrl}/consultas/nao-existe`);
    expect(res.status).toBe(404);
  });
});

describe("LicencaSocial — Fluxo de Consulta", () => {
  beforeEach(async () => {
    await request(app).post(`${baseUrl}/consultas`).send({
      nome: "Consulta Comunidade", tenantId: "t1", municipio: "Fortaleza",
      uf: "CE", tipo: "reuniao_comunitaria", dataInicio: "2024-03-01",
    });
  });

  it("inicia consulta (em_consulta)", async () => {
    const res = await request(app).post(`${baseUrl}/consultas/ls-1/iniciar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("em_consulta");
  });

  it("rejeita iniciar consulta já iniciada (422)", async () => {
    await request(app).post(`${baseUrl}/consultas/ls-1/iniciar`);
    const res = await request(app).post(`${baseUrl}/consultas/ls-1/iniciar`);
    expect(res.status).toBe(422);
  });

  it("registra manifestação favorável (201)", async () => {
    await request(app).post(`${baseUrl}/consultas/ls-1/iniciar`);
    const res = await request(app).post(`${baseUrl}/consultas/ls-1/manifestacoes`).send({
      autor: "Maria Silva",
      segmento: "comunidade_local",
      favoravel: true,
      descricao: "Apoio ao projeto de eletrificação",
    });
    expect(res.status).toBe(201);
    expect(res.body.manifestacoes).toHaveLength(1);
  });

  it("rejeita manifestação em consulta não iniciada (422)", async () => {
    const res = await request(app).post(`${baseUrl}/consultas/ls-1/manifestacoes`).send({
      autor: "João", segmento: "poder_publico", favoravel: false,
      descricao: "Preocupação com o traçado",
    });
    expect(res.status).toBe(422);
  });
});

describe("LicencaSocial — Cálculo de Resultado", () => {
  beforeEach(async () => {
    await request(app).post(`${baseUrl}/consultas`).send({
      nome: "Consulta", tenantId: "t1", municipio: "Recife", uf: "PE",
      tipo: "audiencia_publica", dataInicio: "2024-01-01",
    });
    await request(app).post(`${baseUrl}/consultas/ls-1/iniciar`);
    // 7 favoráveis, 3 contrárias → 70% → nivel alto
    for (let i = 0; i < 7; i++) {
      await request(app).post(`${baseUrl}/consultas/ls-1/manifestacoes`).send({
        autor: `Fav ${i}`, segmento: "comunidade_local", favoravel: true,
        descricao: "Texto de apoio suficiente",
      });
    }
    for (let i = 0; i < 3; i++) {
      await request(app).post(`${baseUrl}/consultas/ls-1/manifestacoes`).send({
        autor: `Cont ${i}`, segmento: "orgaos_ambientais", favoravel: false,
        descricao: "Texto de oposição suficiente",
      });
    }
  });

  it("calcula resultado com nivelAceitacao alto", async () => {
    const res = await request(app).post(`${baseUrl}/consultas/ls-1/calcular`);
    expect(res.status).toBe(200);
    expect(res.body.resultado.indiceFavoresPct).toBe(70);
    expect(res.body.resultado.nivelAceitacao).toBe("alto");
    expect(res.body.status).toBe("concluido");
  });

  it("aprova consulta com nível alto", async () => {
    await request(app).post(`${baseUrl}/consultas/ls-1/calcular`);
    const res = await request(app).post(`${baseUrl}/consultas/ls-1/aprovar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
  });

  it("reprova consulta com nível crítico (< 30%)", async () => {
    await request(app).post(`${baseUrl}/consultas`).send({
      nome: "C2", tenantId: "t1", municipio: "João Pessoa", uf: "PB",
      tipo: "consulta_publica", dataInicio: "2024-01-01",
    });
    await request(app).post(`${baseUrl}/consultas/ls-2/iniciar`);
    // 2 favoráveis, 8 contrárias → 20% → crítico
    for (let i = 0; i < 2; i++) {
      await request(app).post(`${baseUrl}/consultas/ls-2/manifestacoes`).send({
        autor: `F${i}`, segmento: "academia", favoravel: true, descricao: "Texto teste favorável",
      });
    }
    for (let i = 0; i < 8; i++) {
      await request(app).post(`${baseUrl}/consultas/ls-2/manifestacoes`).send({
        autor: `C${i}`, segmento: "comunidade_local", favoravel: false, descricao: "Texto teste contrário",
      });
    }
    await request(app).post(`${baseUrl}/consultas/ls-2/calcular`);
    const res = await request(app).post(`${baseUrl}/consultas/ls-2/aprovar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("reprovado");
  });
});

describe("LicencaSocial — Tipos de Consulta", () => {
  it("lista tipos de consulta disponíveis", async () => {
    const res = await request(app).get(`${baseUrl}/tipos-consulta`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain("audiencia_publica");
    expect(res.body).toContain("reuniao_comunitaria");
  });
});
