import request from "supertest";
import app from "../app.js";

const BASE = "/api/dg";

const optimizePayload = {
  runId: "9ab38f84-17cb-4f91-9d0f-001122334455",
  poles: [
    {
      id: "P1",
      position: { lat: -23.5489, lon: -46.6388 },
      demandKva: 15,
      clients: 3,
    },
    {
      id: "P2",
      position: { lat: -23.549, lon: -46.6386 },
      demandKva: 20,
      clients: 4,
    },
    {
      id: "P3",
      position: { lat: -23.5492, lon: -46.6387 },
      demandKva: 12,
      clients: 2,
    },
    {
      id: "P4",
      position: { lat: -23.5491, lon: -46.6389 },
      demandKva: 18,
      clients: 3,
    },
  ],
  transformer: {
    id: "TR75",
    position: { lat: -23.5491, lon: -46.6388 },
    kva: 75,
    currentDemandKva: 0,
  },
};

describe("dgRoutes", () => {
  it("POST /optimize executa otimização e persiste a run para consulta posterior", async () => {
    const optimizeRes = await request(app).post(`${BASE}/optimize`).send(optimizePayload);

    expect(optimizeRes.status).toBe(200);
    expect(optimizeRes.body.runId).toBe(optimizePayload.runId);
    expect(optimizeRes.body.recommendation).not.toBeNull();

    const runRes = await request(app).get(`${BASE}/runs/${optimizePayload.runId}`);

    expect(runRes.status).toBe(200);
    expect(runRes.body.runId).toBe(optimizePayload.runId);
    expect(runRes.body.inputHash).toBe(optimizeRes.body.inputHash);
  });

  it("GET /runs/:id/scenarios retorna cenários e respeita filtro feasibleOnly", async () => {
    await request(app)
      .post(`${BASE}/optimize`)
      .send({ ...optimizePayload, runId: "0f5f64af-9a07-4ca4-81fd-667788990011" });

    const res = await request(app).get(
      `${BASE}/runs/0f5f64af-9a07-4ca4-81fd-667788990011/scenarios?feasibleOnly=true`,
    );

    expect(res.status).toBe(200);
    expect(res.body.runId).toBe("0f5f64af-9a07-4ca4-81fd-667788990011");
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.returned).toBeGreaterThan(0);
    expect(res.body.scenarios.every((scenario: { feasible: boolean }) => scenario.feasible)).toBe(true);
  });

  it("GET /runs/:id/recommendation retorna a recomendação persistida", async () => {
    await request(app)
      .post(`${BASE}/optimize`)
      .send({ ...optimizePayload, runId: "db93541b-4d8d-44b6-8d88-112233445566" });

    const res = await request(app).get(
      `${BASE}/runs/db93541b-4d8d-44b6-8d88-112233445566/recommendation`,
    );

    expect(res.status).toBe(200);
    expect(res.body.runId).toBe("db93541b-4d8d-44b6-8d88-112233445566");
    expect(res.body.recommendation).not.toBeNull();
    expect(res.body.recommendation.bestScenario.feasible).toBe(true);
  });

  it("GET /runs/:id retorna 404 quando a run não existe", async () => {
    const res = await request(app).get(
      `${BASE}/runs/8f746fab-1b08-4586-a2fc-123456789abc`,
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Run DG não encontrada.");
  });
});