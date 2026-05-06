import { vi } from "vitest";
/**
 * costCenterRoutes.test.ts
 * Testes de integração das rotas de centros de custo (Roadmap Item 36 [T2]).
 */

import express from "express";
import request from "supertest";
import { clearAllCostCenters } from "../services/costCenterService.js";

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const TOKEN = "cc-admin-token-xyz";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  vi.resetModules();
  vi.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: costCenterRoutes } = await import("../routes/costCenterRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/cost-centers", costCenterRoutes);
  return app;
}

beforeEach(() => {
  clearAllCostCenters();
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  clearAllCostCenters();
});

// ─── GET /:tenantId — lista CCs ───────────────────────────────────────────────

describe("GET /api/cost-centers/:tenantId", () => {
  it("retorna 200 com lista vazia para tenant sem CCs", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/cost-centers/empresa-a");
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("empresa-a");
    expect(res.body.centros).toEqual([]);
  });

  it("retorna 400 para tenantId com '..'", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/cost-centers/emp..evil");
    expect(res.status).toBe(400);
  });

  it("lista CCs após criação", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-a")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI" });
    const res = await request(app).get("/api/cost-centers/empresa-a");
    expect(res.status).toBe(200);
    expect(res.body.centros).toHaveLength(1);
    expect(res.body.centros[0].id).toBe("ti");
  });

  it("filtra apenas ativos com apenasAtivos=true", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-b")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI" });
    await request(app)
      .post("/api/cost-centers/empresa-b")
      .set("Authorization", AUTH)
      .send({ id: "ops", nome: "Ops" });
    await request(app)
      .delete("/api/cost-centers/empresa-b/ops")
      .set("Authorization", AUTH);
    const res = await request(app).get(
      "/api/cost-centers/empresa-b?apenasAtivos=true",
    );
    expect(res.body.centros).toHaveLength(1);
    expect(res.body.centros[0].id).toBe("ti");
  });
});

// ─── GET /:tenantId/relatorio ─────────────────────────────────────────────────

describe("GET /api/cost-centers/:tenantId/relatorio", () => {
  it("retorna 200 com relatório vazio", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/cost-centers/empresa-c/relatorio");
    expect(res.status).toBe(200);
    expect(res.body.totalGeral).toBe(0);
    expect(res.body.centros).toEqual([]);
  });

  it("retorna totais corretos após imputações", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-c")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI" });
    await request(app)
      .post("/api/cost-centers/empresa-c/ti/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "processamento", valor: 10, descricao: "job" });
    const res = await request(app).get(
      "/api/cost-centers/empresa-c/relatorio",
    );
    expect(res.body.totalGeral).toBe(10);
    expect(res.body.centros[0].totalPorTipo.processamento).toBe(10);
  });
});

// ─── GET /:tenantId/:ccId ─────────────────────────────────────────────────────

describe("GET /api/cost-centers/:tenantId/:ccId", () => {
  it("retorna 200 com CC existente", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-d")
      .set("Authorization", AUTH)
      .send({ id: "fin", nome: "Financeiro" });
    const res = await request(app).get("/api/cost-centers/empresa-d/fin");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("fin");
    expect(res.body.nome).toBe("Financeiro");
  });

  it("retorna 404 para CC inexistente", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get(
      "/api/cost-centers/empresa-d/nao-existe",
    );
    expect(res.status).toBe(404);
  });

  it("retorna 400 para ccId inválido", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/cost-centers/empresa-d/CC INVALIDO");
    expect(res.status).toBe(400);
  });
});

// ─── GET /:tenantId/:ccId/registros ──────────────────────────────────────────

describe("GET /api/cost-centers/:tenantId/:ccId/registros", () => {
  it("retorna 200 com lista de registros", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-e")
      .set("Authorization", AUTH)
      .send({ id: "ops", nome: "Ops" });
    await request(app)
      .post("/api/cost-centers/empresa-e/ops/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "api_externa", valor: 3, descricao: "OSM call" });
    const res = await request(app).get(
      "/api/cost-centers/empresa-e/ops/registros",
    );
    expect(res.status).toBe(200);
    expect(res.body.registros).toHaveLength(1);
    expect(res.body.registros[0].tipo).toBe("api_externa");
  });

  it("filtra por tipo via query string", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-e")
      .set("Authorization", AUTH)
      .send({ id: "ops2", nome: "Ops2" });
    await request(app)
      .post("/api/cost-centers/empresa-e/ops2/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "processamento", valor: 1, descricao: "p1" });
    await request(app)
      .post("/api/cost-centers/empresa-e/ops2/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "armazenamento", valor: 2, descricao: "a1" });
    const res = await request(app).get(
      "/api/cost-centers/empresa-e/ops2/registros?tipo=processamento",
    );
    expect(res.body.registros).toHaveLength(1);
    expect(res.body.registros[0].tipo).toBe("processamento");
  });
});

// ─── POST /:tenantId — cria CC ────────────────────────────────────────────────

describe("POST /api/cost-centers/:tenantId (admin)", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/cost-centers/empresa-f")
      .send({ id: "ti", nome: "TI" });
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/cost-centers-admin/);
  });

  it("cria CC e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/cost-centers/empresa-f")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI", descricao: "Área de TI" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ti");
    expect(res.body.ativo).toBe(true);
  });

  it("retorna 409 para CC duplicado", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-f")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI" });
    const res = await request(app)
      .post("/api/cost-centers/empresa-f")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI Duplicado" });
    expect(res.status).toBe(409);
  });

  it("retorna 400 para corpo inválido (nome vazio)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/cost-centers/empresa-f")
      .set("Authorization", AUTH)
      .send({ id: "cc1", nome: "" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para id ausente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/cost-centers/empresa-f")
      .set("Authorization", AUTH)
      .send({ nome: "Sem ID" });
    expect(res.status).toBe(400);
  });

  it("funciona sem token em modo dev", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .post("/api/cost-centers/empresa-dev")
      .send({ id: "dev-cc", nome: "Dev CC" });
    expect(res.status).toBe(201);
  });
});

