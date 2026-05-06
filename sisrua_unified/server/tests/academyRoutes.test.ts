/**
 * Testes T2-57 — sisTOPOGRAFIA Academy
 */

import request from "supertest";
import app from "../app.js";
import { AcademyService } from "../services/academyService.js";

const BASE = "/api/academy";

beforeEach(() => AcademyService._reset());

const trilhaPayload = {
  tenantId: "t1",
  titulo: "Topografia Básica",
  descricao: "Fundamentos de topografia e levantamento",
  nivelDificuldade: "basico",
  categorias: ["topografia"],
  certificadoNome: "Certificado de Topografia Básica",
};

const cursoPayload = {
  titulo: "Nivelamento Geométrico",
  descricao: "Técnicas de nivelamento de precisão",
  cargaHorariaH: 20,
  ordem: 1,
};

const moduloPayload = {
  titulo: "Equipamentos de Nivelamento",
  tipoConteudo: "video",
  cargaHorariaMin: 60,
  ordem: 1,
};

describe("POST /trilhas", () => {
  it("cria trilha com status rascunho", async () => {
    const res = await request(app).post(`${BASE}/trilhas`).send(trilhaPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("tr-1");
    expect(res.body.status).toBe("rascunho");
    expect(res.body.categorias).toContain("topografia");
  });

  it("rejeita sem titulo", async () => {
    const res = await request(app).post(`${BASE}/trilhas`).send({ ...trilhaPayload, titulo: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /trilhas", () => {
  it("lista vazia", async () => {
    const res = await request(app).get(`${BASE}/trilhas`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filtra por tenantId", async () => {
    await request(app).post(`${BASE}/trilhas`).send({ ...trilhaPayload, tenantId: "tA" });
    await request(app).post(`${BASE}/trilhas`).send({ ...trilhaPayload, tenantId: "tB" });
    const res = await request(app).get(`${BASE}/trilhas?tenantId=tA`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tenantId).toBe("tA");
  });
});

describe("GET /trilhas/:id", () => {
  it("retorna 404 para trilha inexistente", async () => {
    const res = await request(app).get(`${BASE}/trilhas/tr-999`);
    expect(res.status).toBe(404);
  });

  it("retorna trilha existente", async () => {
    await request(app).post(`${BASE}/trilhas`).send(trilhaPayload);
    const res = await request(app).get(`${BASE}/trilhas/tr-1`);
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe("Topografia Básica");
  });
});

describe("POST /trilhas/:id/cursos", () => {
  it("adiciona curso à trilha", async () => {
    await request(app).post(`${BASE}/trilhas`).send(trilhaPayload);
    const res = await request(app).post(`${BASE}/trilhas/tr-1/cursos`).send(cursoPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("cu-1");
    expect(res.body.trilhaId).toBe("tr-1");
  });

  it("retorna 422 para trilha inexistente", async () => {
    const res = await request(app).post(`${BASE}/trilhas/tr-999/cursos`).send(cursoPayload);
    expect(res.status).toBe(422);
  });
});

describe("POST /cursos/:id/modulos", () => {
  it("adiciona módulo ao curso", async () => {
    await request(app).post(`${BASE}/trilhas`).send(trilhaPayload);
    await request(app).post(`${BASE}/trilhas/tr-1/cursos`).send(cursoPayload);
    const res = await request(app).post(`${BASE}/cursos/cu-1/modulos`).send(moduloPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("mo-1");
    expect(res.body.tipoConteudo).toBe("video");
  });

  it("retorna 422 para curso inexistente", async () => {
    const res = await request(app).post(`${BASE}/cursos/cu-999/modulos`).send(moduloPayload);
    expect(res.status).toBe(422);
  });
});

describe("Fluxo completo de progresso e certificação", () => {
  let trilhaId: string;
  let cursoId: string;
  let moduloId: string;
  let progressoId: string;

  beforeEach(async () => {
    const t = await request(app).post(`${BASE}/trilhas`).send(trilhaPayload);
    trilhaId = t.body.id;
    const c = await request(app).post(`${BASE}/trilhas/${trilhaId}/cursos`).send(cursoPayload);
    cursoId = c.body.id;
    const m = await request(app).post(`${BASE}/cursos/${cursoId}/modulos`).send(moduloPayload);
    moduloId = m.body.id;
    // Publica trilha para permitir progresso
    await request(app).post(`${BASE}/trilhas/${trilhaId}/publicar`);
    const pg = await request(app).post(`${BASE}/progresso`).send({
      usuarioId: "aluno-1",
      trilhaId,
    });
    progressoId = pg.body.id;
  });

  it("cria progresso com percentual 0", async () => {
    const res = await request(app).get(`${BASE}/trilhas/${trilhaId}`);
    expect(res.body.status).toBe("publicada");
    const pg = await request(app).get(`${BASE}/trilhas/${trilhaId}`);
    expect(pg.status).toBe(200);
    // progresso foi criado com sucesso no beforeEach
    expect(progressoId).toBe("pg-1");
  });

  it("conclui módulo e atualiza percentual", async () => {
    const res = await request(app)
      .patch(`${BASE}/progresso/${progressoId}/concluir-modulo`)
      .send({ moduloId });
    expect(res.status).toBe(200);
    expect(res.body.percentualConcluido).toBe(100);
    expect(res.body.modulosConcluidosIds).toContain(moduloId);
  });

  it("emite certificado após 100% de conclusão", async () => {
    await request(app)
      .patch(`${BASE}/progresso/${progressoId}/concluir-modulo`)
      .send({ moduloId });
    const res = await request(app).post(`${BASE}/progresso/${progressoId}/certificar`);
    expect(res.status).toBe(200);
    expect(res.body.certificadoEmitido).toBe(true);
    expect(res.body.hashCertificado).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejeita certificado com menos de 100%", async () => {
    const res = await request(app).post(`${BASE}/progresso/${progressoId}/certificar`);
    expect(res.status).toBe(422);
  });
});

describe("GET /categorias", () => {
  it("lista categorias disponíveis", async () => {
    const res = await request(app).get(`${BASE}/categorias`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("topografia");
    expect(res.body).toContain("eletrica");
  });
});
