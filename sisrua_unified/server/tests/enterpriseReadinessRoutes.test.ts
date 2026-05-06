/**
 * enterpriseReadinessRoutes.test.ts — Testes Enterprise Readiness (121+122+123 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("Enterprise Readiness Routes (121+122+123)", () => {
  // ── 121: Hardening ──────────────────────────────────────────────────────────

  describe("GET /api/enterprise-readiness/hardening/checks", () => {
    it("deve retornar verificações de hardening com status", async () => {
      const res = await request(app).get("/api/enterprise-readiness/hardening/checks");
      // 207 se há falhas, 200 se tudo OK
      expect([200, 207]).toContain(res.status);
      expect(res.body).toHaveProperty("checks");
      expect(res.body).toHaveProperty("hasFailure");
      expect(Array.isArray(res.body.checks)).toBe(true);
      expect(res.body.checks.length).toBeGreaterThanOrEqual(3);

      const check = res.body.checks[0];
      expect(check).toHaveProperty("id");
      expect(check).toHaveProperty("status");
      expect(check).toHaveProperty("description");
    });

    it("cada verificação deve ter status válido", async () => {
      const res = await request(app).get("/api/enterprise-readiness/hardening/checks");
      const validStatuses = ["ok", "aviso", "falha", "nao_aplicavel"];
      for (const check of res.body.checks) {
        expect(validStatuses).toContain(check.status);
      }
    });
  });

  // ── 122: Onboarding Checklist ───────────────────────────────────────────────

  describe("GET /api/enterprise-readiness/onboarding/checklist", () => {
    it("deve retornar checklist completo", async () => {
      const res = await request(app).get("/api/enterprise-readiness/onboarding/checklist");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(10);
      expect(res.body[0]).toHaveProperty("title");
      expect(res.body[0]).toHaveProperty("required");
      expect(res.body[0]).toHaveProperty("verified");
    });

    it("deve filtrar checklist por área rede", async () => {
      const res = await request(app).get(
        "/api/enterprise-readiness/onboarding/checklist?area=rede",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.every((i: { area: string }) => i.area === "rede"),
      ).toBe(true);
    });
  });

  describe("GET /api/enterprise-readiness/onboarding/progress", () => {
    it("deve retornar progresso do checklist", async () => {
      const res = await request(app).get("/api/enterprise-readiness/onboarding/progress");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("verified");
      expect(res.body).toHaveProperty("required");
      expect(res.body).toHaveProperty("readyForProduction");
      expect(res.body).toHaveProperty("pendingRequired");
      expect(typeof res.body.readyForProduction).toBe("boolean");
    });
  });

  describe("PATCH /api/enterprise-readiness/onboarding/checklist/:id", () => {
    it("deve marcar item do checklist como verificado", async () => {
      const res = await request(app)
        .patch("/api/enterprise-readiness/onboarding/checklist/net-001")
        .send({ verified: true, note: "Conectividade testada com sucesso" });
      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.verificationNote).toBe(
        "Conectividade testada com sucesso",
      );
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .patch("/api/enterprise-readiness/onboarding/checklist/net-001")
        .send({ verified: "nao-boolean" });
      expect(res.status).toBe(400);
    });

    it("deve retornar 422 para ID inexistente", async () => {
      const res = await request(app)
        .patch("/api/enterprise-readiness/onboarding/checklist/id-inexistente")
        .send({ verified: true });
      expect(res.status).toBe(422);
    });
  });

  // ── 123: Deployment Modes ──────────────────────────────────────────────────

  describe("GET /api/enterprise-readiness/deployment/modes", () => {
    it("deve retornar os 3 modos de implantação", async () => {
      const res = await request(app).get("/api/enterprise-readiness/deployment/modes");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
      const modes = res.body.map((m: { mode: string }) => m.mode);
      expect(modes).toContain("cloud");
      expect(modes).toContain("on_premise");
      expect(modes).toContain("hibrido");
    });

    it("deve filtrar por modo on_premise", async () => {
      const res = await request(app).get(
        "/api/enterprise-readiness/deployment/modes?mode=on_premise",
      );
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].mode).toBe("on_premise");
      expect(res.body[0].networkDependencies).toEqual([]);
    });
  });

  describe("GET /api/enterprise-readiness/deployment/detect", () => {
    it("deve detectar modo de implantação atual", async () => {
      const res = await request(app).get("/api/enterprise-readiness/deployment/detect");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("detectedMode");
      expect(res.body).toHaveProperty("confidence");
      expect(res.body).toHaveProperty("indicators");
      const validModes = ["cloud", "on_premise", "hibrido"];
      expect(validModes).toContain(res.body.detectedMode);
    });
  });
});
