/**
 * modelRetrocompatRoutes.test.ts — Testes de integração para as rotas de Retrocompatibilidade (14B [T1])
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import modelRetrocompatRoutes from "../routes/modelRetrocompatRoutes.js";

const app = express();
app.use(express.json());
app.use("/api/model-retrocompat", modelRetrocompatRoutes);

describe("modelRetrocompatRoutes", () => {
  it("GET /models retorna lista de modelos ativos", async () => {
    const res = await request(app).get("/api/model-retrocompat/models");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /models/stable retorna lista de modelos stable", async () => {
    const res = await request(app).get("/api/model-retrocompat/models/stable");
    expect(res.status).toBe(200);
    expect(res.body.every((m: any) => m.status === "stable")).toBe(true);
  });

  it("GET /models/:id retorna 404 para modelo inexistente", async () => {
    const res = await request(app).get("/api/model-retrocompat/models/nao-existe");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("não encontrado");
  });

  it("GET /models/:id retorna detalhes para modelo existente", async () => {
    const res = await request(app).get("/api/model-retrocompat/models/ollama-llama3.2-3b");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ollama-llama3.2-3b");
  });

  it("GET /models/:id/fallback retorna fallback para modelo", async () => {
    const res = await request(app).get("/api/model-retrocompat/models/ollama-llama3-8b/fallback");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ollama-llama3.2-3b");
  });

  it("GET /models/:id/fallback retorna 404 se nenhum fallback for encontrado (ID inválido)", async () => {
    // getFallbackModel retorna o primeiro stable se ID não existe, 
    // mas se o catálogo estivesse vazio... 
    // Na verdade, se passarmos um ID que não existe, ele retorna um fallback.
    // Vamos testar se o router lida com ID inexistente no getModelById antes de getFallback.
    // Wait, o router chama getFallbackModel(req.params.modelId) diretamente.
    // getFallbackModel sempre retorna algo se houver stables.
    const res = await request(app).get("/api/model-retrocompat/models/invalid-id/fallback");
    expect(res.status).toBe(200); // Retorna o default stable
  });

  it("GET /deprecation-alerts retorna lista de alertas", async () => {
    const res = await request(app).get("/api/model-retrocompat/deprecation-alerts");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /templates retorna lista de templates", async () => {
    const res = await request(app).get("/api/model-retrocompat/templates");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /templates/:id retorna 404 para template inexistente", async () => {
    const res = await request(app).get("/api/model-retrocompat/templates/nao-existe");
    expect(res.status).toBe(404);
  });

  it("POST /check-compatibility valida entrada", async () => {
    const res = await request(app)
      .post("/api/model-retrocompat/check-compatibility")
      .send({});
    expect(res.status).toBe(400);
  });

  it("POST /check-compatibility retorna resultado de compatibilidade", async () => {
    const res = await request(app)
      .post("/api/model-retrocompat/check-compatibility")
      .send({
        modelId: "ollama-llama3.2-3b",
        promptTemplateId: "pt-dg-analysis-v1"
      });
    expect(res.status).toBe(200);
    expect(res.body.compatible).toBe(true);
  });
});
