/**
 * sombreamentoT2.test.ts — Testes para o item T2.61 (Solar Shading 2.5D).
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import sombreamentoRoutes from "../routes/sombreamento2D5Routes.js";

const app = express();
app.use(express.json());
app.use("/api/sombreamento", sombreamentoRoutes);

describe("Solar Shading 2.5D (T2-61)", () => {
  const mockTopology = {
    poles: [
      { id: "P1", lat: -22.9, lng: -43.2 },
    ],
    transformers: [
      { id: "T1", lat: -22.9001, lng: -43.2001 },
    ],
    edges: []
  };

  const mockOsmData = [
    {
      type: "way",
      id: 123,
      lat: -22.9002,
      lon: -43.2002,
      tags: { building: "yes", height: "20" }
    }
  ];

  it("POST /auto calcula incidência solar baseada em edificações", async () => {
    const res = await request(app)
      .post("/api/sombreamento/auto")
      .send({ topology: mockTopology, osmData: mockOsmData });

    if (res.status === 500) {
      console.error("Server Error Body:", res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    
    const resultT1 = res.body.results.find((r: any) => r.ativoId === "T1");
    expect(resultT1).toBeDefined();
    expect(resultT1.perfisHorarios).toHaveLength(10);
    expect(resultT1.eficienciaPercent).toBeLessThan(100);
  });

  it("classifica risco térmico para transformadores", async () => {
    const res = await request(app)
      .post("/api/sombreamento/auto")
      .send({ topology: mockTopology, osmData: [] });

    expect(res.status).toBe(200);
    const resultT1 = res.body.results.find((r: any) => r.ativoId === "T1");
    expect(resultT1.nivelRiscoTermico).toBe("alto");
  });

  it("rejeita payload inválido", async () => {
    const res = await request(app)
      .post("/api/sombreamento/auto")
      .send({ topology: {} });
    
    expect(res.status).toBe(400);
  });
});