// ─── PATCH /:tenantId/:ccId — atualiza CC ────────────────────────────────────

describe("PATCH /api/cost-centers/:tenantId/:ccId (admin)", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .patch("/api/cost-centers/empresa-g/ti")
      .send({ nome: "Novo" });
    expect(res.status).toBe(401);
  });

  it("atualiza CC e retorna 200", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-g")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI" });
    const res = await request(app)
      .patch("/api/cost-centers/empresa-g/ti")
      .set("Authorization", AUTH)
      .send({ nome: "Tecnologia", descricao: "Área tech" });
    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("Tecnologia");
    expect(res.body.descricao).toBe("Área tech");
  });

  it("retorna 404 para CC inexistente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .patch("/api/cost-centers/empresa-g/nao-existe")
      .set("Authorization", AUTH)
      .send({ nome: "X" });
    expect(res.status).toBe(404);
  });

  it("retorna 400 para corpo vazio", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-g")
      .set("Authorization", AUTH)
      .send({ id: "rh", nome: "RH" });
    const res = await request(app)
      .patch("/api/cost-centers/empresa-g/rh")
      .set("Authorization", AUTH)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── POST /:tenantId/:ccId/registros — imputa custo ──────────────────────────

describe("POST /api/cost-centers/:tenantId/:ccId/registros (admin)", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/cost-centers/empresa-h/ti/registros")
      .send({ tipo: "processamento", valor: 1, descricao: "job" });
    expect(res.status).toBe(401);
  });

  it("imputa custo e retorna 201", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-h")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI" });
    const res = await request(app)
      .post("/api/cost-centers/empresa-h/ti/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "exportacao_dxf", valor: 2.5, descricao: "DXF gerado" });
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe("exportacao_dxf");
    expect(res.body.valor).toBe(2.5);
  });

  it("retorna 422 para CC inexistente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .post("/api/cost-centers/empresa-h/nao-existe/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "processamento", valor: 1, descricao: "job" });
    expect(res.status).toBe(422);
  });

  it("retorna 422 para CC inativo", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-h")
      .set("Authorization", AUTH)
      .send({ id: "inativo", nome: "Inativo" });
    await request(app)
      .delete("/api/cost-centers/empresa-h/inativo")
      .set("Authorization", AUTH);
    const res = await request(app)
      .post("/api/cost-centers/empresa-h/inativo/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "processamento", valor: 1, descricao: "job" });
    expect(res.status).toBe(422);
  });

  it("retorna 400 para tipo inválido", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-h")
      .set("Authorization", AUTH)
      .send({ id: "ti2", nome: "TI2" });
    const res = await request(app)
      .post("/api/cost-centers/empresa-h/ti2/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "tipo_invalido", valor: 1, descricao: "job" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para valor negativo", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-h")
      .set("Authorization", AUTH)
      .send({ id: "ti3", nome: "TI3" });
    const res = await request(app)
      .post("/api/cost-centers/empresa-h/ti3/registros")
      .set("Authorization", AUTH)
      .send({ tipo: "processamento", valor: -1, descricao: "job" });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /:tenantId/:ccId — desativa CC ────────────────────────────────────

describe("DELETE /api/cost-centers/:tenantId/:ccId (admin)", () => {
  it("retorna 401 sem token", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).delete("/api/cost-centers/empresa-i/ti");
    expect(res.status).toBe(401);
  });

  it("desativa CC e retorna 200", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .post("/api/cost-centers/empresa-i")
      .set("Authorization", AUTH)
      .send({ id: "ti", nome: "TI" });
    const res = await request(app)
      .delete("/api/cost-centers/empresa-i/ti")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.mensagem).toMatch(/desativado/i);
  });

  it("retorna 404 para CC inexistente", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/cost-centers/empresa-i/nao-existe")
      .set("Authorization", AUTH);
    expect(res.status).toBe(404);
  });
});

