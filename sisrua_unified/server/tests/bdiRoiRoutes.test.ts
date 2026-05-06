/**
 * bdiRoiRoutes.test.ts — Testes BDI/ROI Analytics (T2-43).
 */

import request from "supertest";
import app from "../app.js";
import { BdiRoiService } from "../services/bdiRoiService.js";

beforeEach(() => {
  BdiRoiService._reset();
});

const TENANT = "tenant-bdi-test";

const COMPONENTES_PADRAO = {
  administracaoCentral: 0.05,
  seguroRisco: 0.03,
  despesasFinanceiras: 0.012,
  lucro: 0.09,
  iss: 0.03,
  pis: 0.0065,
  cofins: 0.03,
  irpjCsll: 0.0348,
};

describe("POST /api/bdi-roi/calcular-bdi", () => {
  it("calcula BDI para distribuição elétrica", async () => {
    const res = await request(app)
      .post("/api/bdi-roi/calcular-bdi")
      .send({
        tipoObra: "distribuicao_eletrica",
        tenantId: TENANT,
        componentes: COMPONENTES_PADRAO,
        custoDirectoBase: 100000,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^bdi-/);
    expect(res.body.percentualBdi).toBeGreaterThan(0);
    expect(res.body.custoComBdi).toBeGreaterThan(100000);
    expect(res.body.hashIntegridade).toHaveLength(64);
  });

  it("retorna 400 para payload inválido", async () => {
    const res = await request(app).post("/api/bdi-roi/calcular-bdi").send({ tenantId: TENANT });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tipoObra inválido", async () => {
    const res = await request(app).post("/api/bdi-roi/calcular-bdi").send({
      tipoObra: "tipo_invalido",
      tenantId: TENANT,
      componentes: COMPONENTES_PADRAO,
      custoDirectoBase: 50000,
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/bdi-roi/analises-bdi", () => {
  it("lista análises BDI do tenant", async () => {
    await request(app).post("/api/bdi-roi/calcular-bdi").send({
      tipoObra: "subestacao",
      tenantId: TENANT,
      componentes: COMPONENTES_PADRAO,
      custoDirectoBase: 250000,
    });
    const res = await request(app).get(`/api/bdi-roi/analises-bdi?tenantId=${TENANT}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("retorna 400 sem tenantId", async () => {
    const res = await request(app).get("/api/bdi-roi/analises-bdi");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/bdi-roi/analises-bdi/:id", () => {
  it("busca análise BDI por id", async () => {
    const criado = await request(app).post("/api/bdi-roi/calcular-bdi").send({
      tipoObra: "iluminacao_publica",
      tenantId: TENANT,
      componentes: COMPONENTES_PADRAO,
      custoDirectoBase: 80000,
    });
    const res = await request(app).get(`/api/bdi-roi/analises-bdi/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tipoObra).toBe("iluminacao_publica");
  });

  it("retorna 404 para id inexistente", async () => {
    const res = await request(app).get("/api/bdi-roi/analises-bdi/bdi-9999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/bdi-roi/referencias", () => {
  it("lista todos os referenciais BDI TCU", async () => {
    const res = await request(app).get("/api/bdi-roi/referencias");
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("filtra por tipoObra", async () => {
    const res = await request(app).get("/api/bdi-roi/referencias?tipoObra=distribuicao_eletrica");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.referencias[0].tipoObra).toBe("distribuicao_eletrica");
  });

  it("retorna 400 para tipoObra inválido", async () => {
    const res = await request(app).get("/api/bdi-roi/referencias?tipoObra=invalido");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bdi-roi/calcular-roi", () => {
  it("calcula ROI com projeto viável", async () => {
    const res = await request(app).post("/api/bdi-roi/calcular-roi").send({
      descricao: "Projeto LED IP Centro",
      tenantId: TENANT,
      investimentoInicial: 500000,
      taxaDesconto: 0.10,
      fluxosCaixa: [
        { ano: 1, fluxo: 120000 },
        { ano: 2, fluxo: 120000 },
        { ano: 3, fluxo: 120000 },
        { ano: 4, fluxo: 120000 },
        { ano: 5, fluxo: 120000 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^roi-/);
    expect(res.body.vpl).toBeDefined();
    expect(res.body.tir).toBeDefined();
    expect(res.body.paybackSimples).toBeLessThanOrEqual(5);
  });

  it("calcula ROI com projeto inviável", async () => {
    const res = await request(app).post("/api/bdi-roi/calcular-roi").send({
      descricao: "Projeto com retorno insuficiente",
      tenantId: TENANT,
      investimentoInicial: 1000000,
      taxaDesconto: 0.15,
      fluxosCaixa: [
        { ano: 1, fluxo: 50000 },
        { ano: 2, fluxo: 50000 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.viavel).toBe(false);
    expect(res.body.paybackSimples).toBeNull();
  });

  it("retorna 400 para payload inválido", async () => {
    const res = await request(app).post("/api/bdi-roi/calcular-roi").send({ tenantId: TENANT });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/bdi-roi/analises-roi", () => {
  it("lista análises ROI do tenant", async () => {
    await request(app).post("/api/bdi-roi/calcular-roi").send({
      descricao: "ROI Teste",
      tenantId: TENANT,
      investimentoInicial: 200000,
      taxaDesconto: 0.08,
      fluxosCaixa: [{ ano: 1, fluxo: 80000 }, { ano: 2, fluxo: 80000 }, { ano: 3, fluxo: 80000 }],
    });
    const res = await request(app).get(`/api/bdi-roi/analises-roi?tenantId=${TENANT}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });
});

describe("GET /api/bdi-roi/analises-roi/:id", () => {
  it("busca análise ROI por id", async () => {
    const criado = await request(app).post("/api/bdi-roi/calcular-roi").send({
      descricao: "ROI Por ID",
      tenantId: TENANT,
      investimentoInicial: 100000,
      taxaDesconto: 0.10,
      fluxosCaixa: [{ ano: 1, fluxo: 40000 }, { ano: 2, fluxo: 40000 }, { ano: 3, fluxo: 40000 }],
    });
    const res = await request(app).get(`/api/bdi-roi/analises-roi/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.investimentoInicial).toBe(100000);
  });

  it("retorna 404 para id inexistente", async () => {
    const res = await request(app).get("/api/bdi-roi/analises-roi/roi-9999");
    expect(res.status).toBe(404);
  });
});
