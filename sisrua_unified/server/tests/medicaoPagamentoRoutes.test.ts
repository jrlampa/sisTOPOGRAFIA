/**
 * Testes T2-65 — Módulo de Medição para Pagamento (EAP/WBS)
 */

import request from "supertest";
import app from "../app.js";
import { MedicaoPagamentoService } from "../services/medicaoPagamentoService.js";

beforeEach(() => {
  MedicaoPagamentoService._reset();
});

describe("Medição para Pagamento — /api/medicao-pagamento", () => {
  describe("POST /medicoes", () => {
    it("cria medição com dados válidos → 201", async () => {
      const res = await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "construtora-abc",
        titulo: "Medição Nº 1 — Obra LT 138 kV",
        contratoRef: "CT-2024-001",
        periodo: "2024-04",
        medicaoNumero: 1,
        concessionaria: "CEMIG-D",
        responsavel: "Eng. Ferreira",
        retencaoPercentual: 5,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("med-1");
      expect(res.body.retencaoPercentual).toBe(5);
      expect(res.body.status).toBe("em_elaboracao");
    });

    it("usa retenção padrão 5% quando omitida", async () => {
      const res = await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "t1", titulo: "Medição Padrão",
        contratoRef: "CT-000", periodo: "2024-05",
        medicaoNumero: 1, concessionaria: "COELBA",
        responsavel: "Eng P",
      });
      expect(res.status).toBe(201);
      expect(res.body.retencaoPercentual).toBe(5);
    });

    it("rejeita retenção acima de 30% → 400", async () => {
      const res = await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "t1", titulo: "Retenção Alta",
        contratoRef: "CT-X", periodo: "2024-06",
        medicaoNumero: 1, concessionaria: "X",
        responsavel: "Eng X", retencaoPercentual: 50,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /medicoes", () => {
    it("retorna lista vazia", async () => {
      const res = await request(app).get("/api/medicao-pagamento/medicoes");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "tA", titulo: "Med Tenant A", contratoRef: "CT-A",
        periodo: "2024-04", medicaoNumero: 1, concessionaria: "EDP",
        responsavel: "Eng A",
      });
      await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "tB", titulo: "Med Tenant B", contratoRef: "CT-B",
        periodo: "2024-05", medicaoNumero: 1, concessionaria: "LIGHT",
        responsavel: "Eng B",
      });
      const res = await request(app).get("/api/medicao-pagamento/medicoes?tenantId=tA");
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /medicoes/:id", () => {
    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/medicao-pagamento/medicoes/med-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /medicoes/:id/itens", () => {
    beforeEach(async () => {
      await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "t1", titulo: "Medição Base",
        contratoRef: "CT-BASE", periodo: "2024-04",
        medicaoNumero: 1, concessionaria: "ENERGISA",
        responsavel: "Eng Base",
      });
    });

    it("adiciona item WBS → 201", async () => {
      const res = await request(app)
        .post("/api/medicao-pagamento/medicoes/med-1/itens")
        .send({
          wbsCode: "1.2.1",
          descricao: "Montagem de postes de concreto",
          tipoServico: "montagem_eletrica",
          unidade: "un",
          quantidadeContratada: 100,
          quantidadeMedida: 40,
          valorUnitario: 350,
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("im-1");
      expect(res.body.valorTotal).toBe(14000);
      expect(res.body.percentualContrato).toBeCloseTo(40);
    });

    it("rejeita quantidade medida > contratada → 422", async () => {
      const res = await request(app)
        .post("/api/medicao-pagamento/medicoes/med-1/itens")
        .send({
          wbsCode: "1.3.1", descricao: "Cabo multiplexado",
          tipoServico: "fornecimento_material", unidade: "m",
          quantidadeContratada: 500, quantidadeMedida: 600,
          valorUnitario: 25,
        });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /medicoes/:id/calcular", () => {
    it("calcula totais e retenção → 200", async () => {
      await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "t1", titulo: "Medição Calcular",
        contratoRef: "CT-CALC", periodo: "2024-04",
        medicaoNumero: 2, concessionaria: "COPEL",
        responsavel: "Eng Calc", retencaoPercentual: 10,
      });
      await request(app).post("/api/medicao-pagamento/medicoes/med-1/itens").send({
        wbsCode: "2.1.1", descricao: "Instalação de transformadores",
        tipoServico: "instalacao_equipamentos", unidade: "un",
        quantidadeContratada: 5, quantidadeMedida: 3, valorUnitario: 20000,
      });
      await request(app).post("/api/medicao-pagamento/medicoes/med-1/itens").send({
        wbsCode: "2.1.2", descricao: "Obras civis fundação",
        tipoServico: "obras_civis", unidade: "m³",
        quantidadeContratada: 100, quantidadeMedida: 60, valorUnitario: 800,
      });
      const res = await request(app).post("/api/medicao-pagamento/medicoes/med-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.totalBruto).toBe(108000);          // 60000 + 48000
      expect(res.body.retencao).toBeCloseTo(10800);      // 10%
      expect(res.body.totalLiquido).toBeCloseTo(97200);
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
    });

    it("retorna 422 sem itens", async () => {
      await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "t1", titulo: "Medição Vazia",
        contratoRef: "CT-V", periodo: "2024-05",
        medicaoNumero: 1, concessionaria: "ENEL",
        responsavel: "Eng V",
      });
      const res = await request(app).post("/api/medicao-pagamento/medicoes/med-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("Fluxo completo: calcular → submeter → aprovar → homologar", () => {
    it("executa fluxo de aprovação completo", async () => {
      await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "t1", titulo: "Medição Fluxo",
        contratoRef: "CT-F", periodo: "2024-06",
        medicaoNumero: 3, concessionaria: "AES",
        responsavel: "Eng Fluxo",
      });
      await request(app).post("/api/medicao-pagamento/medicoes/med-1/itens").send({
        wbsCode: "3.1.1", descricao: "Mobilização equipes",
        tipoServico: "mobilizacao", unidade: "vb",
        quantidadeContratada: 1, quantidadeMedida: 1, valorUnitario: 15000,
      });
      await request(app).post("/api/medicao-pagamento/medicoes/med-1/calcular");

      const sub = await request(app).post("/api/medicao-pagamento/medicoes/med-1/submeter");
      expect(sub.body.status).toBe("submetida");

      const ap = await request(app).post("/api/medicao-pagamento/medicoes/med-1/aprovar");
      expect(ap.body.status).toBe("aprovada");

      const hom = await request(app).post("/api/medicao-pagamento/medicoes/med-1/homologar");
      expect(hom.body.status).toBe("homologada");
    });
  });

  describe("POST /medicoes/:id/rejeitar", () => {
    it("rejeita medição submetida com motivo → 200", async () => {
      await request(app).post("/api/medicao-pagamento/medicoes").send({
        tenantId: "t1", titulo: "Medição Rejeitar",
        contratoRef: "CT-R", periodo: "2024-07",
        medicaoNumero: 4, concessionaria: "ELETROPAULO",
        responsavel: "Eng R",
      });
      await request(app).post("/api/medicao-pagamento/medicoes/med-1/itens").send({
        wbsCode: "4.1.1", descricao: "Ensaios elétricos",
        tipoServico: "ensaios", unidade: "vb",
        quantidadeContratada: 1, quantidadeMedida: 1, valorUnitario: 5000,
      });
      await request(app).post("/api/medicao-pagamento/medicoes/med-1/calcular");
      await request(app).post("/api/medicao-pagamento/medicoes/med-1/submeter");
      const res = await request(app).post("/api/medicao-pagamento/medicoes/med-1/rejeitar")
        .send({ motivo: "Documentação comprobatória incompleta" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("rejeitada");
      expect(res.body.motivoRejeicao).toMatch(/incompleta/);
    });
  });

  describe("GET /tipos-servico", () => {
    it("retorna lista de tipos → 200", async () => {
      const res = await request(app).get("/api/medicao-pagamento/tipos-servico");
      expect(res.status).toBe(200);
      expect(res.body).toContain("montagem_eletrica");
      expect(res.body).toContain("obras_civis");
    });
  });
});
