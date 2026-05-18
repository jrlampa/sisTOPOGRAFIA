/**
 * complianceT2.test.ts — Testes para os itens T2.45 e T2.60 (Automatic Compliance).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import complianceRoutes from "../routes/complianceRoutes.js";
import { Nbr9050Service } from "../services/nbr9050Service.js";
import { EsgAmbientalService } from "../services/esgAmbientalService.js";

const app = express();
app.use(express.json());
app.use("/api/compliance", complianceRoutes);

describe("Compliance Tier 2 (Automatic Checks)", () => {
  const mockTopology = {
    poles: [
      { id: "P1", lat: -22.95, lng: -43.2 }, // Lat par (termina em 0) -> Simula INTERSECÇÃO no mock
      { id: "P2", lat: -22.951, lng: -43.21 }, // Lat impar -> Simula OK
    ],
    transformers: [],
    edges: []
  };

  describe("NBR 9050 - Acessibilidade Urbana", () => {
    it("POST /nbr9050/auto retorna scores e detalhes por poste", async () => {
      const res = await request(app)
        .post("/api/compliance/nbr9050/auto")
        .send(mockTopology);

      expect(res.status).toBe(200);
      expect(res.body.score).toBeDefined();
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0]).toHaveProperty("conforme");
    });
  });

  describe("ESG Ambiental - Interferências APPs/UCs", () => {
    it("POST /environmental/auto detecta interferências baseada em coordenadas", async () => {
      const res = await request(app)
        .post("/api/compliance/environmental/auto")
        .send(mockTopology);

      expect(res.status).toBe(200);
      expect(res.body.totalInterferencias).toBeGreaterThan(0);
      expect(res.body.interferencias[0].tipoArea).toBe("APP");
    });
  });

  describe("Validation", () => {
    it("rejeita topologia inválida", async () => {
      const res = await request(app)
        .post("/api/compliance/nbr9050/auto")
        .send({ invalid: true });
      
      expect(res.status).toBe(400);
    });
  });
});
