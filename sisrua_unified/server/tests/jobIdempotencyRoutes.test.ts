import request from "supertest";
import app from "../app.js";
import { JobIdempotencyService } from "../services/jobIdempotencyService.js";

beforeEach(() => JobIdempotencyService._reset());

describe("Job Idempotency", () => {
  it("POST /registrar — registra nova chave de idempotência", async () => {
    const res = await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "export-abc-123", payload: { projetoId: "p1" } });
    expect(res.status).toBe(201);
    expect(res.body.duplicata).toBe(false);
    expect(res.body.registro.status).toBe("processando");
    expect(res.body.registro.jobId).toBeDefined();
  });

  it("POST /registrar — retorna 200 para chave duplicada", async () => {
    await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "export-dup", payload: { x: 1 } });
    const res = await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "export-dup", payload: { x: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.duplicata).toBe(true);
  });

  it("GET /:chave — consulta registro por chave", async () => {
    await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "job-get-test", payload: { y: 2 } });
    const res = await request(app).get("/api/idempotency/job-get-test");
    expect(res.status).toBe(200);
    expect(res.body.chave).toBe("job-get-test");
  });

  it("GET /:chave — 404 para chave inexistente", async () => {
    const res = await request(app).get("/api/idempotency/nao-existe");
    expect(res.status).toBe(404);
  });

  it("POST /:chave/concluir — marca job como concluído", async () => {
    await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "job-conclude", payload: {} });
    const res = await request(app)
      .post("/api/idempotency/job-conclude/concluir")
      .send({ resultado: { artefato: "file.dxf" } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("concluido");
    expect(res.body.resultado).toMatchObject({ artefato: "file.dxf" });
  });

  it("POST /:chave/falhar — marca job como erro", async () => {
    await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "job-fail", payload: {} });
    const res = await request(app)
      .post("/api/idempotency/job-fail/falhar")
      .send({ erro: "Python OOM" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("erro");
  });

  it("GET / — lista todos os registros", async () => {
    await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "k1", payload: {} });
    const res = await request(app).get("/api/idempotency/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("DELETE /:chave — remove registro", async () => {
    await request(app)
      .post("/api/idempotency/registrar")
      .send({ chave: "job-del", payload: {} });
    const res = await request(app).delete("/api/idempotency/job-del");
    expect(res.status).toBe(204);
  });
});
