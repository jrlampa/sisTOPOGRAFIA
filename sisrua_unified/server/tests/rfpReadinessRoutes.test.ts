/**
 * rfpReadinessRoutes.test.ts — Testes RFP/RFI Readiness (117 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("RFP Readiness Routes (117)", () => {
  describe("GET /api/rfp-readiness/library", () => {
    it("deve retornar biblioteca completa", async () => {
      const res = await request(app).get("/api/rfp-readiness/library");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(10);
      expect(res.body[0]).toHaveProperty("question");
      expect(res.body[0]).toHaveProperty("answer");
    });

    it("deve filtrar por categoria seguranca", async () => {
      const res = await request(app).get("/api/rfp-readiness/library?category=seguranca");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.every(
          (q: { category: string }) => q.category === "seguranca",
        ),
      ).toBe(true);
    });
  });

  describe("GET /api/rfp-readiness/search", () => {
    it("deve encontrar questões sobre LGPD", async () => {
      const res = await request(app).get("/api/rfp-readiness/search?q=lgpd");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("deve retornar 400 sem parâmetro q", async () => {
      const res = await request(app).get("/api/rfp-readiness/search");
      expect(res.status).toBe(400);
    });

    it("deve retornar lista vazia para busca sem resultado", async () => {
      const res = await request(app).get(
        "/api/rfp-readiness/search?q=termosemresultado123abc",
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/rfp-readiness/architecture", () => {
    it("deve retornar referência de arquitetura completa", async () => {
      const res = await request(app).get("/api/rfp-readiness/architecture");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(5);
      expect(res.body[0]).toHaveProperty("component");
      expect(res.body[0]).toHaveProperty("technology");
    });

    it("deve filtrar por tier backend", async () => {
      const res = await request(app).get("/api/rfp-readiness/architecture?tier=backend");
      expect(res.status).toBe(200);
      expect(
        res.body.every((r: { tier: string }) => r.tier === "backend"),
      ).toBe(true);
    });
  });

  describe("GET /api/rfp-readiness/readiness-profile", () => {
    it("deve retornar perfil de prontidão com cobertura", async () => {
      const res = await request(app).get("/api/rfp-readiness/readiness-profile");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalQuestions");
      expect(res.body).toHaveProperty("overallCoverage");
      expect(res.body).toHaveProperty("byCategory");
      expect(res.body.overallCoverage).toBeGreaterThan(0);
      expect(res.body.overallCoverage).toBeLessThanOrEqual(1);
    });
  });
});
