/**
 * businessKpiRoutes.test.ts
 * Testes de integração das rotas de observabilidade de negócio (Item 125 [T1]).
 */

import express from "express";
import request from "supertest";
import { clearAllKpiEvents } from "../services/businessKpiService.js";

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const TOKEN = "kpi-admin-token-xyz";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();
  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: businessKpiRoutes } = await import("../routes/businessKpiRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/business-kpi", businessKpiRoutes);
  return app;
}

beforeEach(() => clearAllKpiEvents());
afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  clearAllKpiEvents();
});

// ─── POST /:tenantId/eventos — registra evento ────────────────────────────────

describe("POST /api/business-kpi/:tenantId/eventos", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/business-kpi/empresa-a/eventos")
      .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 1000 });
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/business-kpi/);
  });

  it("registra evento e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/business-kpi/empresa-a/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 1500 });
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe("exportacao_dxf");
    expect(res.body.resultado).toBe("sucesso");
    expect(res.body.duracaoMs).toBe(1500);
  });

  it("registra evento com projetoId, regiao e metadados", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/business-kpi/empresa-b/eventos")
      .set("Authorization", AUTH)
      .send({
        tipo: "analise_rede",
        resultado: "retrabalho",
        duracaoMs: 3000,
        projetoId: "P-001",
        regiao: "Sul",
        metadados: { linhas: 50 },
      });
    expect(res.status).toBe(201);
    expect(res.body.projetoId).toBe("P-001");
    expect(res.body.regiao).toBe("sul");
  });

  it("retorna 400 para tipo inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/business-kpi/empresa-c/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "tipo_invalido", resultado: "sucesso", duracaoMs: 100 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para resultado inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/business-kpi/empresa-c/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "resultado_invalido", duracaoMs: 100 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para duracaoMs negativa", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/business-kpi/empresa-c/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: -1 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tenantId com '..'", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/business-kpi/emp..evil/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 100 });
    expect(res.status).toBe(400);
  });

  it("funciona sem token em modo dev", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .post("/api/business-kpi/empresa-dev/eventos")
      .send({ tipo: "relatorio", resultado: "sucesso", duracaoMs: 500 });
    expect(res.status).toBe(201);
  });
});

// ─── GET /:tenantId/relatorio ─────────────────────────────────────────────────

describe("GET /api/business-kpi/:tenantId/relatorio", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/business-kpi/empresa-a/relatorio");
    expect(res.status).toBe(401);
  });

  it("retorna 200 com relatório vazio para tenant sem eventos", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/business-kpi/empresa-a/relatorio")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.global.total).toBe(0);
    expect(res.body.global.taxaSucesso).toBe(1);
    expect(res.body.gargalosRegionais).toEqual([]);
  });

  it("retorna taxaSucesso e indiceRetrabalho corretos", async () => {
    const app = await buildApp(TOKEN);
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/business-kpi/empresa-d/eventos")
        .set("Authorization", AUTH)
        .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 100 });
    }
    await request(app)
      .post("/api/business-kpi/empresa-d/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "retrabalho", duracaoMs: 200 });
    const res = await request(app)
      .get("/api/business-kpi/empresa-d/relatorio")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.global.total).toBe(4);
    expect(res.body.global.retrabalhos).toBe(1);
    expect(res.body.global.indiceRetrabalho).toBeCloseTo(0.25, 2);
  });

  it("retorna 400 para parâmetros de período inválidos", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/business-kpi/empresa-e/relatorio?de=data_invalida")
      .set("Authorization", AUTH);
    expect(res.status).toBe(400);
  });
});

// ─── GET /:tenantId/gargalos ──────────────────────────────────────────────────

describe("GET /api/business-kpi/:tenantId/gargalos", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/business-kpi/empresa-a/gargalos");
    expect(res.status).toBe(401);
  });

  it("retorna gargalos regionais com todos os campos", async () => {
    const app = await buildApp(TOKEN);
    // Região com alta taxa de falha
    for (let i = 0; i < 8; i++) {
      await request(app)
        .post("/api/business-kpi/empresa-f/eventos")
        .set("Authorization", AUTH)
        .send({ tipo: "analise_rede", resultado: "falha", duracaoMs: 1000, regiao: "Norte" });
    }
    await request(app)
      .post("/api/business-kpi/empresa-f/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "analise_rede", resultado: "sucesso", duracaoMs: 1000, regiao: "Norte" });
    const res = await request(app)
      .get("/api/business-kpi/empresa-f/gargalos")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.gargalosRegionais[0].regiao).toBe("norte");
    expect(res.body.gargalosRegionais[0].ehGargalo).toBe(true);
  });

  it("filtra apenas gargalos reais com apenasGargalos=true", async () => {
    const app = await buildApp(TOKEN);
    // Região saudável
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/business-kpi/empresa-g/eventos")
        .set("Authorization", AUTH)
        .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 500, regiao: "Sul" });
    }
    // Região gargalo
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/business-kpi/empresa-g/eventos")
        .set("Authorization", AUTH)
        .send({ tipo: "exportacao_dxf", resultado: "falha", duracaoMs: 500, regiao: "Norte" });
    }
    const res = await request(app)
      .get("/api/business-kpi/empresa-g/gargalos?apenasGargalos=true")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.gargalosRegionais).toHaveLength(1);
    expect(res.body.gargalosRegionais[0].regiao).toBe("norte");
  });
});

// ─── GET /:tenantId/eventos — lista eventos com filtros ───────────────────────

describe("GET /api/business-kpi/:tenantId/eventos", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/business-kpi/empresa-a/eventos");
    expect(res.status).toBe(401);
  });

  it("retorna 200 com lista vazia para tenant sem eventos", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/business-kpi/empresa-h/eventos")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.eventos).toEqual([]);
  });

  it("lista todos os eventos do tenant", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/business-kpi/empresa-i/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 100 });
    await request(app)
      .post("/api/business-kpi/empresa-i/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "calculo_bt", resultado: "falha", duracaoMs: 200 });
    const res = await request(app)
      .get("/api/business-kpi/empresa-i/eventos")
      .set("Authorization", AUTH);
    expect(res.body.total).toBe(2);
    expect(res.body.eventos).toHaveLength(2);
  });

  it("filtra por tipo via query string", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/business-kpi/empresa-j/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 100 });
    await request(app)
      .post("/api/business-kpi/empresa-j/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "calculo_bt", resultado: "sucesso", duracaoMs: 200 });
    const res = await request(app)
      .get("/api/business-kpi/empresa-j/eventos?tipo=exportacao_dxf")
      .set("Authorization", AUTH);
    expect(res.body.total).toBe(1);
    expect(res.body.eventos[0].tipo).toBe("exportacao_dxf");
  });

  it("filtra por resultado via query string", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/business-kpi/empresa-k/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "sucesso", duracaoMs: 100 });
    await request(app)
      .post("/api/business-kpi/empresa-k/eventos")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", resultado: "falha", duracaoMs: 200 });
    const res = await request(app)
      .get("/api/business-kpi/empresa-k/eventos?resultado=falha")
      .set("Authorization", AUTH);
    expect(res.body.total).toBe(1);
    expect(res.body.eventos[0].resultado).toBe("falha");
  });

  it("retorna 400 para tipo inválido na query", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/business-kpi/empresa-l/eventos?tipo=invalido")
      .set("Authorization", AUTH);
    expect(res.status).toBe(400);
  });
});
