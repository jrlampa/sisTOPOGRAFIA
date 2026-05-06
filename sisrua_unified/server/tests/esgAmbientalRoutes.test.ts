/**
 * esgAmbientalRoutes.test.ts — Testes ESG Ambiental (T2-45).
 */

import request from "supertest";
import app from "../app.js";
import { EsgAmbientalService } from "../services/esgAmbientalService.js";

beforeEach(() => {
  EsgAmbientalService._reset();
});

const TENANT = "tenant-esg-test";

const RELATORIO_BASE = {
  nome: "Relatório ESG Distribuição BT 2024",
  tenantId: TENANT,
  periodoReferencia: "2024",
};

const EMISSOES_EXEMPLO = [
  { tipo: "poste_concreto", escopo: "escopo3", quantidade: 20 },
  { tipo: "cabo_multiplexado", escopo: "escopo3", quantidade: 2000 },
  { tipo: "transformador_oleo", escopo: "escopo3", quantidade: 5 },
  { tipo: "veiculo_trabalho_diesel", escopo: "escopo1", quantidade: 1500 },
  { tipo: "energia_eletrica_grid", escopo: "escopo2", quantidade: 8760 },
];

const INDICADORES_EXEMPLO = {
  percentualRedeProtegida: 45,
  percentualPerdasTecnicas: 7.2,
  indiceConflitosArborizacao: 2.5,
  percentualLuminariasLed: 65,
};

describe("POST /api/esg-ambiental/relatorios", () => {
  it("cria relatório ESG", async () => {
    const res = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^esg-/);
    expect(res.body.status).toBe("rascunho");
    expect(res.body.checklistIso14001).toHaveLength(10);
  });

  it("retorna 400 para período de referência inválido", async () => {
    const res = await request(app).post("/api/esg-ambiental/relatorios").send({
      ...RELATORIO_BASE,
      periodoReferencia: "2024/01",
    });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para payload incompleto", async () => {
    const res = await request(app).post("/api/esg-ambiental/relatorios").send({ tenantId: TENANT });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/esg-ambiental/relatorios", () => {
  it("lista relatórios do tenant", async () => {
    await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app).get(`/api/esg-ambiental/relatorios?tenantId=${TENANT}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("retorna 400 sem tenantId", async () => {
    const res = await request(app).get("/api/esg-ambiental/relatorios");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/esg-ambiental/relatorios/:id", () => {
  it("busca relatório por id", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app).get(`/api/esg-ambiental/relatorios/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.periodoReferencia).toBe("2024");
  });

  it("retorna 404 para id inexistente", async () => {
    const res = await request(app).get("/api/esg-ambiental/relatorios/esg-9999");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/esg-ambiental/relatorios/:id/emissoes", () => {
  it("adiciona entradas de emissão", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app)
      .post(`/api/esg-ambiental/relatorios/${criado.body.id}/emissoes`)
      .send({ emissoes: EMISSOES_EXEMPLO });
    expect(res.status).toBe(200);
    expect(res.body.emissoes).toHaveLength(EMISSOES_EXEMPLO.length);
  });

  it("retorna 400 para tipo de emissão inválido", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app)
      .post(`/api/esg-ambiental/relatorios/${criado.body.id}/emissoes`)
      .send({ emissoes: [{ tipo: "tipo_invalido", escopo: "escopo1", quantidade: 10 }] });
    expect(res.status).toBe(400);
  });

  it("retorna 404 para relatório inexistente", async () => {
    const res = await request(app)
      .post("/api/esg-ambiental/relatorios/esg-9999/emissoes")
      .send({ emissoes: [{ tipo: "poste_concreto", escopo: "escopo3", quantidade: 5 }] });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/esg-ambiental/relatorios/:id/indicadores", () => {
  it("atualiza indicadores de sustentabilidade", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app)
      .put(`/api/esg-ambiental/relatorios/${criado.body.id}/indicadores`)
      .send(INDICADORES_EXEMPLO);
    expect(res.status).toBe(200);
    expect(res.body.indicadores.percentualRedeProtegida).toBe(45);
  });

  it("retorna 400 para percentual fora de range", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app)
      .put(`/api/esg-ambiental/relatorios/${criado.body.id}/indicadores`)
      .send({ ...INDICADORES_EXEMPLO, percentualRedeProtegida: 150 });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/esg-ambiental/relatorios/:id/checklist", () => {
  it("atualiza itens do checklist ISO 14001", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app)
      .patch(`/api/esg-ambiental/relatorios/${criado.body.id}/checklist`)
      .send({
        itens: [
          { id: "iso-4.1", status: "conforme", evidencia: "Política ambiental aprovada 2024" },
          { id: "iso-5.1", status: "conforme" },
          { id: "iso-9.3", status: "nao_conforme" },
        ],
      });
    expect(res.status).toBe(200);
    const conformes = res.body.checklistIso14001.filter((i: { status: string }) => i.status === "conforme");
    expect(conformes.length).toBe(2);
  });
});

