import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import app from "../app.js";

vi.mock("../config.js", async () => {
  const actual = await vi.importActual("../config.js");
  return {
    config: {
      ...actual.config,
      ADMIN_TOKEN: "super-secret-admin-token",
      METRICS_TOKEN: "metrics-token",
    },
  };
});

vi.mock("../services/roleService.js", () => ({
  getUserRole: vi.fn(async (userId: string) => {
    if (userId === "admin_user") return { role: "admin", tenantId: "tenant_master" };
    if (userId === "user_A") return { role: "technician", tenantId: "tenant_A" };
    if (userId === "user_B") return { role: "technician", tenantId: "tenant_B" };
    return { role: "guest", tenantId: null };
  }),
  getUsersByRole: vi.fn(async () => []),
  setUserRole: vi.fn(async () => ({ success: true })),
  getRoleStatistics: vi.fn(async () => ({})),
}));

// Mock JobStatusService for IDOR tests
vi.mock("../services/jobStatusService.js", () => ({
  getJobWithPersistence: vi.fn(async (id: string) => {
    if (id === "job_A") return { id: "job_A", tenantId: "tenant_A", status: "completed" };
    if (id === "job_B") return { id: "job_B", tenantId: "tenant_B", status: "completed" };
    return null;
  }),
}));

// Mock JobDossierService for DXF IDOR tests
vi.mock("../services/jobDossierService.js", () => ({
  getJobDossier: vi.fn(async (id: string) => {
    if (id === "job_A") return { id: "job_A", tenantId: "tenant_A", status: "completed" };
    if (id === "job_B") return { id: "job_B", tenantId: "tenant_B", status: "completed" };
    return null;
  }),
  listRecentJobs: vi.fn(async () => []),
}));

describe("Advanced Hacker/Cracker Attack Simulations", () => {

  describe("IDOR (Insecure Direct Object Reference)", () => {
    it("should prevent User A from accessing Job B on /api/jobs (Cross-Tenant Leak)", async () => {
      const res = await request(app)
        .get("/api/jobs/job_B")
        .set("x-user-id", "user_A"); // User A from tenant A

      expect(res.status).toBe(404); // Protected returns 404
    });

    it("should prevent User A from accessing Job B on /api/dxf/jobs (Cross-Tenant Leak)", async () => {
      const res = await request(app)
        .get("/api/dxf/jobs/job_B")
        .set("x-user-id", "user_A"); 

      // Currently this might still be 200 until I fix dxfRoutes.ts
      expect([403, 404]).toContain(res.status);
    });

    it("should allow User A to access Job A (Owner Access)", async () => {
      const res = await request(app)
        .get("/api/jobs/job_A")
        .set("x-user-id", "user_A");

      expect(res.status).toBe(200);
    });
  });

  describe("Broken Access Control - Dangerous Routes", () => {
    it("should block non-admin access to Multi-Tenant Isolation management", async () => {
      const routes = [
        "/api/multi-tenant-isolation/tenants",
        "/api/multi-tenant-isolation/relatorio"
      ];

      for (const route of routes) {
        const res = await request(app)
          .get(route)
          .set("x-user-id", "user_A");
        
        expect(res.status).toBe(403);
      }
    });

    it("should block non-admin access to audit routes", async () => {
      const res = await request(app)
        .get("/api/admin/usuarios")
        .set("x-user-id", "user_A");
      
      expect([401, 403]).toContain(res.status);
    });
  });

  describe("NoSQL Injection & Parameter Pollution", () => {
    it("should reject NoSQL-style object injection in numeric fields", async () => {
      const res = await request(app)
        .post("/api/dxf")
        .set("x-user-id", "admin_user")
        .send({
          lat: { "$gt": 0 }, 
          lon: 0,
          radius: 100
        });

      // validation-enhanced or dxfRequestSchema should reject this
      expect(res.status).toBe(400);
    });

    it("should handle duplicate query parameters gracefully (HPP)", async () => {
      const res = await request(app)
        .get("/health?check=1&check=2"); // health endpoint accepts HPP without errors

      expect(res.status).toBe(200);
    });
  });

  describe("Mass Assignment / Over-posting", () => {
    it("should reject updating sensitive fields via standard routes", async () => {
      const res = await request(app)
        .post("/api/dxf")
        .set("x-user-id", "user_A")
        .send({
          lat: 0,
          lon: 0,
          radius: 100,
          role: "admin", 
          tenantId: "tenant_master" 
        });

      // Should be 422 because of unexpected fields in Zod strict schema
      expect(res.status).toBe(422); 
    });
  });

  describe("Deprecation Warnings (QA Compliance)", () => {
    it("should not emit DeprecationWarnings during runtime", async () => {
      let warningDetected: string | null = null;
      
      const onWarning = (warning: Error) => {
        if (warning.name === "DeprecationWarning") {
          warningDetected = warning.message;
        }
      };
      
      process.on("warning", onWarning);
      
      // Trigger some routes that might use deprecated APIs
      await request(app).get("/api/dxf/jobs/job_A").set("x-user-id", "admin_user");
      await request(app).post("/api/dxf").set("x-user-id", "admin_user").send({ lat: 0, lon: 0, radius: 100 });

      process.off("warning", onWarning);

      if (warningDetected) {
        throw new Error(`DeprecationWarning detected: ${warningDetected}`);
      }
    });
  });
});
