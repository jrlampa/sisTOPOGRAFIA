/**
 * Testes T2-101 — Dossiê de Remuneração Regulatória (MCPSE/ANEEL)
 */

import request from "supertest";
import app from "../app.js";
import { RemuneracaoRegulatoriaService } from "../services/remuneracaoRegulatoriaService.js";

beforeEach(() => {
  RemuneracaoRegulatoriaService._reset();
});

describe("Remuneração Regulatória — /api/remuneracao-regulatoria", () => {
  describe("POST /dossies", () => {
    it("cria dossiê com dados válidos → 201", async () => {
      const res = await request(app)
        .post("/api/remuneracao-regulatoria/dossies")
        .send({
          tenantId: "cemig-distribuidora",
          titulo: "BRN 4RT — Ciclo 2023-2027",
          concessionaria: "CEMIG-D",
          cicloTarifario: "4RT",
          anoReferencia: 2024,
          responsavel: "Equipe Regulatório",
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("rr-1");
      expect(res.body.waccRegulatorio).toBeCloseTo(0.0728);
    });

    it("rejeita anoReferencia inválido → 400", async () => {
      const res = await request(app)
        .post("/api/remuneracao-regulatoria/dossies")
        .send({
          tenantId: "t1",
          titulo: "Dossiê Teste",
          concessionaria: "COELBA",
          cicloTarifario: "3RT",
          anoReferencia: 1800,
          responsavel: "Eng. X",
        });
      expect(res.status).toBe(400);
    });

    it("aceita WACC personalizado", async () => {
      const res = await request(app)
        .post("/api/remuneracao-regulatoria/dossies")
        .send({
          tenantId: "t1",
          titulo: "Dossiê WACC Custom",
          concessionaria: "COPEL-D",
          cicloTarifario: "5RT",
          anoReferencia: 2026,
          responsavel: "Eng. M",
          waccRegulatorio: 0.0680,
        });
      expect(res.status).toBe(201);
      expect(res.body.waccRegulatorio).toBeCloseTo(0.0680);
    });
  });

  describe("GET /dossies", () => {
    it("retorna lista vazia inicialmente", async () => {
      const res = await request(app).get("/api/remuneracao-regulatoria/dossies");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/remuneracao-regulatoria/dossies").send({
        tenantId: "distribuidoraA", titulo: "Dossiê A", concessionaria: "EDP-SP",
        cicloTarifario: "3RT", anoReferencia: 2025, responsavel: "Eng. A",
      });
      await request(app).post("/api/remuneracao-regulatoria/dossies").send({
        tenantId: "distribuidoraB", titulo: "Dossiê B", concessionaria: "ENEL-CE",
        cicloTarifario: "4RT", anoReferencia: 2026, responsavel: "Eng. B",
      });
      const res = await request(app)
        .get("/api/remuneracao-regulatoria/dossies?tenantId=distribuidoraA");
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /dossies/:id", () => {
    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/remuneracao-regulatoria/dossies/rr-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /dossies/:id/ativos", () => {
    beforeEach(async () => {
      await request(app).post("/api/remuneracao-regulatoria/dossies").send({
        tenantId: "t1", titulo: "Dossiê Base", concessionaria: "LIGHT",
        cicloTarifario: "4RT", anoReferencia: 2024, responsavel: "Eng Base",
      });
    });

    it("adiciona ativo → 201", async () => {
      const res = await request(app)
        .post("/api/remuneracao-regulatoria/dossies/rr-1/ativos")
        .send({
          tipoAtivo: "transformador_distribuicao",
          descricao: "Transformador 75 kVA — instalado 2015",
          quantidade: 10,
          vnrUnitario: 28000,
          idadeAnos: 9,
          anoInstalacao: 2015,
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("at-1");
      expect(res.body.vidaUtilRegulatoriaAnos).toBe(35);
    });

    it("rejeita tipo de ativo inválido → 400", async () => {
      const res = await request(app)
        .post("/api/remuneracao-regulatoria/dossies/rr-1/ativos")
        .send({
          tipoAtivo: "ativo_invalido",
          descricao: "Inválido",
          quantidade: 1,
          vnrUnitario: 1000,
          idadeAnos: 5,
          anoInstalacao: 2019,
        });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /dossies/:id/calcular", () => {
    it("calcula BRL e remuneração → 200", async () => {
      await request(app).post("/api/remuneracao-regulatoria/dossies").send({
        tenantId: "t1", titulo: "Cálculo BRL", concessionaria: "ENERGISA",
        cicloTarifario: "4RT", anoReferencia: 2024, responsavel: "Eng Calc",
      });
      await request(app).post("/api/remuneracao-regulatoria/dossies/rr-1/ativos").send({
        tipoAtivo: "rede_bt",
        descricao: "Rede BT bairro industrial",
        quantidade: 20,
        vnrUnitario: 5000,
        idadeAnos: 10,
        anoInstalacao: 2014,
      });
      const res = await request(app)
        .post("/api/remuneracao-regulatoria/dossies/rr-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.baseRemuneracaoBruta).toBe(100000);
      expect(res.body.baseRemuneracaoLiquida).toBeGreaterThan(0);
      expect(res.body.remuneracaoAnual).toBeGreaterThan(0);
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
    });

    it("retorna 422 sem ativos", async () => {
      await request(app).post("/api/remuneracao-regulatoria/dossies").send({
        tenantId: "t1", titulo: "Dossiê Vazio", concessionaria: "EQUATORIAL",
        cicloTarifario: "4RT", anoReferencia: 2025, responsavel: "Eng V",
      });
      const res = await request(app)
        .post("/api/remuneracao-regulatoria/dossies/rr-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("POST /dossies/:id/publicar + /homologar", () => {
    it("fluxo completo: calcular → publicar → homologar", async () => {
      await request(app).post("/api/remuneracao-regulatoria/dossies").send({
        tenantId: "t1", titulo: "Dossiê Fluxo", concessionaria: "NEOENERGIA",
        cicloTarifario: "5RT", anoReferencia: 2026, responsavel: "Eng F",
      });
      await request(app).post("/api/remuneracao-regulatoria/dossies/rr-1/ativos").send({
        tipoAtivo: "religador",
        descricao: "Religador automático tipo I",
        quantidade: 3,
        vnrUnitario: 35000,
        idadeAnos: 5,
        anoInstalacao: 2019,
      });
      await request(app).post("/api/remuneracao-regulatoria/dossies/rr-1/calcular");
      const pub = await request(app)
        .post("/api/remuneracao-regulatoria/dossies/rr-1/publicar");
      expect(pub.body.status).toBe("publicado");
      const hom = await request(app)
        .post("/api/remuneracao-regulatoria/dossies/rr-1/homologar");
      expect(hom.body.status).toBe("homologado");
    });
  });

  describe("GET /tipos-ativo", () => {
    it("retorna catálogo de tipos de ativo → 200", async () => {
      const res = await request(app).get("/api/remuneracao-regulatoria/tipos-ativo");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("rede_bt");
      expect(res.body["transformador_distribuicao"]).toBe(35);
    });
  });
});
