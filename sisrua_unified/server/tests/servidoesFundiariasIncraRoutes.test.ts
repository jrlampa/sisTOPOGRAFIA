/**
 * Testes T2-107 — Servidões Fundiárias SIRGAS 2000 (INCRA/SIGEF)
 */

import request from "supertest";
import app from "../app.js";
import { ServidoesFundiariasIncraService } from "../services/servidoesFundiariasIncraService.js";

beforeEach(() => {
  ServidoesFundiariasIncraService._reset();
});

// Vértices de um quadrado ~100m × 100m em SIRGAS 2000
const VERTICES_BASE = [
  { codigo: "M-01", latitude: -23.5505, longitude: -46.6333, precisaoM: 0.3, metodoLevantamento: "GNSS_RTK", descricaoLocalizacao: "Canto NW — junto ao poste 1" },
  { codigo: "M-02", latitude: -23.5505, longitude: -46.6324, precisaoM: 0.3, metodoLevantamento: "GNSS_RTK", descricaoLocalizacao: "Canto NE — junto ao poste 2" },
  { codigo: "M-03", latitude: -23.5514, longitude: -46.6324, precisaoM: 0.4, metodoLevantamento: "GNSS_RTK", descricaoLocalizacao: "Canto SE — junto ao poste 3" },
  { codigo: "M-04", latitude: -23.5514, longitude: -46.6333, precisaoM: 0.4, metodoLevantamento: "GNSS_RTK", descricaoLocalizacao: "Canto SW — junto ao poste 4" },
];

