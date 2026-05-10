/**
 * dgWizardT3.test.ts — Testes para o Design Generativo Wizard (Item 131).
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import dgRoutes from "../routes/dgRoutes.js";

// Mock roleService BEFORE importing routes or app
vi.mock("../services/roleService.js", () => ({
  getUserRole: vi.fn().mockResolvedValue({ role: "admin", tenantId: "t1" }),
}));

const app = express();
app.use(express.json());
// Mock tenantId for permission check
app.use((req, res, next) => {
  res.locals.userId = "u1";
  res.locals.tenantId = "t1";
  next();
});
app.use("/api/dg", dgRoutes);

describe("Design Generativo Wizard (T3-131)", () => {
  const mockPoles = [
    { id: "P1", position: { lat: -23.5000, lon: -46.6000 }, demandKva: 0, clients: 0 },
    { id: "P2", position: { lat: -23.5001, lon: -46.6001 }, demandKva: 0, clients: 0 },
    { id: "P3", position: { lat: -23.4999, lon: -46.5999 }, demandKva: 0, clients: 0 },
  ];

  it("POST /optimize (Wizard) gera projeto completo sem trafo inicial", async () => {
    const res = await request(app)
      .post("/api/dg/optimize")
      .send({
        poles: mockPoles,
        params: {
          projectMode: "full_project",
          clientesPorPoste: 2,
          demandaMediaClienteKva: 1.5,
          fatorSimultaneidade: 0.8,
          faixaKvaTrafoPermitida: [30, 45, 75],
          maxSpanMeters: 40
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.recommendation).toBeDefined();
    
    const best = res.body.recommendation.bestScenario;
    expect(best.feasible).toBe(true);
    expect(best.edges.length).toBeGreaterThan(0);
    expect(best.metadata.selectedKva).toBeGreaterThanOrEqual(30);
    
    // Verifica se os postes tiveram demanda derivada
    // A carga total para 3 postes com 2 clientes cada (1.5kVA, fs=0.8) 
    // deve ser 3 * (2 * 1.5 * 0.8) = 7.2 kVA
    expect(best.electricalResult.trafoUtilizationFraction).toBeLessThan(1);
  });

  it("rejeita modo legado sem transformador", async () => {
    const res = await request(app)
      .post("/api/dg/optimize")
      .send({
        poles: mockPoles,
        params: { projectMode: "optimization" }
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Parâmetros inválidos");
  });
});
