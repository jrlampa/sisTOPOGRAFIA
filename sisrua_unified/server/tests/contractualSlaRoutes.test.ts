/**
 * contractualSlaRoutes.test.ts — Testes SLO/SLA Contratual (114 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("Contractual SLA Routes (114)", () => {
  describe("GET /api/sla/catalog", () => {
    it("deve retornar catálogo de SLAs com 8 fluxos", async () => {
      const res = await request(app).get("/api/sla/catalog");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(8);
      const flowIds = res.body.map((s: { flowId: string }) => s.flowId);
      expect(flowIds).toContain("exportacao_dxf");
      expect(flowIds).toContain("calculo_bt");
      expect(flowIds).toContain("autenticacao");
    });
  });

  describe("GET /api/sla/flows/:flowId", () => {
    it("deve retornar SLA de exportacao_dxf", async () => {
      const res = await request(app).get("/api/sla/flows/exportacao_dxf");
      expect(res.status).toBe(200);
      expect(res.body.flowId).toBe("exportacao_dxf");
      expect(res.body.availabilityTarget).toBe(0.999);
    });

    it("deve retornar 404 para fluxo inexistente", async () => {
      const res = await request(app).get("/api/sla/flows/fluxo_inexistente");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/sla/events", () => {
    it("deve registrar evento de sucesso", async () => {
      const res = await request(app).post("/api/sla/events").send({
        flowId: "exportacao_dxf",
        outcome: "success",
        durationMs: 5000,
        tenantId: "tenant-x",
      });
      expect(res.status).toBe(201);
      expect(res.body.flowId).toBe("exportacao_dxf");
      expect(res.body.outcome).toBe("success");
    });

    it("deve registrar evento de falha", async () => {
      const res = await request(app).post("/api/sla/events").send({
        flowId: "calculo_bt",
        outcome: "failure",
        durationMs: 0,
        errorCode: "PYTHON_OOM",
      });
      expect(res.status).toBe(201);
      expect(res.body.outcome).toBe("failure");
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/sla/events")
        .send({ flowId: "invalido", outcome: "success", durationMs: -1 });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/sla/flows/:flowId/compliance", () => {
    it("deve retornar relatório de conformidade do fluxo", async () => {
      const res = await request(app).get(
        "/api/sla/flows/exportacao_dxf/compliance",
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("successRate");
      expect(res.body).toHaveProperty("compliant");
      expect(res.body).toHaveProperty("p95ResponseTimeMs");
      expect(res.body.flowId).toBe("exportacao_dxf");
    });
  });

  describe("GET /api/sla/compliance", () => {
    it("deve retornar relatório de todos os fluxos", async () => {
      const res = await request(app).get("/api/sla/compliance");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(8);
    });
  });

  describe("GET /api/sla/violations", () => {
    it("deve retornar lista de violações (pode ser vazia sem eventos de falha)", async () => {
      const res = await request(app).get("/api/sla/violations");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/sla/flows/:flowId/events", () => {
    it("deve retornar eventos registrados do fluxo", async () => {
      const res = await request(app).get(
        "/api/sla/flows/exportacao_dxf/events",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
