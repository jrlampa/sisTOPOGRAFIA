/**
 * Testes T2-105 — Simulador de Impacto Financeiro (TCO/Capex/Opex)
 */

import request from "supertest";
import app from "../app.js";
import { TcoCapexOpexService } from "../services/tcoCapexOpexService.js";

beforeEach(() => {
  TcoCapexOpexService._reset();
});

describe("TCO Capex/Opex — /api/tco-capex-opex", () => {
  describe("POST /simulacoes", () => {
    it("cria simulação com dados válidos → 201", async () => {
      const res = await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "cemig-invest",
        titulo: "TCO Smart Grid Zona Sul",
        tipoInvestimento: "smart_grid",
        responsavel: "Eng. Ferreira",
        horizonte: 20,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("tco-1");
      expect(res.body.horizonte).toBe(20);
      expect(res.body.status).toBe("rascunho");
    });

    it("limita horizonte ao máximo de 30 anos", async () => {
      const res = await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "t1",
        titulo: "TCO Horizonte Longo",
        tipoInvestimento: "nova_rede",
        responsavel: "Eng. R",
        horizonte: 50,
      });
      expect(res.status).toBe(400);
    });

    it("rejeita tipo de investimento inválido → 400", async () => {
      const res = await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "t1",
        titulo: "TCO Inválido",
        tipoInvestimento: "tipo_inexistente",
        responsavel: "Eng. X",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /simulacoes", () => {
    it("retorna lista vazia", async () => {
      const res = await request(app).get("/api/tco-capex-opex/simulacoes");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "tA", titulo: "TCO Tenant A", tipoInvestimento: "modernizacao", responsavel: "Eng A",
      });
      await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "tB", titulo: "TCO Tenant B", tipoInvestimento: "digitalizacao", responsavel: "Eng B",
      });
      const res = await request(app).get("/api/tco-capex-opex/simulacoes?tenantId=tA");
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /simulacoes/:id", () => {
    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/tco-capex-opex/simulacoes/tco-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /simulacoes/:id/capex", () => {
    beforeEach(async () => {
      await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "t1", titulo: "TCO Base CAPEX", tipoInvestimento: "automacao", responsavel: "Eng Base",
      });
    });

    it("adiciona item CAPEX → 201", async () => {
      const res = await request(app)
        .post("/api/tco-capex-opex/simulacoes/tco-1/capex")
        .send({
          descricao: "Aquisição de religadores automáticos",
          categoria: "Equipamentos",
          anoDesembolso: 0,
          valorReais: 250000,
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("cx-1");
    });

    it("rejeita dados inválidos → 400", async () => {
      const res = await request(app)
        .post("/api/tco-capex-opex/simulacoes/tco-1/capex")
        .send({ descricao: "Ab", categoria: "X", anoDesembolso: -1, valorReais: -100 });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /simulacoes/:id/opex", () => {
    beforeEach(async () => {
      await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "t1", titulo: "TCO Base OPEX", tipoInvestimento: "reducao_perdas", responsavel: "Eng Base",
      });
    });

    it("adiciona item OPEX → 201", async () => {
      const res = await request(app)
        .post("/api/tco-capex-opex/simulacoes/tco-1/opex")
        .send({
          descricao: "Manutenção anual religadores",
          categoria: "Manutenção",
          custoAnual: 12000,
          anoInicio: 1,
          anoFim: null,
          taxaCrescimentoAnual: 0.03,
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("ox-1");
    });
  });

  describe("POST /simulacoes/:id/calcular", () => {
    it("calcula TCO com VPL e payback → 200", async () => {
      await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "t1", titulo: "TCO Completo", tipoInvestimento: "smart_grid",
        responsavel: "Eng Calc", horizonte: 10,
      });
      await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/capex").send({
        descricao: "Investimento inicial redes inteligentes",
        categoria: "Infraestrutura",
        anoDesembolso: 0,
        valorReais: 500000,
      });
      await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/opex").send({
        descricao: "Operação e manutenção anual",
        categoria: "O&M",
        custoAnual: 30000,
        anoInicio: 1,
        anoFim: null,
        taxaCrescimentoAnual: 0,
      });
      // Definir benefícios: R$100k/ano
      await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/beneficios").send({
        beneficiosAnuais: { 1: 100000, 2: 100000, 3: 100000, 4: 100000, 5: 100000,
                           6: 100000, 7: 100000, 8: 100000, 9: 100000, 10: 100000 },
      });
      const res = await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.capexTotal).toBe(500000);
      expect(res.body.vplTCO).toBeGreaterThan(0);
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
    });

    it("retorna 422 sem CAPEX ou OPEX", async () => {
      await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "t1", titulo: "TCO Vazio", tipoInvestimento: "outro", responsavel: "Eng V",
      });
      const res = await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("POST /simulacoes/:id/aprovar", () => {
    it("aprova simulação calculada → 200", async () => {
      await request(app).post("/api/tco-capex-opex/simulacoes").send({
        tenantId: "t1", titulo: "TCO Aprovar", tipoInvestimento: "expansao_rede",
        responsavel: "Eng Ap", horizonte: 5,
      });
      await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/capex").send({
        descricao: "Obra de expansão BT",
        categoria: "Civil",
        anoDesembolso: 0,
        valorReais: 80000,
      });
      await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/calcular");
      const res = await request(app).post("/api/tco-capex-opex/simulacoes/tco-1/aprovar");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("aprovado");
    });
  });

  describe("GET /tipos-investimento", () => {
    it("retorna lista de tipos → 200", async () => {
      const res = await request(app).get("/api/tco-capex-opex/tipos-investimento");
      expect(res.status).toBe(200);
      expect(res.body).toContain("smart_grid");
      expect(res.body).toContain("nova_rede");
    });
  });
});
