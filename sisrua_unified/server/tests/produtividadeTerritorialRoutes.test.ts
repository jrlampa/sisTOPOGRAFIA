/**
 * Testes T2-69 — Dashboard de Produtividade Territorial
 */

import request from "supertest";
import app from "../app.js";
import { ProdutividadeTerritorialService } from "../services/produtividadeTerritorialService.js";

beforeEach(() => {
  ProdutividadeTerritorialService._reset();
});

describe("Produtividade Territorial — /api/produtividade-territorial", () => {
  describe("POST /paineis", () => {
    it("cria painel com dados válidos → 201", async () => {
      const res = await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "equatorial-go",
        titulo: "Dashboard Produtividade — Maio 2024",
        periodo: "mensal",
        dataInicio: "2024-05-01",
        dataFim: "2024-05-31",
        concessionaria: "EQUATORIAL-GO",
        responsavel: "Gerente Regional Norte",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("pt-1");
      expect(res.body.status).toBe("rascunho");
      expect(res.body.periodo).toBe("mensal");
    });

    it("rejeita periodo inválido → 400", async () => {
      const res = await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "t1", titulo: "Painel Inválido",
        periodo: "bimestral",      // não existe no enum
        dataInicio: "2024-05-01", dataFim: "2024-05-31",
        concessionaria: "X", responsavel: "Resp X",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /paineis", () => {
    it("retorna lista vazia", async () => {
      const res = await request(app).get("/api/produtividade-territorial/paineis");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "tA", titulo: "Painel Tenant A", periodo: "semanal",
        dataInicio: "2024-05-01", dataFim: "2024-05-07",
        concessionaria: "COELCE", responsavel: "Resp A",
      });
      await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "tB", titulo: "Painel Tenant B", periodo: "semanal",
        dataInicio: "2024-05-08", dataFim: "2024-05-14",
        concessionaria: "CELPE", responsavel: "Resp B",
      });
      const res = await request(app).get("/api/produtividade-territorial/paineis?tenantId=tA");
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /paineis/:id", () => {
    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/produtividade-territorial/paineis/pt-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /paineis/:id/metricas", () => {
    beforeEach(async () => {
      await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "t1", titulo: "Painel Métricas",
        periodo: "mensal", dataInicio: "2024-05-01", dataFim: "2024-05-31",
        concessionaria: "CELG", responsavel: "Resp M",
      });
    });

    it("registra métrica → 201", async () => {
      const res = await request(app)
        .post("/api/produtividade-territorial/paineis/pt-1/metricas")
        .send({
          equipeId: "eq-01",
          equipeName: "Equipe Norte Alpha",
          setor: "Goiânia Norte",
          setorTipo: "bairro",
          indicador: "postes_instalados",
          valorPlanejado: 50,
          valorExecutado: 47,
          dataReferencia: "2024-05-15",
          observacao: "Chuvas atrasaram 1 dia",
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("mt-1");
      expect(res.body.indicador).toBe("postes_instalados");
    });

    it("rejeita indicador inválido → 400", async () => {
      const res = await request(app)
        .post("/api/produtividade-territorial/paineis/pt-1/metricas")
        .send({
          equipeId: "eq-02", equipeName: "Equipe Sul Beta",
          setor: "Sul", setorTipo: "municipio",
          indicador: "indicador_invalido",
          valorPlanejado: 10, valorExecutado: 8,
          dataReferencia: "2024-05-10",
        });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /paineis/:id/calcular", () => {
    it("calcula produtividade com métricas → 200", async () => {
      await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "t1", titulo: "Painel Cálculo",
        periodo: "mensal", dataInicio: "2024-05-01", dataFim: "2024-05-31",
        concessionaria: "COELBA", responsavel: "Resp Calc",
      });

      const equipes = [
        { equipeId: "eq-01", equipeName: "Equipe Norte", setor: "Norte", setorTipo: "regional", indicador: "postes_instalados", valorPlanejado: 50, valorExecutado: 50 },
        { equipeId: "eq-02", equipeName: "Equipe Sul", setor: "Sul", setorTipo: "regional", indicador: "ligacoes_novas", valorPlanejado: 100, valorExecutado: 90 },
        { equipeId: "eq-03", equipeName: "Equipe Leste", setor: "Leste", setorTipo: "bairro", indicador: "km_rede_executada", valorPlanejado: 20, valorExecutado: 18 },
      ];

      for (const m of equipes) {
        await request(app)
          .post("/api/produtividade-territorial/paineis/pt-1/metricas")
          .send({ ...m, dataReferencia: "2024-05-31" });
      }

      const res = await request(app).post("/api/produtividade-territorial/paineis/pt-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.produtividadeGlobal).toBeGreaterThanOrEqual(0);
      expect(res.body.produtividadeGlobal).toBeLessThanOrEqual(100);
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
      expect(Array.isArray(res.body.rankingEquipes)).toBe(true);
      expect(res.body.rankingEquipes.length).toBeGreaterThan(0);
      expect(typeof res.body.taxaConformidade).toBe("number");
    });

    it("retorna 422 sem métricas", async () => {
      await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "t1", titulo: "Painel Vazio",
        periodo: "semanal", dataInicio: "2024-05-01", dataFim: "2024-05-07",
        concessionaria: "CPFL", responsavel: "Resp V",
      });
      const res = await request(app).post("/api/produtividade-territorial/paineis/pt-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("POST /paineis/:id/publicar", () => {
    it("publica painel calculado → 200", async () => {
      await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "t1", titulo: "Painel Publicar",
        periodo: "trimestral", dataInicio: "2024-04-01", dataFim: "2024-06-30",
        concessionaria: "EDP-ES", responsavel: "Resp Pub",
      });
      await request(app).post("/api/produtividade-territorial/paineis/pt-1/metricas").send({
        equipeId: "eq-01", equipeName: "Equipe Publicar",
        setor: "Centro", setorTipo: "municipio",
        indicador: "transformadores_instalados",
        valorPlanejado: 20, valorExecutado: 19,
        dataReferencia: "2024-06-30",
      });
      await request(app).post("/api/produtividade-territorial/paineis/pt-1/calcular");
      const res = await request(app).post("/api/produtividade-territorial/paineis/pt-1/publicar");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("publicado");
    });

    it("retorna 422 sem calcular antes", async () => {
      await request(app).post("/api/produtividade-territorial/paineis").send({
        tenantId: "t1", titulo: "Painel Sem Cálculo",
        periodo: "diario", dataInicio: "2024-05-20", dataFim: "2024-05-20",
        concessionaria: "AMAZONAS", responsavel: "Resp NC",
      });
      const res = await request(app).post("/api/produtividade-territorial/paineis/pt-1/publicar");
      expect(res.status).toBe(422);
    });
  });

  describe("GET /indicadores", () => {
    it("retorna lista de indicadores de campo → 200", async () => {
      const res = await request(app).get("/api/produtividade-territorial/indicadores");
      expect(res.status).toBe(200);
      expect(res.body).toContain("postes_instalados");
      expect(res.body).toContain("km_rede_executada");
      expect(res.body).toContain("ligacoes_novas");
    });
  });
});
