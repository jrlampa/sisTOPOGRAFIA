/**
 * blueGreenRoutes.test.ts — Item 23 [T1]
 */

import request from "supertest";
import app from "../app.js";
import { BlueGreenService } from "../services/blueGreenService.js";

beforeEach(() => {
  BlueGreenService._reset();
});

describe("Blue/Green Deployment Routes (23)", () => {
  it("POST /api/blue-green/slots — deve deploy no slot blue", async () => {
    const res = await request(app)
      .post("/api/blue-green/slots")
      .send({ color: "blue", version: "1.2.0", gitCommit: "abc1234" });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe("blue");
    expect(res.body.status).toBe("ready");
  });

  it("POST /api/blue-green/slots — deve deploy no slot green", async () => {
    const res = await request(app)
      .post("/api/blue-green/slots")
      .send({ color: "green", version: "1.3.0", gitCommit: "def5678" });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe("green");
  });

  it("POST /api/blue-green/slots — 400 para payload inválido", async () => {
    const res = await request(app)
      .post("/api/blue-green/slots")
      .send({ color: "invalid_color" });
    expect(res.status).toBe(400);
  });

  it("POST /api/blue-green/smoke-gate — deve marcar smoke tests passed", async () => {
    await request(app).post("/api/blue-green/slots").send({ color: "green", version: "1.3.0", gitCommit: "def" });
    const res = await request(app).post("/api/blue-green/smoke-gate").send({ color: "green", passed: true });
    expect(res.status).toBe(200);
    expect(res.body.smokeTestsPassed).toBe(true);
    expect(res.body.status).toBe("standby");
  });

  it("POST /api/blue-green/switch — deve alternar para green após smoke pass", async () => {
    await request(app).post("/api/blue-green/slots").send({ color: "green", version: "1.3.0", gitCommit: "def" });
    await request(app).post("/api/blue-green/smoke-gate").send({ color: "green", passed: true });
    const res = await request(app)
      .post("/api/blue-green/switch")
      .send({ to: "green", approvedBy: "ops@empresa.com", motivo: "Release 1.3.0" });
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.to).toBe("green");
  });

  it("POST /api/blue-green/switch — 409 se smoke não passou", async () => {
    await request(app).post("/api/blue-green/slots").send({ color: "green", version: "1.3.0", gitCommit: "def" });
    const res = await request(app)
      .post("/api/blue-green/switch")
      .send({ to: "green", approvedBy: "ops@empresa.com", motivo: "Sem smoke tests" });
    expect(res.status).toBe(409);
    expect(res.body.sucesso).toBe(false);
  });

  it("POST /api/blue-green/rollback — deve fazer rollback", async () => {
    await request(app).post("/api/blue-green/slots").send({ color: "green", version: "1.3.0", gitCommit: "def" });
    await request(app).post("/api/blue-green/smoke-gate").send({ color: "green", passed: true });
    await request(app).post("/api/blue-green/switch").send({ to: "green", approvedBy: "ops", motivo: "release" });
    // Agora rollback para blue
    await request(app).post("/api/blue-green/slots").send({ color: "blue", version: "1.2.0", gitCommit: "abc" });
    await request(app).post("/api/blue-green/smoke-gate").send({ color: "blue", passed: true });
    const res = await request(app).post("/api/blue-green/rollback").send({ approvedBy: "ops" });
    expect(res.status).toBe(200);
  });

  it("GET /api/blue-green/state — deve retornar estado atual", async () => {
    const res = await request(app).get("/api/blue-green/state");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("activeSlot");
  });

  it("GET /api/blue-green/history — deve listar histórico", async () => {
    const res = await request(app).get("/api/blue-green/history");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
