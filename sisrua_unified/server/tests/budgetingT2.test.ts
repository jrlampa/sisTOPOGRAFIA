/**
 * budgetingT2.test.ts — Testes para os itens T2.42-44 (Automatic Budgeting).
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import sinapiRoutes from "../routes/sinapiRoutes.js";
import bdiRoiRoutes from "../routes/bdiRoiRoutes.js";

const app = express();
app.use(express.json());
app.use("/api/sinapi", sinapiRoutes);
app.use("/api/bdi-roi", bdiRoiRoutes);

describe("Advanced Budgeting Tier 2", () => {
  const mockTopology = {
    poles: [
      { id: "P1", lat: -23, lng: -46 },
      { id: "P2", lat: -23.001, lng: -46.001 },
    ],
    transformers: [
      { id: "T1", lat: -23, lng: -46, projectPowerKva: 75 },
    ],
    edges: [
      { fromPoleId: "P1", toPoleId: "P2", lengthMeters: 50 },
    ]
  };

  describe("Item 42: SINAPI Integration", () => {
    it("POST /orcamento/auto gera orçamento baseado na topologia", async () => {
      const res = await request(app)
        .post("/api/sinapi/orcamento/auto")
        .send({
          tenantId: "t1",
          projetoId: "proj-100",
          uf: "SP",
          topology: mockTopology
        });

      expect(res.status).toBe(201);
      expect(res.body.custoDirectoTotal).toBeGreaterThan(0);
      expect(res.body.itens.length).toBeGreaterThan(0);
      
      const hasT75 = res.body.itens.some((i: any) => i.codigoSinapi === "74133/003");
      expect(hasT75).toBe(true);
    });
  });

  describe("Items 43/44: BDI and ROI", () => {
    it("POST /calcular-bdi calcula custo global com encargos", async () => {
      const bdiRes = await request(app)
        .post("/api/bdi-roi/calcular-bdi")
        .send({
          tipoObra: "distribuicao_eletrica",
          tenantId: "t1",
          custoDirectoBase: 10000,
          componentes: {
            administracaoCentral: 0.05,
            seguroRisco: 0.02,
            despesasFinanceiras: 0.01,
            lucro: 0.10,
            iss: 0.05,
            pis: 0.0065,
            cofins: 0.03,
            irpjCsll: 0.0348
          }
        });

      expect(bdiRes.status).toBe(201);
      expect(bdiRes.body.percentualBdi).toBeCloseTo(35.2, 1);
      expect(bdiRes.body.custoComBdi).toBeGreaterThan(10000);
    });
  });
});
