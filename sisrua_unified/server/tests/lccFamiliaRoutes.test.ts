/**
 * Testes T2-94 — LCC por Família de Equipamentos
 */

import request from "supertest";
import app from "../app.js";
import { LccFamiliaService } from "../services/lccFamiliaService.js";

beforeEach(() => {
  LccFamiliaService._reset();
});

describe("LCC Família — /api/lcc-familia", () => {
  describe("POST /analises", () => {
    it("cria análise com dados válidos → 201", async () => {
      const res = await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "tenant-alfa",
        titulo: "LCC Postes MT Zona Norte",
        descricao: "Análise de ciclo de vida postes MT",
        responsavel: "Eng. Souza",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("lf-1");
      expect(res.body.status).toBe("rascunho");
    });

    it("rejeita dados inválidos → 400", async () => {
      const res = await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "x",
        titulo: "A",
      });
      expect(res.status).toBe(400);
    });

    it("aceita horizonte e taxaDesconto personalizados", async () => {
      const res = await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "tenant-beta",
        titulo: "LCC Transformadores 15 anos",
        descricao: "Análise 15 anos WACC 10%",
        responsavel: "Eng. Lima",
        horizonte: 15,
        taxaDesconto: 0.10,
      });
      expect(res.status).toBe(201);
      expect(res.body.horizonte).toBe(15);
      expect(res.body.taxaDesconto).toBe(0.10);
    });
  });

  describe("GET /analises", () => {
    it("retorna lista vazia inicialmente", async () => {
      const res = await request(app).get("/api/lcc-familia/analises");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t1", titulo: "Análise T1", descricao: "Desc T1", responsavel: "Resp T1",
      });
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t2", titulo: "Análise T2", descricao: "Desc T2", responsavel: "Resp T2",
      });
      const res = await request(app).get("/api/lcc-familia/analises?tenantId=t1");
      expect(res.body).toHaveLength(1);
      expect(res.body[0].tenantId).toBe("t1");
    });
  });

  describe("GET /analises/:id", () => {
    it("retorna análise existente → 200", async () => {
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t1", titulo: "LCC Postes BT", descricao: "Análise BT", responsavel: "Eng X",
      });
      const res = await request(app).get("/api/lcc-familia/analises/lf-1");
      expect(res.status).toBe(200);
    });

    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/lcc-familia/analises/lf-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /analises/:id/equipamentos", () => {
    beforeEach(async () => {
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t1", titulo: "LCC Análise Base", descricao: "Base test", responsavel: "Eng Y",
      });
    });

    it("adiciona equipamento → 201", async () => {
      const res = await request(app)
        .post("/api/lcc-familia/analises/lf-1/equipamentos")
        .send({
          familia: "poste_concreto",
          descricao: "Poste 11m concreto armado",
          quantidade: 50,
          custoAquisicaoUnitario: 1200,
          custoInstalacaoUnitario: 300,
          custoManutencaoAnual: 50,
          custoSubstituicao: 1500,
          custoDescarte: 200,
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("eq-1");
      expect(res.body.familia).toBe("poste_concreto");
    });

    it("rejeita dados inválidos → 400", async () => {
      const res = await request(app)
        .post("/api/lcc-familia/analises/lf-1/equipamentos")
        .send({ familia: "invalida", quantidade: -1 });
      expect(res.status).toBe(400);
    });

    it("retorna 422 para análise inexistente", async () => {
      const res = await request(app)
        .post("/api/lcc-familia/analises/lf-999/equipamentos")
        .send({
          familia: "medidor",
          descricao: "Medidor padrão",
          quantidade: 10,
          custoAquisicaoUnitario: 500,
          custoInstalacaoUnitario: 100,
          custoManutencaoAnual: 20,
          custoSubstituicao: 600,
          custoDescarte: 50,
        });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /analises/:id/calcular", () => {
    it("calcula LCC com VPL → 200", async () => {
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t1", titulo: "LCC Completa", descricao: "Ciclo 30 anos", responsavel: "Eng Z",
      });
      await request(app)
        .post("/api/lcc-familia/analises/lf-1/equipamentos")
        .send({
          familia: "transformador_trifasico",
          descricao: "Transformador 75 kVA trifásico",
          quantidade: 5,
          custoAquisicaoUnitario: 15000,
          custoInstalacaoUnitario: 2000,
          custoManutencaoAnual: 500,
          custoSubstituicao: 18000,
          custoDescarte: 1000,
        });
      const res = await request(app)
        .post("/api/lcc-familia/analises/lf-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.vplTotal).toBeGreaterThan(0);
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
    });

    it("retorna 422 sem equipamentos", async () => {
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t1", titulo: "Vazia", descricao: "Sem equipamentos", responsavel: "Eng W",
      });
      const res = await request(app)
        .post("/api/lcc-familia/analises/lf-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("POST /analises/:id/publicar", () => {
    it("publica análise calculada → 200", async () => {
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t1", titulo: "LCC Publicação", descricao: "Para publicar", responsavel: "Eng P",
      });
      await request(app).post("/api/lcc-familia/analises/lf-1/equipamentos").send({
        familia: "cabo_multiplexado",
        descricao: "Cabo 16mm² multiplexado",
        quantidade: 1000,
        custoAquisicaoUnitario: 8,
        custoInstalacaoUnitario: 2,
        custoManutencaoAnual: 0.5,
        custoSubstituicao: 9,
        custoDescarte: 1,
      });
      await request(app).post("/api/lcc-familia/analises/lf-1/calcular");
      const res = await request(app).post("/api/lcc-familia/analises/lf-1/publicar");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("publicado");
    });

    it("retorna 422 ao publicar sem calcular", async () => {
      await request(app).post("/api/lcc-familia/analises").send({
        tenantId: "t1", titulo: "Sem Calcular", descricao: "Rascunho", responsavel: "Eng Q",
      });
      const res = await request(app).post("/api/lcc-familia/analises/lf-1/publicar");
      expect(res.status).toBe(422);
    });
  });

  describe("GET /familias", () => {
    it("retorna catálogo de famílias com vida útil → 200", async () => {
      const res = await request(app).get("/api/lcc-familia/familias");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("poste_concreto");
      expect(res.body["transformador_trifasico"]).toBe(35);
    });
  });
});
