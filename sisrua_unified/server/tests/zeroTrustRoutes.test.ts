/**
 * zeroTrustRoutes.test.ts — Item 22 [T1]
 */

import request from "supertest";
import app from "../app.js";
import { ZeroTrustService } from "../services/zeroTrustService.js";
import crypto from "crypto";

beforeEach(() => {
  ZeroTrustService._reset();
});

describe("Zero Trust Routes (22)", () => {
  const svcA = { serviceId: "svc-express", nome: "Express API", certFingerprint: "fp-express-abc1234567890", secret: "secret-express-16ch" };
  const svcB = { serviceId: "svc-python", nome: "Python Worker", certFingerprint: "fp-python-abc1234567890", secret: "secret-python-16cha" };

  it("POST /api/zero-trust/servicos — deve registrar serviço", async () => {
    const res = await request(app).post("/api/zero-trust/servicos").send(svcA);
    expect(res.status).toBe(201);
    expect(res.body.serviceId).toBe("svc-express");
    expect(res.body.secretHash).toBe("***"); // mascarado, nunca em claro
  });

  it("POST /api/zero-trust/servicos — 409 para serviço duplicado", async () => {
    await request(app).post("/api/zero-trust/servicos").send(svcA);
    const res = await request(app).post("/api/zero-trust/servicos").send(svcA);
    expect(res.status).toBe(409);
  });

  it("POST /api/zero-trust/servicos — 400 para payload inválido", async () => {
    const res = await request(app).post("/api/zero-trust/servicos").send({ serviceId: "" });
    expect(res.status).toBe(400);
  });

  it("GET /api/zero-trust/servicos — deve listar identidades", async () => {
    await request(app).post("/api/zero-trust/servicos").send(svcA);
    const res = await request(app).get("/api/zero-trust/servicos");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it("DELETE /api/zero-trust/servicos/:id — deve revogar serviço", async () => {
    await request(app).post("/api/zero-trust/servicos").send(svcA);
    const res = await request(app).delete(`/api/zero-trust/servicos/${svcA.serviceId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("revogado");
  });

  it("POST /api/zero-trust/politicas — deve criar política", async () => {
    const res = await request(app)
      .post("/api/zero-trust/politicas")
      .send({ emissor: "svc-express", receptor: "svc-python", permissoes: ["execute:dxf"] });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^pol-/);
  });

  it("POST /api/zero-trust/validar — deve rejeitar serviço não registrado", async () => {
    const nonce = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const token = crypto.createHmac("sha256", svcA.secret).update(`${nonce}:${timestamp}`).digest("hex");
    const res = await request(app).post("/api/zero-trust/validar").send({
      emissorId: "svc-inexistente", receptorId: "svc-python",
      token, nonce, timestamp, secret: svcA.secret,
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/zero-trust/access-log — deve listar tentativas", async () => {
    const res = await request(app).get("/api/zero-trust/access-log");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