describe("POST /api/esg-ambiental/relatorios/:id/calcular", () => {
  it("calcula relatório ESG com score e classificação", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const id = criado.body.id;
    await request(app).post(`/api/esg-ambiental/relatorios/${id}/emissoes`).send({ emissoes: EMISSOES_EXEMPLO });
    await request(app).put(`/api/esg-ambiental/relatorios/${id}/indicadores`).send(INDICADORES_EXEMPLO);
    await request(app).patch(`/api/esg-ambiental/relatorios/${id}/checklist`).send({
      itens: [
        { id: "iso-4.1", status: "conforme" },
        { id: "iso-5.1", status: "conforme" },
        { id: "iso-8.1", status: "conforme" },
      ],
    });

    const res = await request(app).post(`/api/esg-ambiental/relatorios/${id}/calcular`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("calculado");
    expect(res.body.resultado.scoreEsg).toBeGreaterThan(0);
    expect(["A", "B", "C", "D"]).toContain(res.body.resultado.classificacaoEsg);
    expect(res.body.resultado.emissoesTotaisTonCo2eq).toBeGreaterThan(0);
    expect(res.body.resultado.emissoesPorEscopo.escopo1).toBeGreaterThan(0);
    expect(res.body.resultado.hashIntegridade).toHaveLength(64);
  });

  it("calcula relatório sem emissões (baseline vazio)", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app).post(`/api/esg-ambiental/relatorios/${criado.body.id}/calcular`);
    expect(res.status).toBe(200);
    expect(res.body.resultado.emissoesTotaisTonCo2eq).toBe(0);
  });

  it("retorna 404 para relatório inexistente", async () => {
    const res = await request(app).post("/api/esg-ambiental/relatorios/esg-9999/calcular");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/esg-ambiental/relatorios/:id/publicar", () => {
  it("publica relatório calculado", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    await request(app).post(`/api/esg-ambiental/relatorios/${criado.body.id}/calcular`);
    const res = await request(app).post(`/api/esg-ambiental/relatorios/${criado.body.id}/publicar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("publicado");
  });

  it("retorna 422 para relatório não calculado", async () => {
    const criado = await request(app).post("/api/esg-ambiental/relatorios").send(RELATORIO_BASE);
    const res = await request(app).post(`/api/esg-ambiental/relatorios/${criado.body.id}/publicar`);
    expect(res.status).toBe(422);
  });
});

describe("GET /api/esg-ambiental/fatores-emissao", () => {
  it("retorna catálogo de fatores de emissão", async () => {
    const res = await request(app).get("/api/esg-ambiental/fatores-emissao");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.fatores)).toBe(true);
    expect(res.body.fatores.length).toBeGreaterThan(0);
    const fatorPoste = res.body.fatores.find((f: { tipo: string }) => f.tipo === "poste_concreto");
    expect(fatorPoste).toBeDefined();
    expect(fatorPoste.fatorKgCo2eqPorUnidade).toBe(280);
  });
});
