/**
 * knowledgeBaseRoutes.test.ts — Testes Base de Conhecimento Forense (119 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("Knowledge Base Routes (119)", () => {
  describe("GET /api/knowledge/articles", () => {
    it("deve retornar artigos pré-semeados", async () => {
      const res = await request(app).get("/api/knowledge/articles");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(5);
      expect(res.body[0]).toHaveProperty("title");
      expect(res.body[0]).toHaveProperty("rootCause");
      expect(res.body[0]).toHaveProperty("solution");
    });

    it("deve filtrar por categoria seguranca", async () => {
      const res = await request(app).get(
        "/api/knowledge/articles?category=seguranca",
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.every(
          (a: { category: string }) => a.category === "seguranca",
        ),
      ).toBe(true);
    });

    it("deve filtrar por preventionAutomated=true", async () => {
      const res = await request(app).get(
        "/api/knowledge/articles?preventionAutomated=true",
      );
      expect(res.status).toBe(200);
      expect(
        res.body.every(
          (a: { preventionAutomated: boolean }) => a.preventionAutomated,
        ),
      ).toBe(true);
    });
  });

  describe("GET /api/knowledge/search", () => {
    it("deve encontrar artigo sobre OOM", async () => {
      const res = await request(app).get("/api/knowledge/search?q=oom");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it("deve retornar 400 sem parâmetro q", async () => {
      const res = await request(app).get("/api/knowledge/search");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/knowledge/articles/recurrence", () => {
    it("deve retornar relatório de recorrências", async () => {
      const res = await request(app).get(
        "/api/knowledge/articles/recurrence",
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalArticles");
      expect(res.body).toHaveProperty("recurrentWithoutAutomation");
      expect(res.body).toHaveProperty("topRecurrent");
      expect(res.body).toHaveProperty("criticalWithoutPrevention");
    });
  });

  describe("GET /api/knowledge/articles/:id", () => {
    it("deve retornar artigo pré-semeado por ID", async () => {
      const res = await request(app).get("/api/knowledge/articles/kb-dxf-001");
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("kb-dxf-001");
      expect(res.body.category).toBe("exportacao_dxf");
    });

    it("deve retornar 404 para artigo inexistente", async () => {
      const res = await request(app).get(
        "/api/knowledge/articles/kb-inexistente",
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/knowledge/articles", () => {
    it("deve criar novo artigo válido", async () => {
      const payload = {
        title: "Timeout em importação de shapefile grande",
        category: "exportacao_dxf",
        severity: "media",
        problem: "Shapefile > 100MB causa timeout na importação",
        rootCause: "Sem streaming de arquivo, leitura completa em memória",
        solution: "Implementar streaming com chunks de 10MB",
        verificationSteps: ["Importar arquivo de 150MB e verificar sucesso"],
        references: ["server/routes/shapefileRoutes.ts"],
        tags: ["shapefile", "timeout", "importação"],
        firstSeenAt: "2026-04-10T10:00:00.000Z",
        lastSeenAt: "2026-04-10T10:00:00.000Z",
        preventionAutomated: false,
      };
      const res = await request(app)
        .post("/api/knowledge/articles")
        .send(payload);
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Timeout em importação de shapefile grande");
      expect(res.body.occurrenceCount).toBe(1);
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/knowledge/articles")
        .send({ title: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/knowledge/articles/:id/occurrence", () => {
    it("deve incrementar occurrenceCount do artigo", async () => {
      const initial = await request(app).get(
        "/api/knowledge/articles/kb-dxf-001",
      );
      const countBefore = initial.body.occurrenceCount;

      const res = await request(app).post(
        "/api/knowledge/articles/kb-dxf-001/occurrence",
      );
      expect(res.status).toBe(200);
      expect(res.body.occurrenceCount).toBe(countBefore + 1);
    });

    it("deve retornar 422 para artigo inexistente", async () => {
      const res = await request(app).post(
        "/api/knowledge/articles/kb-inexistente/occurrence",
      );
      expect(res.status).toBe(422);
    });
  });
});
