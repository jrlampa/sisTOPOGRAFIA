/**
 * serviceDeskRoutes.test.ts — Testes de Service Desk L1/L2/L3 (113 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("Service Desk Routes (113)", () => {
  describe("GET /api/servicedesk/metrics", () => {
    it("deve retornar métricas do service desk", async () => {
      const res = await request(app).get("/api/servicedesk/metrics");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("violacoesSla");
      expect(res.body).toHaveProperty("porNivel");
      expect(res.body.porNivel).toHaveProperty("L1");
      expect(res.body.porNivel).toHaveProperty("L2");
      expect(res.body.porNivel).toHaveProperty("L3");
    });
  });

  describe("GET /api/servicedesk/sla-alerts", () => {
    it("deve retornar lista de alertas SLA (pode ser vazia)", async () => {
      const res = await request(app).get("/api/servicedesk/sla-alerts");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /api/servicedesk/tickets", () => {
    it("deve criar ticket válido com prioridade alta", async () => {
      const payload = {
        title: "Erro na exportação DXF",
        description: "Job de exportação falha com erro 500",
        category: "exportacao_dxf",
        priority: "alta",
        reporter: "usuario@empresa.com",
        tenantId: "empresa-abc",
      };
      const res = await request(app)
        .post("/api/servicedesk/tickets")
        .send(payload);
      expect(res.status).toBe(201);
      expect(res.body.level).toBe("L1");
      expect(res.body.status).toBe("aberto");
      expect(res.body).toHaveProperty("slaDeadlineUtc");
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/servicedesk/tickets")
        .send({ title: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/servicedesk/tickets", () => {
    it("deve listar tickets", async () => {
      const res = await request(app).get("/api/servicedesk/tickets");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("deve filtrar por prioridade", async () => {
      const res = await request(app).get(
        "/api/servicedesk/tickets?priority=alta",
      );
      expect(res.status).toBe(200);
      expect(
        res.body.every(
          (t: { priority: string }) => t.priority === "alta",
        ),
      ).toBe(true);
    });
  });

  describe("GET /api/servicedesk/tickets/:id", () => {
    it("deve retornar 404 para ticket inexistente", async () => {
      const res = await request(app).get(
        "/api/servicedesk/tickets/tkt-inexistente",
      );
      expect(res.status).toBe(404);
    });

    it("deve retornar ticket por ID", async () => {
      const createRes = await request(app)
        .post("/api/servicedesk/tickets")
        .send({
          title: "Ticket para busca por ID",
          description: "Desc",
          category: "outro",
          priority: "baixa",
          reporter: "tester",
        });
      expect(createRes.status).toBe(201);
      const id = createRes.body.id;

      const getRes = await request(app).get(`/api/servicedesk/tickets/${id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(id);
    });
  });

  describe("POST /api/servicedesk/tickets/:id/comment", () => {
    it("deve adicionar comentário e mudar status", async () => {
      const createRes = await request(app)
        .post("/api/servicedesk/tickets")
        .send({
          title: "Ticket para comentário",
          description: "Desc",
          category: "outro",
          priority: "media",
          reporter: "tester",
        });
      const id = createRes.body.id;

      const commentRes = await request(app)
        .post(`/api/servicedesk/tickets/${id}/comment`)
        .send({
          author: "analista",
          message: "Investigando o problema",
          newStatus: "em_atendimento",
        });
      expect(commentRes.status).toBe(200);
      expect(commentRes.body.status).toBe("em_atendimento");
      expect(commentRes.body.events.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("POST /api/servicedesk/tickets/:id/escalate", () => {
    it("deve escalonar ticket de L1 para L2", async () => {
      const createRes = await request(app)
        .post("/api/servicedesk/tickets")
        .send({
          title: "Ticket para escalonamento",
          description: "Desc",
          category: "desempenho",
          priority: "alta",
          reporter: "user",
        });
      const id = createRes.body.id;

      const escRes = await request(app)
        .post(`/api/servicedesk/tickets/${id}/escalate`)
        .send({ author: "analista-l1", reason: "Problema requer engenharia" });
      expect(escRes.status).toBe(200);
      expect(escRes.body.level).toBe("L2");
      expect(escRes.body.status).toBe("escalado");
    });
  });

  describe("POST /api/servicedesk/tickets/:id/close", () => {
    it("deve encerrar ticket", async () => {
      const createRes = await request(app)
        .post("/api/servicedesk/tickets")
        .send({
          title: "Ticket para encerrar",
          description: "Desc",
          category: "autenticacao",
          priority: "baixa",
          reporter: "user",
        });
      const id = createRes.body.id;

      const closeRes = await request(app)
        .post(`/api/servicedesk/tickets/${id}/close`)
        .send({ author: "analista", resolution: "Problema resolvido — token expirado pelo cliente" });
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.status).toBe("encerrado");
      expect(closeRes.body.closedAt).not.toBeNull();
    });
  });
});
