/**
 * vegetationT2.test.ts — Testes para o item T2.46 (Simulated Vegetation Inventory).
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import complianceRoutes from "../routes/complianceRoutes.js";

const app = express();
app.use(express.json());
app.use("/api/compliance", complianceRoutes);

describe("Simulated Vegetation Inventory (T2-46)", () => {
  const mockTopology = {
    poles: [
      { id: "P1", lat: -23.5, lng: -46.6 },
      { id: "P2", lat: -23.501, lng: -46.601 },
    ],
    transformers: [],
    edges: []
  };

  const mockOsmData = [
    {
      type: "node",
      id: 1,
      lat: -23.5, // Exatamente em P1
      lon: -46.6,
      tags: { natural: "tree" }
    },
    {
      type: "way",
      id: 2,
      tags: { natural: "wood" },
      geometry: [
        { lat: -23.5011, lon: -46.6011 } // Perto de P2
      ]
    }
  ];

  it("POST /vegetation/auto detecta conflitos com árvores e maciços", async () => {
    const res = await request(app)
      .post("/api/compliance/vegetation/auto")
      .send({ topology: mockTopology, osmData: mockOsmData });

    expect(res.status).toBe(200);
    expect(res.body.totalConflitos).toBe(2);
    expect(res.body.areaEstimadaHa).toBeGreaterThan(0);
    expect(res.body.riscoOperacional).toBe("baixo"); // 2 conflitos < 3
  });

  it("calcula risco operacional alto para muitos conflitos", async () => {
    const manyTrees = Array.from({ length: 10 }).map((_, i) => ({
      type: "node",
      id: i + 10,
      lat: -23.5,
      lon: -46.6,
      tags: { natural: "tree" }
    }));

    const res = await request(app)
      .post("/api/compliance/vegetation/auto")
      .send({ topology: mockTopology, osmData: manyTrees });

    expect(res.body.riscoOperacional).toBe("alto");
  });
});
