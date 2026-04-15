/**
 * quotaRoutes.test.ts
 * Testes de integração das rotas de quotas e throttling por tenant (Roadmap Item 33 [T2]).
 */

import express from "express";
import request from "supertest";
import { clearAllTenantQuotas } from "../services/tenantQuotaService.js";

// ─── Mock do logger ──────────────────────────────────────────────────────────

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOKEN = "quota-admin-token-xyz";
const AUTH = "Bearer " + TOKEN;

async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();
  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));
  const { default: quotaRoutes } = await import("../routes/quotaRoutes");
  const app = express();
  app.use(express.json());
  app.use("/api/tenant-quotas", quotaRoutes);
  return app;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllTenantQuotas();
});

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  clearAllTenantQuotas();
});

// ─── GET /api/tenant-quotas — listagem admin ──────────────────────────────────

describe("GET /api/tenant-quotas (listagem admin)", () => {
  it("retorna 200 e lista vazia sem token em modo dev", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/tenant-quotas");
    expect(res.status).toBe(200);
    expect(res.body.tenants).toEqual([]);
  });

  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).get("/api/tenant-quotas");
    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/tenant-quotas-admin/);
  });

  it("retorna 401 com token errado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/tenant-quotas")
      .set("Authorization", "Bearer token-errado");
    expect(res.status).toBe(401);
  });

  it("retorna 200 com token correto", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .get("/api/tenant-quotas")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tenants)).toBe(true);
  });

  it("lista tenants após configurar quotas", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-x/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 10 });
    const res = await request(app)
      .get("/api/tenant-quotas")
      .set("Authorization", AUTH);
    expect(res.body.tenants).toContain("empresa-x");
  });
});

// ─── GET /api/tenant-quotas/:tenantId — quotas configuradas ──────────────────

describe("GET /api/tenant-quotas/:tenantId", () => {
  it("retorna 200 com quotas vazias para tenant sem configuração", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/tenant-quotas/empresa-y");
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("empresa-y");
    expect(res.body.quotas).toEqual({});
  });

  it("retorna 200 com quotas após configuração via PUT", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-y/dxf_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 20 });
    const res = await request(app).get("/api/tenant-quotas/empresa-y");
    expect(res.status).toBe(200);
    expect(res.body.quotas["dxf_por_hora"]?.limite).toBe(20);
  });

  it("retorna 400 para tenantId com caracteres inválidos", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/tenant-quotas/empresa invalida");
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tenantId com '..'", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/tenant-quotas/empresa..evil");
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/tenant-quotas/:tenantId/uso — relatório de uso ─────────────────

describe("GET /api/tenant-quotas/:tenantId/uso", () => {
  it("retorna 200 com relatório vazio para tenant sem quotas", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/tenant-quotas/empresa-z/uso");
    expect(res.status).toBe(200);
    expect(res.body.quotas).toEqual({});
  });

  it("retorna uso=0 para quota configurada sem consumo", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-z/analise_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 30 });
    const res = await request(app).get("/api/tenant-quotas/empresa-z/uso");
    expect(res.status).toBe(200);
    expect(res.body.quotas["analise_por_hora"]?.consumido).toBe(0);
    expect(res.body.quotas["analise_por_hora"]?.restante).toBe(30);
  });

  it("retorna 400 para tenantId inválido", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get(
      "/api/tenant-quotas/empresa invalida/uso",
    );
    expect(res.status).toBe(400);
  });
});

// ─── PUT /api/tenant-quotas/:tenantId/:tipo — definir limite ─────────────────

describe("PUT /api/tenant-quotas/:tenantId/:tipo (admin)", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-a/jobs_por_hora")
      .send({ limite: 10 });
    expect(res.status).toBe(401);
  });

  it("define limite e retorna 200", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-a/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 50 });
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("empresa-a");
    expect(res.body.tipo).toBe("jobs_por_hora");
    expect(res.body.limite).toBe(50);
    expect(res.body.mensagem).toMatch(/sucesso/i);
  });

  it("aceita limite zero (bloqueio total)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-a/dxf_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 0 });
    expect(res.status).toBe(200);
    expect(res.body.limite).toBe(0);
  });

  it("retorna 400 para tipo de quota inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-a/tipo_invalido")
      .set("Authorization", AUTH)
      .send({ limite: 10 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para limite negativo", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-a/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: -1 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para limite não-inteiro", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-a/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 10.5 });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para corpo sem 'limite'", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-a/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({});
    expect(res.status).toBe(400);
  });

  it("funciona em modo dev sem METRICS_TOKEN", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .put("/api/tenant-quotas/empresa-dev/jobs_por_hora")
      .send({ limite: 100 });
    expect(res.status).toBe(200);
  });
});

