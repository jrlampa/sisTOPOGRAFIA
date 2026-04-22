/**
 * bcpDrRoutes.test.ts — Items 51+52 [T1]
 * BCP/DR + Geographic Redundancy Failover
 */

import request from "supertest";
import app from "../app.js";
import { BcpDrService } from "../services/bcpDrService.js";

beforeEach(() => {
  BcpDrService._reset();
});

describe("BCP/DR Routes (51+52)", () => {
  describe("Cenários DR", () => {
    it("POST /api/bcp-dr/cenarios — deve criar cenário", async () => {
      const res = await request(app)
        .post("/api/bcp-dr/cenarios")
        .send({
          titulo: "Falha Total DC Principal",
          tipoIncidente: "falha_total",
          descricao: "Perda total do datacenter sa-east-1",
          rtoMaxHoras: 4,
          rpoMaxHoras: 1,
          regiaoAtiva: "sa-east-1",
          regiaoFallback: "us-east-1",
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^dr-cen-/);
      expect(res.body.rtoMaxHoras).toBe(4);
    });

    it("POST /api/bcp-dr/cenarios — 400 payload inválido", async () => {
      const res = await request(app).post("/api/bcp-dr/cenarios").send({ titulo: "" });
      expect(res.status).toBe(400);
    });

    it("GET /api/bcp-dr/cenarios — deve listar cenários", async () => {
      await request(app).post("/api/bcp-dr/cenarios").send({
        titulo: "C1", tipoIncidente: "falha_rede", descricao: "...", rtoMaxHoras: 2, rpoMaxHoras: 0.5,
        regiaoAtiva: "sa-east-1", regiaoFallback: "us-east-1",
      });
      const res = await request(app).get("/api/bcp-dr/cenarios");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });
  });

  describe("Testes DR", () => {
    it("POST /api/bcp-dr/testes — deve agendar teste", async () => {
      const { body: cen } = await request(app).post("/api/bcp-dr/cenarios").send({
        titulo: "C2", tipoIncidente: "falha_total", descricao: "...", rtoMaxHoras: 4, rpoMaxHoras: 1,
        regiaoAtiva: "sa-east-1", regiaoFallback: "us-east-1",
      });
      const res = await request(app).post("/api/bcp-dr/testes").send({
        cenarioId: cen.id,
        agendadoParа: new Date().toISOString(),
        responsavel: "ops@empresa.com",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^dr-test-/);
      expect(res.body.status).toBe("agendado");
    });

    it("POST /api/bcp-dr/testes/:id/executar — deve executar teste e avaliar RTO/RPO", async () => {
      const { body: cen } = await request(app).post("/api/bcp-dr/cenarios").send({
        titulo: "C3", tipoIncidente: "ataque_cyber", descricao: "...", rtoMaxHoras: 4, rpoMaxHoras: 1,
        regiaoAtiva: "sa-east-1", regiaoFallback: "us-east-1",
      });
      const { body: tst } = await request(app).post("/api/bcp-dr/testes").send({
        cenarioId: cen.id, agendadoParа: new Date().toISOString(), responsavel: "ops",
      });
      const res = await request(app)
        .post(`/api/bcp-dr/testes/${tst.id}/executar`)
        .send({
          rtoRealHoras: 2,
          rpoRealHoras: 0.5,
          observacoes: "Recuperação dentro do SLA",
          evidenciaConteudo: "log de restore base64...",
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("aprovado");
      expect(res.body.evidenciaHash).toHaveLength(64);
    });
  });

  describe("Regiões e Failover", () => {
    it("GET /api/bcp-dr/regioes — deve listar regiões", async () => {
      const res = await request(app).get("/api/bcp-dr/regioes");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      const ativas = res.body.filter((r: { ativa: boolean }) => r.ativa === true);
      expect(ativas.length).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/bcp-dr/failover — deve simular failover", async () => {
      const res = await request(app)
        .post("/api/bcp-dr/failover")
        .send({ regiaoFalha: "sa-east-1" });
      expect(res.status).toBe(200);
      expect(res.body.regiaoAnterior).toBe("sa-east-1");
      expect(res.body.regiaoAtual).toBeDefined();
    });

    it("GET /api/bcp-dr/resumo — deve calcular conformidade", async () => {
      const res = await request(app).get("/api/bcp-dr/resumo");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("conforme");
    });
  });
});
