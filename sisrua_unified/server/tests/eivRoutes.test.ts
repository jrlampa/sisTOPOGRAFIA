/**
 * Testes T2-95 — Estudo de Impacto de Vizinhança (EIV)
 */

import request from "supertest";
import app from "../app.js";
import { EivService } from "../services/eivService.js";

beforeEach(() => {
  EivService._reset();
});

describe("EIV — /api/eiv", () => {
  describe("POST /estudos", () => {
    it("cria estudo com dados válidos → 201", async () => {
      const res = await request(app).post("/api/eiv/estudos").send({
        tenantId: "tenant-eiv",
        titulo: "EIV Subestação Zona Sul",
        empreendimento: "Subestação MT/BT 500 kVA",
        municipio: "São Paulo",
        uf: "SP",
        zonaUrbana: "zona_residencial",
        areaImpactoM2: 2500,
        populacaoAfetada: 3000,
        responsavel: "Eng. Carvalho",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("eiv-1");
      expect(res.body.uf).toBe("SP");
      expect(res.body.status).toBe("rascunho");
    });

    it("rejeita UF inválida (≠ 2 chars) → 400", async () => {
      const res = await request(app).post("/api/eiv/estudos").send({
        tenantId: "tenant-eiv",
        titulo: "EIV Teste Falha",
        empreendimento: "Subestação Teste",
        municipio: "Rio",
        uf: "RJX",
        zonaUrbana: "zona_comercial",
        areaImpactoM2: 500,
        populacaoAfetada: 100,
        responsavel: "Eng. X",
      });
      expect(res.status).toBe(400);
    });

    it("normaliza UF para maiúsculas", async () => {
      const res = await request(app).post("/api/eiv/estudos").send({
        tenantId: "t1",
        titulo: "EIV Campinas Norte",
        empreendimento: "Rede MT Expansão",
        municipio: "Campinas",
        uf: "sp",
        zonaUrbana: "zona_mista",
        areaImpactoM2: 800,
        populacaoAfetada: 500,
        responsavel: "Eng. P",
      });
      expect(res.status).toBe(201);
      expect(res.body.uf).toBe("SP");
    });
  });

  describe("GET /estudos", () => {
    it("retorna lista vazia", async () => {
      const res = await request(app).get("/api/eiv/estudos");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/eiv/estudos").send({
        tenantId: "tA", titulo: "EIV Tenant A", empreendimento: "Obra A",
        municipio: "SP", uf: "SP", zonaUrbana: "zona_comercial",
        areaImpactoM2: 300, populacaoAfetada: 200, responsavel: "Eng A",
      });
      await request(app).post("/api/eiv/estudos").send({
        tenantId: "tB", titulo: "EIV Tenant B", empreendimento: "Obra B",
        municipio: "RJ", uf: "RJ", zonaUrbana: "zona_industrial",
        areaImpactoM2: 500, populacaoAfetada: 400, responsavel: "Eng B",
      });
      const res = await request(app).get("/api/eiv/estudos?tenantId=tA");
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /estudos/:id", () => {
    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/eiv/estudos/eiv-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /estudos/:id/impactos", () => {
    beforeEach(async () => {
      await request(app).post("/api/eiv/estudos").send({
        tenantId: "t1", titulo: "EIV Base", empreendimento: "Obra Base",
        municipio: "BH", uf: "MG", zonaUrbana: "zona_residencial",
        areaImpactoM2: 1000, populacaoAfetada: 800, responsavel: "Eng Base",
      });
    });

    it("adiciona impacto → 201", async () => {
      const res = await request(app)
        .post("/api/eiv/estudos/eiv-1/impactos")
        .send({
          dimensao: "ruido",
          nivel: "moderado",
          descricao: "Operação de guindastes durante instalação da subestação",
          medidasMitigadoras: ["Restrição horário noturno", "Barreira acústica temporária"],
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("imp-1");
    });

    it("rejeita dimensão duplicada → 422", async () => {
      await request(app).post("/api/eiv/estudos/eiv-1/impactos").send({
        dimensao: "trafego", nivel: "baixo",
        descricao: "Bloqueio parcial da via durante obras",
        medidasMitigadoras: [],
      });
      const res = await request(app).post("/api/eiv/estudos/eiv-1/impactos").send({
        dimensao: "trafego", nivel: "moderado",
        descricao: "Repetição da mesma dimensão",
        medidasMitigadoras: [],
      });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /estudos/:id/calcular", () => {
    it("calcula EIV e retorna IEV → 200", async () => {
      await request(app).post("/api/eiv/estudos").send({
        tenantId: "t1", titulo: "EIV Calcular", empreendimento: "Subestação Calcular",
        municipio: "Curitiba", uf: "PR", zonaUrbana: "zona_mista",
        areaImpactoM2: 1500, populacaoAfetada: 1000, responsavel: "Eng C",
      });
      await request(app).post("/api/eiv/estudos/eiv-1/impactos").send({
        dimensao: "trafego", nivel: "moderado",
        descricao: "Interrupção parcial do tráfego durante montagem",
        medidasMitigadoras: ["Sinalização viária"],
      });
      await request(app).post("/api/eiv/estudos/eiv-1/impactos").send({
        dimensao: "ruido", nivel: "baixo",
        descricao: "Ruído de equipamentos durante diurno",
        medidasMitigadoras: [],
      });
      const res = await request(app).post("/api/eiv/estudos/eiv-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.iev).toBeGreaterThanOrEqual(0);
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.dimensoesAvaliadas).toBe(2);
    });

    it("retorna 422 sem impactos", async () => {
      await request(app).post("/api/eiv/estudos").send({
        tenantId: "t1", titulo: "EIV Vazio", empreendimento: "Sem impactos",
        municipio: "Porto Alegre", uf: "RS", zonaUrbana: "zona_industrial",
        areaImpactoM2: 200, populacaoAfetada: 0, responsavel: "Eng V",
      });
      const res = await request(app).post("/api/eiv/estudos/eiv-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("POST /estudos/:id/publicar", () => {
    it("publica estudo calculado → 200", async () => {
      await request(app).post("/api/eiv/estudos").send({
        tenantId: "t1", titulo: "EIV Pub", empreendimento: "Para publicar",
        municipio: "Fortaleza", uf: "CE", zonaUrbana: "zona_comercial",
        areaImpactoM2: 600, populacaoAfetada: 500, responsavel: "Eng Pub",
      });
      await request(app).post("/api/eiv/estudos/eiv-1/impactos").send({
        dimensao: "uso_solo", nivel: "baixo",
        descricao: "Adaptação de uso do solo temporária",
        medidasMitigadoras: [],
      });
      await request(app).post("/api/eiv/estudos/eiv-1/calcular");
      const res = await request(app).post("/api/eiv/estudos/eiv-1/publicar");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("publicado");
    });
  });

  describe("GET /dimensoes", () => {
    it("retorna lista de dimensões → 200", async () => {
      const res = await request(app).get("/api/eiv/dimensoes");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain("trafego");
    });
  });
});