// ─── POST /:tenantId/:tipo/verificar — check+consume ─────────────────────────

describe("POST /api/tenant-quotas/:tenantId/:tipo/verificar", () => {
  it("retorna 200 e permitido:true quando abaixo do limite", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-b/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 10 });
    const res = await request(app)
      .post("/api/tenant-quotas/empresa-b/jobs_por_hora/verificar")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.permitido).toBe(true);
    expect(res.body.restante).toBe(9);
    expect(res.body.consumido).toBe(1);
  });

  it("retorna 429 quando quota esgotada", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-b/dxf_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 1 });
    await request(app)
      .post("/api/tenant-quotas/empresa-b/dxf_por_hora/verificar")
      .send({});
    const res = await request(app)
      .post("/api/tenant-quotas/empresa-b/dxf_por_hora/verificar")
      .send({});
    expect(res.status).toBe(429);
    expect(res.body.permitido).toBe(false);
    expect(res.body.erro).toMatch(/quota excedida/i);
  });

  it("retorna 200 e permitido:true para tenant sem quota (permissivo)", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .post("/api/tenant-quotas/tenant-sem-quota/jobs_por_hora/verificar")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.permitido).toBe(true);
    expect(res.body.limite).toBeNull();
    expect(res.body.restante).toBeNull();
  });

  it("consome múltiplas unidades com body { unidades: N }", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-c/analise_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 10 });
    const res = await request(app)
      .post("/api/tenant-quotas/empresa-c/analise_por_hora/verificar")
      .send({ unidades: 3 });
    expect(res.status).toBe(200);
    expect(res.body.consumido).toBe(3);
    expect(res.body.restante).toBe(7);
  });

  it("retorna 400 para tipo de quota inválido", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .post("/api/tenant-quotas/empresa-d/tipo_invalido/verificar")
      .send({});
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tenantId inválido", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .post("/api/tenant-quotas/empresa invalida/jobs_por_hora/verificar")
      .send({});
    expect(res.status).toBe(400);
  });

  it("retorna 400 para unidades=0", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .post("/api/tenant-quotas/empresa-e/jobs_por_hora/verificar")
      .send({ unidades: 0 });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /:tenantId/:tipo — remove quota específica ───────────────────────

describe("DELETE /api/tenant-quotas/:tenantId/:tipo (admin)", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).delete(
      "/api/tenant-quotas/empresa-f/jobs_por_hora",
    );
    expect(res.status).toBe(401);
  });

  it("remove quota específica e retorna 200", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-f/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 10 });
    const res = await request(app)
      .delete("/api/tenant-quotas/empresa-f/jobs_por_hora")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.mensagem).toMatch(/sucesso/i);
    const getRes = await request(app).get("/api/tenant-quotas/empresa-f");
    expect(getRes.body.quotas["jobs_por_hora"]).toBeUndefined();
  });

  it("retorna 200 mesmo se quota não existia (idempotente)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/tenant-quotas/tenant-nao-existe/dxf_por_hora")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
  });

  it("retorna 400 para tipo de quota inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/tenant-quotas/empresa-f/tipo_invalido")
      .set("Authorization", AUTH);
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /:tenantId — remove todas as quotas ───────────────────────────────

describe("DELETE /api/tenant-quotas/:tenantId (admin)", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).delete("/api/tenant-quotas/empresa-g");
    expect(res.status).toBe(401);
  });

  it("remove todas as quotas e retorna mensagem de sucesso", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-g/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 10 });
    const res = await request(app)
      .delete("/api/tenant-quotas/empresa-g")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.mensagem).toMatch(/sucesso/i);
    const getRes = await request(app).get("/api/tenant-quotas/empresa-g");
    expect(getRes.body.quotas).toEqual({});
  });

  it("retorna 200 com mensagem informando que não havia quotas", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/tenant-quotas/empresa-nao-existe")
      .set("Authorization", AUTH);
    expect(res.status).toBe(200);
    expect(res.body.mensagem).toMatch(/não possuía/i);
  });

  it("não afeta outros tenants ao deletar", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/tenant-quotas/empresa-g/jobs_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 10 });
    await request(app)
      .put("/api/tenant-quotas/empresa-h/dxf_por_hora")
      .set("Authorization", AUTH)
      .send({ limite: 5 });
    await request(app)
      .delete("/api/tenant-quotas/empresa-g")
      .set("Authorization", AUTH);
    const getRes = await request(app).get("/api/tenant-quotas/empresa-h");
    expect(getRes.body.quotas["dxf_por_hora"]?.limite).toBe(5);
  });
});
