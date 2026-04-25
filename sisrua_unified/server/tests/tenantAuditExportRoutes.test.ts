/**
 * tenantAuditExportRoutes.test.ts — Item 34 [T1]
 */

import request from "supertest";
import app from "../app.js";
import { TenantAuditExportService } from "../services/tenantAuditExportService.js";

beforeEach(() => {
  TenantAuditExportService._reset();
});

describe("Tenant Audit Export Routes (34)", () => {
  const tenantId = "t-abc";

  it("POST /api/tenant-audit-export/logs — deve ingestar evento", async () => {
    const res = await request(app)
      .post("/api/tenant-audit-export/logs")
      .send({
        tenantId,
        tipo: "acesso",
        actor: "user@empresa.com",
        recurso: "/api/bt/calculate",
        acao: "GET",
        resultado: "sucesso",
        ip: "10.0.0.1",
      });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe(tenantId);
    expect(res.body.id).toMatch(/^tae-/);
  });

  it("POST /api/tenant-audit-export/logs — 400 para payload inválido", async () => {
    const res = await request(app)
      .post("/api/tenant-audit-export/logs")
      .send({ tenantId, tipo: "acesso" });
    expect(res.status).toBe(400);
  });

  it("GET /api/tenant-audit-export/logs/:tenantId — deve consultar eventos", async () => {
    await request(app).post("/api/tenant-audit-export/logs").send({
      tenantId, tipo: "operacao", actor: "admin", recurso: "/dxf", acao: "POST", resultado: "sucesso",
    });
    const res = await request(app).get(`/api/tenant-audit-export/logs/${tenantId}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(Array.isArray(res.body.eventos)).toBe(true);
  });

  it("POST /api/tenant-audit-export/export — deve exportar JSON com hash", async () => {
    await request(app).post("/api/tenant-audit-export/logs").send({
      tenantId, tipo: "acesso", actor: "user", recurso: "/api/jobs", acao: "GET", resultado: "sucesso",
    });
    const res = await request(app)
      .post("/api/tenant-audit-export/export")
      .send({ tenantId, formato: "json" });
    expect(res.status).toBe(200);
    expect(res.body.metadata.tenantId).toBe(tenantId);
    expect(res.body.metadata.formato).toBe("json");
    expect(res.body.metadata.hashIntegridade).toHaveLength(64);
    expect(res.body.metadata.totalEventos).toBe(1);
  });

  it("POST /api/tenant-audit-export/export — deve exportar CSV", async () => {
    await request(app).post("/api/tenant-audit-export/logs").send({
      tenantId, tipo: "falha", actor: "svc-x", recurso: "/api/dxf", acao: "POST", resultado: "erro",
    });
    const res = await request(app)
      .post("/api/tenant-audit-export/export")
      .send({ tenantId, formato: "csv" });
    expect(res.status).toBe(200);
    expect(res.body.conteudo).toContain("id,tenantId");
  });

  it("GET /api/tenant-audit-export/stats/:tenantId — deve retornar estatísticas", async () => {
    await request(app).post("/api/tenant-audit-export/logs").send({
      tenantId, tipo: "admin", actor: "admin", recurso: "/admin", acao: "DELETE", resultado: "negado",
    });
    const res = await request(app).get(`/api/tenant-audit-export/stats/${tenantId}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.porTipo).toBeDefined();
  });
});
