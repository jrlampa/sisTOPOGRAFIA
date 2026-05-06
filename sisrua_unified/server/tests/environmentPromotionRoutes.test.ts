/**
 * environmentPromotionRoutes.test.ts — Item 20 [T1]
 */

import request from "supertest";
import app from "../app.js";

describe("Environment Promotion Routes (20)", () => {
  let buildId = "";

  describe("POST /api/environment-promotion/builds", () => {
    it("deve registrar build em dev", async () => {
      const res = await request(app).post("/api/environment-promotion/builds").send({
        version: "0.9.3",
        gitCommit: "abcde12",
        artifactHash: "sha256:123",
      });

      expect(res.status).toBe(201);
      expect(res.body.currentEnvironment).toBe("dev");
      buildId = res.body.id;
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/environment-promotion/builds")
        .send({ version: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/environment-promotion/builds/:id", () => {
    it("deve retornar build por id", async () => {
      const res = await request(app).get(`/api/environment-promotion/builds/${buildId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(buildId);
    });

    it("deve retornar 404 para build inexistente", async () => {
      const res = await request(app).get("/api/environment-promotion/builds/build-ghost");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/environment-promotion/promote", () => {
    it("deve promover dev -> homolog com gates aprovados", async () => {
      const res = await request(app).post("/api/environment-promotion/promote").send({
        buildId,
        to: "homolog",
        approvedBy: "gestor-ops",
        changeRequestId: "rdm-1001",
        checks: {
          testsPassed: true,
          securityGatePassed: true,
          observabilityGatePassed: true,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.from).toBe("dev");
      expect(res.body.to).toBe("homolog");
    });

    it("deve bloquear promoção com gate falho", async () => {
      const res = await request(app).post("/api/environment-promotion/promote").send({
        buildId,
        to: "preprod",
        approvedBy: "gestor-ops",
        changeRequestId: "rdm-1002",
        checks: {
          testsPassed: true,
          securityGatePassed: false,
          observabilityGatePassed: true,
        },
      });
      expect(res.status).toBe(422);
    });

    it("deve bloquear salto inválido homolog -> prod", async () => {
      const res = await request(app).post("/api/environment-promotion/promote").send({
        buildId,
        to: "prod",
        approvedBy: "gestor-ops",
        changeRequestId: "rdm-1003",
        checks: {
          testsPassed: true,
          securityGatePassed: true,
          observabilityGatePassed: true,
        },
      });
      expect(res.status).toBe(422);
    });
  });

  describe("GET /api/environment-promotion/history e /pipeline", () => {
    it("deve retornar histórico de promoções", async () => {
      const res = await request(app).get(`/api/environment-promotion/history?buildId=${buildId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("deve retornar estado do pipeline por ambiente", async () => {
      const res = await request(app).get("/api/environment-promotion/pipeline");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const envs = res.body.map((e: { environment: string }) => e.environment);
      expect(envs).toContain("dev");
      expect(envs).toContain("homolog");
      expect(envs).toContain("preprod");
      expect(envs).toContain("prod");
    });
  });
});
