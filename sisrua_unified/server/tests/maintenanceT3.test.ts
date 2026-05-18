/**
 * maintenanceT3.test.ts — Testes para IA Preditiva (Item 133).
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import predictiveMaintenanceRoutes from "../routes/predictiveMaintenanceRoutes.js";

const app = express();
app.use(express.json());
app.use("/api/maintenance/predictive", predictiveMaintenanceRoutes);

describe("IA Preditiva de Manutenção (T3-133)", () => {
  const healthyAsset = {
    id: "T-HEALTHY",
    type: "transformer",
    nominalPowerKva: 75,
    currentDemandKva: 30,
    ageYears: 5
  };

  const overloadedAsset = {
    id: "T-CRITICAL",
    type: "transformer",
    nominalPowerKva: 75,
    currentDemandKva: 70, // ~93% sobrecarga
    ageYears: 20
  };

  it("POST /asset retorna diagnóstico de saúde (saudável)", async () => {
    const res = await request(app)
      .post("/api/maintenance/predictive/asset")
      .send(healthyAsset);

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("baixo");
    expect(res.body.healthScore).toBeGreaterThan(80);
  });

  it("POST /asset detecta sobrecarga crítica", async () => {
    const res = await request(app)
      .post("/api/maintenance/predictive/asset")
      .send(overloadedAsset);

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe("alto");
    expect(res.body.healthScore).toBeLessThan(60);
    expect(res.body.suggestedActions).toContain("Readequar carga");
  });
});
