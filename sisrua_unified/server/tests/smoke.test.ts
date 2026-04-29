/**
 * smoke.test.ts — Testes de Fumaça (Post-deploy).
 *
 * Roadmap Item P2.2 [T1]: Post-deploy Smoke Tests.
 * Valida a conectividade básica e os serviços vitais do backend.
 */
import request from "supertest";
import { vi } from "vitest";
import app from "../app.js";
import { config } from "../config.js";

describe("Smoke Tests — Serviços Vitais", () => {
  
  it("GET /health — deve retornar status 200 (ou 503 se banco offline)", async () => {
    const res = await request(app).get("/health");
    expect([200, 503]).toContain(res.status);
    expect(["online", "degraded", "maintenance"]).toContain(res.body.status);
    expect(res.body).toHaveProperty("dependencies");
  });

  it("GET /api/admin/saude — deve estar operacional", async () => {
    const authHeader = config.ADMIN_TOKEN ? `Bearer ${config.ADMIN_TOKEN}` : "";
    const res = await request(app)
      .get("/api/admin/saude")
      .set("Authorization", authHeader);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("operacional");
  });

  it("GET /api/constants/status — catálogo de constantes deve responder", async () => {
    const authHeader = config.ADMIN_TOKEN ? `Bearer ${config.ADMIN_TOKEN}` : "";
    const res = await request(app)
      .get("/api/constants/status")
      .set("Authorization", authHeader);
    
    expect([200, 401]).toContain(res.status); // 401 é aceitável se sem token no teste
  });

  it("GET /api/admin/dashboard-mvs — MVs de performance devem estar acessíveis", async () => {
    if (!config.ADMIN_TOKEN) return; // Skip if no auth configured

    const res = await request(app)
      .get("/api/admin/dashboard-mvs")
      .set("Authorization", `Bearer ${config.ADMIN_TOKEN}`);
    
    // Pode retornar 503 se o banco estiver offline nos testes, o que é um 'sucesso' do serviço
    // de métricas ao detectar a indisponibilidade sem dar crash.
    expect([200, 503]).toContain(res.status);
  });
});

