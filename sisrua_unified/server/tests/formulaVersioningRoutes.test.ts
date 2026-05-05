/**
 * formulaVersioningRoutes.test.ts - contratos HTTP do versionamento de formulas.
 */

import request from "supertest";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetCatalog } from "../services/formulaVersioningService.js";

vi.mock("../config", () => ({
  config: {
    ADMIN_TOKEN: "test-admin-token",
    NODE_ENV: "test",
  },
}));

const { default: formulaVersioningRoutes } = await import(
  "../routes/formulaVersioningRoutes.js"
);

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/", formulaVersioningRoutes);
  return app;
};

const validPayload = () => ({
  version: "3.0.0",
  status: "active",
  name: "Limite CQT revisado",
  description: "Nova versao regulatoria para teste de contrato.",
  expression: "CQT_HIGH se qtTotal > 0.075",
  constants: { ANEEL_CQT_LIMIT: 0.075, limite_percentual: 7.5 },
  standardReference: "ANEEL PRODIST Modulo 8",
  effectiveDate: "2026-05-05",
  changeReason: "Auditoria tecnica corretiva.",
  category: "cqt",
});

describe("formulaVersioningRoutes", () => {
  beforeEach(() => {
    resetCatalog();
    vi.clearAllMocks();
  });

  it("GET / lista formulas ativas", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
    expect(res.body.formulas[0].activeEntry.status).toBe("active");
  });

  it("GET /:id/diff exige v1 e v2", async () => {
    const res = await request(buildApp()).get("/QT_SEGMENTO_BT/diff?v1=1.0.0");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("v1 e v2");
  });

  it("POST /:id rejeita requisicao sem token admin", async () => {
    const res = await request(buildApp())
      .post("/LIMITE_CQT_ANEEL")
      .send(validPayload());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("POST /:id valida payload antes de registrar versao", async () => {
    const res = await request(buildApp())
      .post("/LIMITE_CQT_ANEEL")
      .set("Authorization", "Bearer test-admin-token")
      .send({ ...validPayload(), version: "3" });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toContain("semver");
  });

  it("POST /:id registra versao com token admin valido", async () => {
    const res = await request(buildApp())
      .post("/LIMITE_CQT_ANEEL")
      .set("Authorization", "Bearer test-admin-token")
      .send(validPayload());
    expect(res.status).toBe(201);
    expect(res.body.version).toBe("3.0.0");
    expect(res.body.definitionHash).toMatch(/^[0-9a-f]{64}$/);

    const active = await request(buildApp()).get("/LIMITE_CQT_ANEEL/active");
    expect(active.body.version).toBe("3.0.0");
  });
});
