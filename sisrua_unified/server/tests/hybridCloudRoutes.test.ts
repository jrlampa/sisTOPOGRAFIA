import request from "supertest";
import app from "../app.js";
import { HybridCloudService } from "../services/hybridCloudService.js";

const BASE = "/api/hybrid-cloud";

beforeEach(() => HybridCloudService._reset());

describe("hybridCloudRoutes", () => {
  it("POST /workers cadastra worker", async () => {
    const res = await request(app).post(`${BASE}/workers`).send({
      tenantId: "t1",
      nome: "Worker Local A",
      tipoWorker: "local",
      capacidadeMaxJobs: 2,
      latenciaMs: 10,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("hw-1");
  });

  it("GET /workers filtra por tenant", async () => {
    await request(app).post(`${BASE}/workers`).send({ tenantId: "t1", nome: "Worker1", tipoWorker: "local", capacidadeMaxJobs: 2, latenciaMs: 10 });
    await request(app).post(`${BASE}/workers`).send({ tenantId: "t2", nome: "Worker2", tipoWorker: "cloud", capacidadeMaxJobs: 2, latenciaMs: 20 });
    const res = await request(app).get(`${BASE}/workers?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /jobs cria job", async () => {
    const res = await request(app).post(`${BASE}/jobs`).send({
      tenantId: "t1",
      tipoJob: "dxf_export",
      prioridade: "alta",
      estrategiaRoteamento: "hibrido",
      payload: { a: 1 },
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("hj-1");
  });

  it("POST /jobs/:id/rotear roteia para worker disponível", async () => {
    await request(app).post(`${BASE}/workers`).send({ tenantId: "t1", nome: "Worker1", tipoWorker: "local", capacidadeMaxJobs: 2, latenciaMs: 10 });
    await request(app).post(`${BASE}/jobs`).send({ tenantId: "t1", tipoJob: "dxf_export", prioridade: "alta", estrategiaRoteamento: "prefer_local", payload: {} });
    const res = await request(app).post(`${BASE}/jobs/hj-1/rotear`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("roteado");
    expect(res.body.workerSelecionadoId).toBe("hw-1");
  });

  it("PATCH /jobs/:id/status conclui e libera worker", async () => {
    await request(app).post(`${BASE}/workers`).send({ tenantId: "t1", nome: "Worker1", tipoWorker: "local", capacidadeMaxJobs: 2, latenciaMs: 10 });
    await request(app).post(`${BASE}/jobs`).send({ tenantId: "t1", tipoJob: "dxf_export", prioridade: "alta", estrategiaRoteamento: "prefer_local", payload: {} });
    await request(app).post(`${BASE}/jobs/hj-1/rotear`);
    const res = await request(app).patch(`${BASE}/jobs/hj-1/status`).send({ status: "concluido" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("concluido");
  });

  it("POST /jobs/:id/rotear retorna 422 sem worker", async () => {
    await request(app).post(`${BASE}/jobs`).send({ tenantId: "t1", tipoJob: "dxf_export", prioridade: "alta", estrategiaRoteamento: "prefer_local", payload: {} });
    const res = await request(app).post(`${BASE}/jobs/hj-1/rotear`);
    expect(res.status).toBe(422);
  });

  it("GET /estrategias retorna catálogo", async () => {
    const res = await request(app).get(`${BASE}/estrategias`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("hibrido");
  });
});
