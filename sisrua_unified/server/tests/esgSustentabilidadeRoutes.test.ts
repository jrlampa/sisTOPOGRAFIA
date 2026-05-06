/**
 * Testes T2-109 — Relatório ESG & Sustentabilidade Local
 */

import request from "supertest";
import app from "../app.js";
import { EsgSustentabilidadeService } from "../services/esgSustentabilidadeService.js";

beforeEach(() => {
  EsgSustentabilidadeService._reset();
});

describe("ESG Sustentabilidade — /api/esg-sustentabilidade", () => {
  describe("POST /relatorios", () => {
    it("cria relatório com dados válidos → 201", async () => {
      const res = await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "neoenergia-esg",
        titulo: "Relatório ESG 2024 — Regional Nordeste",
        exercicio: 2024,
        concessionaria: "NEOENERGIA-PE",
        municipio: "Recife",
        uf: "PE",
        responsavel: "Gerente ESG",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("esg-1");
      expect(res.body.status).toBe("rascunho");
      expect(res.body.uf).toBe("PE");
    });

    it("normaliza UF para maiúsculas", async () => {
      const res = await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "t1", titulo: "Relatório ESG UF", exercicio: 2025,
        concessionaria: "CEMIG", municipio: "BH", uf: "mg", responsavel: "Resp G",
      });
      expect(res.status).toBe(201);
      expect(res.body.uf).toBe("MG");
    });

    it("rejeita exercicio inválido → 400", async () => {
      const res = await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "t1", titulo: "ESG Inválido", exercicio: 1850,
        concessionaria: "X", municipio: "Y", uf: "SP", responsavel: "R",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /relatorios", () => {
    it("retorna lista vazia", async () => {
      const res = await request(app).get("/api/esg-sustentabilidade/relatorios");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "tA", titulo: "Relatório ESG Tenant A", exercicio: 2024,
        concessionaria: "EDP-SP", municipio: "SP", uf: "SP", responsavel: "Resp A",
      });
      await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "tB", titulo: "Relatório ESG Tenant B", exercicio: 2024,
        concessionaria: "COELBA", municipio: "Salvador", uf: "BA", responsavel: "Resp B",
      });
      const res = await request(app).get("/api/esg-sustentabilidade/relatorios?tenantId=tA");
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /relatorios/:id", () => {
    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/esg-sustentabilidade/relatorios/esg-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /relatorios/:id/indicadores", () => {
    beforeEach(async () => {
      await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "t1", titulo: "ESG Base", exercicio: 2024,
        concessionaria: "LIGHT", municipio: "Rio", uf: "RJ", responsavel: "Resp B",
      });
    });

    it("registra indicador ambiental → 201", async () => {
      const res = await request(app)
        .post("/api/esg-sustentabilidade/relatorios/esg-1/indicadores")
        .send({
          tipo: "emissoes_co2_tco2e",
          valor: 1250.5,
          unidade: "tCO2e",
          metaReferencia: 1500,
          fonteColeta: "Inventário GHG Protocol 2024",
          periodoApuracao: "2024-01 a 2024-12",
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("ind-1");
      expect(res.body.dimensao).toBe("ambiental");
    });

    it("registra indicador social → 201", async () => {
      const res = await request(app)
        .post("/api/esg-sustentabilidade/relatorios/esg-1/indicadores")
        .send({
          tipo: "empregos_gerados",
          valor: 320,
          unidade: "postos",
          fonteColeta: "RH corporativo 2024",
          periodoApuracao: "2024",
        });
      expect(res.status).toBe(201);
      expect(res.body.dimensao).toBe("social");
    });
  });

  describe("POST /relatorios/:id/calcular", () => {
    it("calcula índice ESG composto → 200", async () => {
      await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "t1", titulo: "ESG Cálculo", exercicio: 2024,
        concessionaria: "ENERGISA", municipio: "Campina Grande", uf: "PB",
        responsavel: "Resp Calc",
      });
      // Ambiental
      await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/indicadores").send({
        tipo: "emissoes_co2_tco2e", valor: 800, unidade: "tCO2e",
        metaReferencia: 1000, fonteColeta: "Inventário", periodoApuracao: "2024",
      });
      // Social
      await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/indicadores").send({
        tipo: "empregos_gerados", valor: 200, unidade: "postos",
        metaReferencia: 250, fonteColeta: "RH", periodoApuracao: "2024",
      });
      // Governança
      await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/indicadores").send({
        tipo: "conformidade_regulatoria_percentual", valor: 96, unidade: "%",
        metaReferencia: 100, fonteColeta: "Jurídico", periodoApuracao: "2024",
      });

      const res = await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.indiceGlobal).toBeGreaterThanOrEqual(0);
      expect(res.body.indiceGlobal).toBeLessThanOrEqual(100);
      expect(["inicial", "desenvolvimento", "consolidado", "lider"]).toContain(
        res.body.nivelMaturidade
      );
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
      expect(Array.isArray(res.body.ods)).toBe(true);
    });

    it("retorna 422 sem indicadores", async () => {
      await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "t1", titulo: "ESG Vazio", exercicio: 2024,
        concessionaria: "X", municipio: "Y", uf: "AC", responsavel: "Resp V",
      });
      const res = await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("POST /relatorios/:id/publicar", () => {
    it("publica relatório calculado → 200", async () => {
      await request(app).post("/api/esg-sustentabilidade/relatorios").send({
        tenantId: "t1", titulo: "ESG Publicar", exercicio: 2024,
        concessionaria: "COPEL", municipio: "Curitiba", uf: "PR",
        responsavel: "Resp Pub",
      });
      await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/indicadores").send({
        tipo: "agua_consumida_m3", valor: 5000, unidade: "m³",
        metaReferencia: 6000, fonteColeta: "Medidor", periodoApuracao: "2024",
      });
      await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/calcular");
      const res = await request(app).post("/api/esg-sustentabilidade/relatorios/esg-1/publicar");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("publicado");
    });
  });

  describe("GET /indicadores", () => {
    it("retorna catálogo de indicadores por dimensão → 200", async () => {
      const res = await request(app).get("/api/esg-sustentabilidade/indicadores");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ambiental");
      expect(res.body).toHaveProperty("social");
      expect(res.body).toHaveProperty("governanca");
      expect(res.body.ambiental).toContain("emissoes_co2_tco2e");
    });
  });
});
