/**
 * auditColdStorageRoutes.test.ts — Item 76 [T1]
 */

import request from "supertest";
import app from "../app.js";

describe("Audit Cold Storage Routes (76)", () => {
  const oldTs = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const recentTs = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const tenant = `tenant-cold-${Date.now()}`;

  describe("POST /api/audit-cold/logs", () => {
    it("deve ingerir logs na camada quente", async () => {
      const r1 = await request(app).post("/api/audit-cold/logs").send({
        tenantId: tenant,
        actor: "user-1",
        action: "role_update",
        resource: "user_roles",
        ts: oldTs,
        context: { ip: "10.0.0.1" },
      });
      expect(r1.status).toBe(201);

      const r2 = await request(app).post("/api/audit-cold/logs").send({
        tenantId: tenant,
        actor: "user-2",
        action: "login",
        resource: "auth",
        ts: recentTs,
        context: { ip: "10.0.0.2" },
      });
      expect(r2.status).toBe(201);
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app).post("/api/audit-cold/logs").send({
        tenantId: "",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/audit-cold/archive/run", () => {
    it("deve mover logs antigos para cold storage", async () => {
      const res = await request(app)
        .post("/api/audit-cold/archive/run")
        .send({ olderThanDays: 90 });
      expect(res.status).toBe(200);
      expect(res.body.moved).toBeGreaterThanOrEqual(1);
      expect(res.body.totalCold).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/audit-cold/stats", () => {
    it("deve retornar estatísticas de partições frias", async () => {
      const res = await request(app).get("/api/audit-cold/stats");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("hotCount");
      expect(res.body).toHaveProperty("coldCount");
      expect(Array.isArray(res.body.partitions)).toBe(true);
    });
  });

  describe("GET /api/audit-cold/logs", () => {
    it("deve consultar logs frios por tenant", async () => {
      const res = await request(app).get(
        `/api/audit-cold/logs?tenantId=${tenant}&limit=50&offset=0`,
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.every((l: { tenantId: string }) => l.tenantId === tenant),
      ).toBe(true);
    });
  });

  describe("GET /api/audit-cold/partitions/:month/export", () => {
    it("deve exportar partição em NDJSON com hash", async () => {
      const month = oldTs.slice(0, 7);
      const res = await request(app).get(
        `/api/audit-cold/partitions/${month}/export`,
      );
      expect(res.status).toBe(200);
      expect(res.body.month).toBe(month);
      expect(res.body).toHaveProperty("sha256");
      expect(res.body).toHaveProperty("ndjson");
      expect(typeof res.body.ndjson).toBe("string");
    });

    it("deve retornar 400 para month inválido", async () => {
      const res = await request(app).get(
        "/api/audit-cold/partitions/2026_04/export",
      );
      expect(res.status).toBe(400);
    });
  });
});
