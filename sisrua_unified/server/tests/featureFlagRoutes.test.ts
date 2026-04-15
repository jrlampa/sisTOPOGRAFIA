/**
 * featureFlagRoutes.test.ts
 * Testes de integração das rotas de feature flags por tenant (Roadmap Item 21 [T2]).
 *
 * Padrão: buildApp() isola cada grupo de testes com módulos re-importados,
 * igual ao metricsRoutesAuth.test.ts.
 */

import express from "express";
import request from "supertest";
import {
  clearAllTenantFlagOverrides,
} from "../services/tenantFeatureFlagService.js";

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

const TOKEN = "test-token-abc123";

/** Monta app com config.METRICS_TOKEN controlado. */
async function buildApp(metricsToken: string | undefined) {
  jest.resetModules();

  jest.doMock("../config", () => ({
    config: { METRICS_TOKEN: metricsToken },
  }));

  const { default: featureFlagRoutes } = await import(
    "../routes/featureFlagRoutes"
  );
  const app = express();
  app.use(express.json());
  app.use("/api/feature-flags", featureFlagRoutes);
  return app;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllTenantFlagOverrides();
});

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  clearAllTenantFlagOverrides();
});

// ─── GET /api/feature-flags — listagem admin ──────────────────────────────────

describe("GET /api/feature-flags (listagem admin)", () => {
  describe("sem METRICS_TOKEN configurado", () => {
    it("retorna 200 com lista de tenants sem token", async () => {
      const app = await buildApp(undefined);
      const res = await request(app).get("/api/feature-flags");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("tenants");
      expect(Array.isArray(res.body.tenants)).toBe(true);
    });
  });

  describe("com METRICS_TOKEN configurado", () => {
    it("retorna 401 sem Authorization header", async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app).get("/api/feature-flags");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("erro");
    });

    it("retorna 401 com token errado", async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get("/api/feature-flags")
        .set("Authorization", "Bearer token-errado");
      expect(res.status).toBe(401);
    });

    it("retorna 401 com esquema de autenticação errado (Basic)", async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get("/api/feature-flags")
        .set("Authorization", "Basic abc123");
      expect(res.status).toBe(401);
    });

    it("retorna 401 e inclui WWW-Authenticate", async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app).get("/api/feature-flags");
      expect(res.status).toBe(401);
      expect(res.headers["www-authenticate"]).toMatch(/Bearer realm=/);
    });

    it("retorna 200 com token correto e lista vazia inicial", async () => {
      const app = await buildApp(TOKEN);
      const res = await request(app)
        .get("/api/feature-flags")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.tenants).toEqual([]);
    });

    it("retorna 200 e lista tenants existentes", async () => {
      // Primeiro popula via PUT
      const app = await buildApp(TOKEN);
      await request(app)
        .put("/api/feature-flags/tenant-abc")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send({ feat1: true });

      const res = await request(app)
        .get("/api/feature-flags")
        .set("Authorization", `Bearer ${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.tenants).toContain("tenant-abc");
    });
  });
});

// ─── GET /api/feature-flags/:tenantId — overrides do tenant ──────────────────

describe("GET /api/feature-flags/:tenantId (overrides do tenant)", () => {
  it("retorna 200 com objeto vazio para tenant sem overrides", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/feature-flags/tenant-x");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tenantId: "tenant-x", flags: {} });
  });

  it("retorna 200 com overrides após PUT", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/feature-flags/tenant-y")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true, feat2: false });

    const res = await request(app).get("/api/feature-flags/tenant-y");
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("tenant-y");
    expect(res.body.flags).toEqual({ feat1: true, feat2: false });
  });

  it("retorna 400 para tenantId com caracteres inválidos", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/feature-flags/tenant%20invalido");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("erro");
  });

  it("retorna 400 para tenantId com sequência de pontos (path traversal)", async () => {
    const app = await buildApp(undefined);
    const res = await request(app).get("/api/feature-flags/tenant..evil");
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tenantId muito longo (>128 chars)", async () => {
    const app = await buildApp(undefined);
    const longId = "a".repeat(129);
    const res = await request(app).get(`/api/feature-flags/${longId}`);
    expect(res.status).toBe(400);
  });

  it("aceita tenantId com hífens, underscores, ponto e @", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/feature-flags/tenant_a.b@c-d")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true });

    const res = await request(app).get("/api/feature-flags/tenant_a.b@c-d");
    expect(res.status).toBe(200);
  });
});

// ─── PUT /api/feature-flags/:tenantId — definir overrides (admin) ────────────

describe("PUT /api/feature-flags/:tenantId (admin)", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/feature-flags/tenant-z")
      .send({ feat1: true });
    expect(res.status).toBe(401);
  });

  it("retorna 200 e aplica overrides com token correto", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/feature-flags/tenant-z")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true, feat2: false });
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("tenant-z");
    expect(res.body.flags).toEqual({ feat1: true, feat2: false });
    expect(res.body.mensagem).toMatch(/sucesso/i);
  });

  it("faz merge incremental em chamadas consecutivas", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/feature-flags/tenant-z")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true });

    const res = await request(app)
      .put("/api/feature-flags/tenant-z")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat2: false });

    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual({ feat1: true, feat2: false });
  });

  it("retorna 400 para corpo vazio ({})", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/feature-flags/tenant-z")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("erro");
  });

  it("retorna 400 para corpo com valores não-booleanos", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/feature-flags/tenant-z")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: "sim" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tenantId inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .put("/api/feature-flags/tenant invalido")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true });
    expect(res.status).toBe(400);
  });

  it("funciona sem METRICS_TOKEN configurado (modo dev)", async () => {
    const app = await buildApp(undefined);
    const res = await request(app)
      .put("/api/feature-flags/tenant-dev")
      .send({ feat1: true });
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/feature-flags/:tenantId/:flag — remove flag específico ───────

describe("DELETE /api/feature-flags/:tenantId/:flag (admin)", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).delete(
      "/api/feature-flags/tenant-a/feat1",
    );
    expect(res.status).toBe(401);
  });

  it("remove flag específico e retorna 200", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/feature-flags/tenant-a")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true, feat2: false });

    const res = await request(app)
      .delete("/api/feature-flags/tenant-a/feat1")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("tenant-a");
    expect(res.body.flag).toBe("feat1");
    expect(res.body.mensagem).toMatch(/sucesso/i);

    // feat2 deve permanecer
    const getRes = await request(app).get("/api/feature-flags/tenant-a");
    expect(getRes.body.flags).toEqual({ feat2: false });
  });

  it("retorna 200 mesmo quando flag não existia (idempotente)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/feature-flags/tenant-nao-existe/feat_qualquer")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
  });

  it("retorna 400 para flag com nome inválido (com espaços)", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/feature-flags/tenant-a/flag invalida")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it("retorna 400 para tenantId inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/feature-flags/tenant invalido/feat1")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/feature-flags/:tenantId — remove todos os overrides ─────────

describe("DELETE /api/feature-flags/:tenantId (admin)", () => {
  it("retorna 401 sem token quando METRICS_TOKEN configurado", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app).delete("/api/feature-flags/tenant-b");
    expect(res.status).toBe(401);
  });

  it("remove todos os overrides e retorna mensagem de sucesso", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/feature-flags/tenant-b")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true, feat2: false });

    const res = await request(app)
      .delete("/api/feature-flags/tenant-b")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("tenant-b");
    expect(res.body.mensagem).toMatch(/sucesso/i);

    // Verifica que ficou vazio
    const getRes = await request(app).get("/api/feature-flags/tenant-b");
    expect(getRes.body.flags).toEqual({});
  });

  it("retorna 200 com mensagem informando que não havia overrides", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/feature-flags/tenant-nao-existe")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.mensagem).toMatch(/não possuía/i);
  });

  it("retorna 400 para tenantId inválido", async () => {
    const app = await buildApp(TOKEN);
    const res = await request(app)
      .delete("/api/feature-flags/tenant invalido")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(400);
  });

  it("não afeta outros tenants ao deletar", async () => {
    const app = await buildApp(TOKEN);
    await request(app)
      .put("/api/feature-flags/tenant-b")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat1: true });
    await request(app)
      .put("/api/feature-flags/tenant-c")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ feat2: false });

    await request(app)
      .delete("/api/feature-flags/tenant-b")
      .set("Authorization", `Bearer ${TOKEN}`);

    const getRes = await request(app).get("/api/feature-flags/tenant-c");
    expect(getRes.body.flags).toEqual({ feat2: false });
  });
});
