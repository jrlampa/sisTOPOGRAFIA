/**
 * releaseCabRoutes.test.ts — Testes de Release Governance & CAB (111 + 118 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("Release CAB Routes (111 + 118)", () => {
  // ── 111: Releases ──────────────────────────────────────────────────────────

  describe("GET /api/cab/releases", () => {
    it("deve retornar lista de releases", async () => {
      const res = await request(app).get("/api/cab/releases");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Release pré-semeado 0.9.0
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/cab/releases/changelog", () => {
    it("deve retornar changelog executivo", async () => {
      const res = await request(app).get("/api/cab/releases/changelog");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // 0.9.0 está concluído
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty("version");
      expect(res.body[0]).toHaveProperty("entry");
    });
  });

  describe("GET /api/cab/releases/:id", () => {
    it("deve retornar release existente por ID", async () => {
      const res = await request(app).get("/api/cab/releases/rel-0.9.0");
      expect(res.status).toBe(200);
      expect(res.body.version).toBe("0.9.0");
    });

    it("deve retornar 404 para release inexistente", async () => {
      const res = await request(app).get("/api/cab/releases/inexistente-123");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/cab/releases", () => {
    it("deve registrar novo release válido", async () => {
      const payload = {
        version: "0.9.1",
        type: "patch",
        title: "Fix de segurança",
        description: "Correção de vulnerabilidade CVSS médio",
        proposer: "tech-lead",
        scheduledAt: "2026-06-01T02:00:00.000Z",
        gitCommit: "abc1234",
        maintenanceWindowUtc: null,
        rollbackPlan: "git revert abc1234",
        changelogEntry: "Correção de CVE-2026-XXXX",
      };
      const res = await request(app).post("/api/cab/releases").send(payload);
      expect(res.status).toBe(201);
      expect(res.body.version).toBe("0.9.1");
      expect(res.body.status).toBe("planejado");
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/cab/releases")
        .send({ version: "" }); // campos obrigatórios ausentes
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/cab/releases/:id/approve", () => {
    it("deve aprovar release com 2 aprovadores", async () => {
      // Primeiro registra um release
      const regRes = await request(app).post("/api/cab/releases").send({
        version: "0.9.2",
        type: "minor",
        title: "Nova feature",
        description: "Impl nova funcionalidade",
        proposer: "dev-a",
        scheduledAt: null,
        gitCommit: null,
        maintenanceWindowUtc: null,
        rollbackPlan: "rollback plan",
        changelogEntry: "Feature nova",
      });
      expect(regRes.status).toBe(201);
      const id = regRes.body.id;

      // Primeira aprovação — ainda planejado
      const r1 = await request(app)
        .post(`/api/cab/releases/${id}/approve`)
        .send({ approver: "aprovador-1" });
      expect(r1.status).toBe(200);
      expect(r1.body.status).toBe("planejado");

      // Segunda aprovação — muda para aprovado
      const r2 = await request(app)
        .post(`/api/cab/releases/${id}/approve`)
        .send({ approver: "aprovador-2" });
      expect(r2.status).toBe(200);
      expect(r2.body.status).toBe("aprovado");
    });
  });

  // ── 118: Change Management ─────────────────────────────────────────────────

  describe("GET /api/cab/frozen-windows", () => {
    it("deve retornar períodos de congelamento", async () => {
      const res = await request(app).get("/api/cab/frozen-windows");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("reason");
    });
  });

  describe("POST /api/cab/mudancas", () => {
    it("deve criar RDM válida", async () => {
      const payload = {
        title: "Atualização de dependências",
        description: "Bump de versão para corrigir CVEs",
        type: "padrao",
        priority: "media",
        proposer: "dev-b",
        impactedSystems: ["backend", "frontend"],
        rollbackPlan: "npm install com versões anteriores",
        testingEvidence: "Suite de testes passou com 100%",
        windowStartUtc: "2026-06-05T02:00:00.000Z",
        windowEndUtc: "2026-06-05T04:00:00.000Z",
      };
      const res = await request(app).post("/api/cab/mudancas").send(payload);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pendente_aprovacao");
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/cab/mudancas")
        .send({ title: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/cab/mudancas", () => {
    it("deve listar RDMs", async () => {
      const res = await request(app).get("/api/cab/mudancas");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /api/cab/mudancas/:id/approve", () => {
    it("deve aprovar RDM com 1 aprovador (prioridade media)", async () => {
      const createRes = await request(app).post("/api/cab/mudancas").send({
        title: "Change para aprovar",
        description: "Descr",
        type: "normal",
        priority: "baixa",
        proposer: "prop",
        impactedSystems: ["api"],
        rollbackPlan: "rollback",
        testingEvidence: "evidência",
        windowStartUtc: null,
        windowEndUtc: null,
      });
      expect(createRes.status).toBe(201);
      const rdmId = createRes.body.id;

      const approveRes = await request(app)
        .post(`/api/cab/mudancas/${rdmId}/approve`)
        .send({ approver: "gerente" });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe("aprovado");
    });
  });
});