describe("Servidões Fundiárias INCRA — /api/servidoes-fundiarias-incra", () => {
  describe("POST /processos", () => {
    it("cria processo com dados válidos → 201", async () => {
      const res = await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "cemig-fundiario",
        titulo: "Servidão de Passagem LT 138 kV",
        tipoServidao: "eletrica",
        matriculaImovelServiente: "123.456-MG",
        municipio: "Contagem",
        uf: "MG",
        classePrecisaoExigida: "A",
        responsavelTecnico: "Eng. Topógrafo Silva",
        creaResponsavel: "CREA-MG-123456",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("sf-1");
      expect(res.body.uf).toBe("MG");
      expect(res.body.status).toBe("em_tramitacao");
      expect(res.body.classePrecisaoExigida).toBe("A");
    });

    it("normaliza UF para maiúsculas", async () => {
      const res = await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "t1", titulo: "Servidão UF Minúscula",
        tipoServidao: "passagem", matriculaImovelServiente: "987.654-SP",
        municipio: "Campinas", uf: "sp",
        responsavelTecnico: "Eng. T",
      });
      expect(res.status).toBe(201);
      expect(res.body.uf).toBe("SP");
    });

    it("rejeita UF com tamanho inválido → 400", async () => {
      const res = await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "t1", titulo: "Processo Inválido",
        tipoServidao: "eletrica", matriculaImovelServiente: "000",
        municipio: "SP", uf: "SPX", responsavelTecnico: "Eng T",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /processos", () => {
    it("retorna lista vazia inicialmente", async () => {
      const res = await request(app).get("/api/servidoes-fundiarias-incra/processos");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("filtra por tenantId", async () => {
      await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "tA", titulo: "Servidão Tenant A",
        tipoServidao: "faixa_dominio", matriculaImovelServiente: "A-001",
        municipio: "Brasília", uf: "DF", responsavelTecnico: "Eng A",
      });
      await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "tB", titulo: "Servidão Tenant B",
        tipoServidao: "reserva_legal", matriculaImovelServiente: "B-002",
        municipio: "Curitiba", uf: "PR", responsavelTecnico: "Eng B",
      });
      const res = await request(app).get("/api/servidoes-fundiarias-incra/processos?tenantId=tA");
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /processos/:id", () => {
    it("retorna 404 para id inexistente", async () => {
      const res = await request(app).get("/api/servidoes-fundiarias-incra/processos/sf-999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /processos/:id/vertices", () => {
    beforeEach(async () => {
      await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "t1", titulo: "Servidão Elétrica Piloto",
        tipoServidao: "eletrica", matriculaImovelServiente: "P-001",
        municipio: "Belo Horizonte", uf: "MG",
        responsavelTecnico: "Eng Piloto",
      });
    });

    it("adiciona vértice → 201", async () => {
      const res = await request(app)
        .post("/api/servidoes-fundiarias-incra/processos/sf-1/vertices")
        .send(VERTICES_BASE[0]);
      expect(res.status).toBe(201);
      expect(res.body.id).toBe("vt-1");
      expect(res.body.codigo).toBe("M-01");
    });

    it("rejeita latitude fora do range → 400", async () => {
      const res = await request(app)
        .post("/api/servidoes-fundiarias-incra/processos/sf-1/vertices")
        .send({ ...VERTICES_BASE[0], latitude: 200 });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /processos/:id/confrontantes", () => {
    beforeEach(async () => {
      await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "t1", titulo: "Servidão Confrontante",
        tipoServidao: "passagem", matriculaImovelServiente: "C-001",
        municipio: "Fortaleza", uf: "CE",
        responsavelTecnico: "Eng C",
      });
    });

    it("adiciona confrontante e protege CPF/CNPJ → 201", async () => {
      const res = await request(app)
        .post("/api/servidoes-fundiarias-incra/processos/sf-1/confrontantes")
        .send({
          nome: "Fazenda São João Ltda",
          cpfCnpj: "12.345.678/0001-99",
          lado: "norte",
          matriculaImovel: "R.001.S1.P23456",
        });
      expect(res.status).toBe(201);
      expect(res.body.cpfCnpjHash).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.cpfCnpjHash).not.toContain("12345678");
    });
  });

  describe("POST /processos/:id/calcular", () => {
    it("calcula área e perímetro → 200", async () => {
      await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "t1", titulo: "Cálculo GNSS",
        tipoServidao: "eletrica", matriculaImovelServiente: "G-001",
        municipio: "São Paulo", uf: "SP",
        responsavelTecnico: "Eng G",
      });
      for (const v of VERTICES_BASE) {
        await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/vertices").send(v);
      }
      const res = await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/calcular");
      expect(res.status).toBe(200);
      expect(res.body.areaHa).toBeGreaterThan(0);
      expect(res.body.perimetroM).toBeGreaterThan(0);
      expect(res.body.hashIntegridade).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.classePrecisaoAtingida).toBe("A");
    });

    it("retorna 422 com menos de 3 vértices", async () => {
      await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "t1", titulo: "Sem Vértices",
        tipoServidao: "passagem", matriculaImovelServiente: "V-001",
        municipio: "Rio", uf: "RJ", responsavelTecnico: "Eng V",
      });
      await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/vertices").send(VERTICES_BASE[0]);
      await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/vertices").send(VERTICES_BASE[1]);
      const res = await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/calcular");
      expect(res.status).toBe(422);
    });
  });

  describe("POST /processos/:id/certificar", () => {
    it("certifica processo com cálculo e confrontante → 200", async () => {
      await request(app).post("/api/servidoes-fundiarias-incra/processos").send({
        tenantId: "t1", titulo: "Certificação Final",
        tipoServidao: "faixa_dominio", matriculaImovelServiente: "F-001",
        municipio: "Recife", uf: "PE", responsavelTecnico: "Eng F",
      });
      for (const v of VERTICES_BASE) {
        await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/vertices").send(v);
      }
      await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/confrontantes").send({
        nome: "Vizinho Norte Ltda", cpfCnpj: "98765432000155", lado: "norte",
      });
      await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/calcular");
      const res = await request(app).post("/api/servidoes-fundiarias-incra/processos/sf-1/certificar");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("certificada");
    });
  });

  describe("GET /tipos-servidao", () => {
    it("retorna lista de tipos → 200", async () => {
      const res = await request(app).get("/api/servidoes-fundiarias-incra/tipos-servidao");
      expect(res.status).toBe(200);
      expect(res.body).toContain("eletrica");
      expect(res.body).toContain("faixa_dominio");
    });
  });
});
