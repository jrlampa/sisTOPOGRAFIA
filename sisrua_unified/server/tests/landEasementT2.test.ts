/**
 * landEasementT2.test.ts — Testes para o item T2.107 (Land Easement Management).
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import complianceRoutes from "../routes/complianceRoutes.js";
import { ServidoesFundiariosService } from "../services/servidoesFundiariosService.js";
import { ServidoesFundiariasIncraService } from "../services/servidoesFundiariasIncraService.js";

const app = express();
app.use(express.json());
app.use("/api/compliance", complianceRoutes);

describe("Land Easement Management (T2-107)", () => {
  const mockTopology = {
    poles: [
      { id: "P1", lat: -23.500, lng: -46.6 }, // Lat milésimos par -> Simula conflito
      { id: "P2", lat: -23.501, lng: -46.601 }, // Impar -> OK
    ],
    transformers: [],
    edges: []
  };

  beforeEach(() => {
    ServidoesFundiariosService._reset();
    ServidoesFundiariasIncraService._reset();
  });

  it("POST /land/auto-detect identifica conflitos geospaciais simulados", async () => {
    const res = await request(app)
      .post("/api/compliance/land/auto-detect")
      .send(mockTopology);

    expect(res.status).toBe(200);
    expect(res.body.totalConflitos).toBe(1);
    expect(res.body.conflicts[0].poleId).toBe("P1");
  });

  it("POST /land/processos/auto cria processos técnico e documental", async () => {
    const res = await request(app)
      .post("/api/compliance/land/processos/auto")
      .send({
        tenantId: "t1",
        projetoId: "proj-fund-1",
        topology: mockTopology
      });

    expect(res.status).toBe(201);
    expect(res.body.incraProcessId).toBeDefined();
    expect(res.body.documentProcessId).toBeDefined();
    expect(res.body.conflictsCount).toBe(1);
  });
});
