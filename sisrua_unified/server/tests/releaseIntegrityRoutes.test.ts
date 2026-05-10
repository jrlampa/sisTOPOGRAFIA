/**
 * releaseIntegrityRoutes.test.ts — Testes de integração para as rotas de Integridade de Release (16 [T1])
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs";
import releaseIntegrityRoutes from "../routes/releaseIntegrityRoutes.js";

const app = express();
app.use(express.json());
app.use("/api/release", releaseIntegrityRoutes);

// Mock fs to avoid reading real files during integration tests
vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn((path: string) => {
      if (path.endsWith("package.json")) {
        return JSON.stringify({ name: "sisrua-unified", version: "0.9.0" });
      }
      return "dummy";
    }),
    existsSync: vi.fn(() => true),
  },
  readFileSync: vi.fn((path: string) => {
    if (path.endsWith("package.json")) {
      return JSON.stringify({ name: "sisrua-unified", version: "0.9.0" });
    }
    return "dummy";
  }),
  existsSync: vi.fn(() => true),
}));

describe("releaseIntegrityRoutes", () => {
  it("GET /manifest retorna um manifesto assinado", async () => {
    const res = await request(app).get("/api/release/manifest");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("0.9.0");
    expect(res.body.signature).not.toBeNull();
  });

  it("GET /provenance retorna dados do build", async () => {
    const res = await request(app).get("/api/release/provenance");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("0.9.0");
    expect(res.body.nodeVersion).toBeDefined();
  });

  it("POST /verify valida esquema do corpo", async () => {
    const res = await request(app).post("/api/release/verify").send({});
    expect(res.status).toBe(400);
  });

  it("POST /verify valida integridade de um manifesto real", async () => {
    // 1. Obter um manifesto válido
    const manifestRes = await request(app).get("/api/release/manifest");
    const manifest = manifestRes.body;

    // 2. Verificar o manifesto
    const verifyRes = await request(app)
      .post("/api/release/verify")
      .send({ manifest });
    
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
  });

  it("POST /verify rejeita manifesto adulterado", async () => {
    const manifestRes = await request(app).get("/api/release/manifest");
    const manifest = manifestRes.body;
    
    // Adulteração
    manifest.version = "1.0.0-hack";

    const verifyRes = await request(app)
      .post("/api/release/verify")
      .send({ manifest });
    
    expect(verifyRes.status).toBe(422);
    expect(verifyRes.body.valid).toBe(false);
  });
});
