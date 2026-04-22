import request from "supertest";
import app from "../app.js";
import { OperationalRunbookService } from "../services/operationalRunbookService.js";

beforeEach(() => OperationalRunbookService._reset());

describe("Operational Runbooks — Catálogo", () => {
  it("GET /runbooks — lista runbooks do catálogo inicial", async () => {
    const res = await request(app).get("/api/runbooks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(5);
  });

  it("GET /runbooks?categoria=falha_fila — filtra por categoria", async () => {
    const res = await request(app).get("/api/runbooks?categoria=falha_fila");
    expect(res.status).toBe(200);
    expect(res.body[0].categoria).toBe("falha_fila");
  });

  it("GET /runbooks/:id — obtém runbook por id", async () => {
    const res = await request(app).get("/api/runbooks/rb-001");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("rb-001");
    expect(res.body.passos.length).toBeGreaterThan(0);
  });

  it("GET /runbooks/:id — 404 para id desconhecido", async () => {
    const res = await request(app).get("/api/runbooks/rb-999");
    expect(res.status).toBe(404);
  });

  it("POST /runbooks — cria novo runbook", async () => {
    const res = await request(app).post("/api/runbooks").send({
      titulo: "Runbook de Implantação",
      categoria: "implantacao",
      descricao: "Passos para nova implantação",
      rtoMinutos: 60,
      versao: "1.0",
      passos: [
        {
          numero: 1,
          titulo: "Verificar pré-requisitos",
          descricao: "Checar Docker e rede",
          responsavel: "L2",
          obrigatorio: true,
        },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.categoria).toBe("implantacao");
    expect(res.body.id).toMatch(/^rb-/);
  });

  it("PATCH /runbooks/:id — atualiza status de runbook", async () => {
    const res = await request(app)
      .patch("/api/runbooks/rb-001")
      .send({ status: "depreciado" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("depreciado");
  });
});

describe("Operational Runbooks — Execuções", () => {
  it("POST /runbooks/:id/execucoes — inicia execução de runbook", async () => {
    const res = await request(app)
      .post("/api/runbooks/rb-002/execucoes")
      .send({ incidenteId: "inc-001", executor: "ops-l2" });
    expect(res.status).toBe(201);
    expect(res.body.runbookId).toBe("rb-002");
    expect(res.body.status).toBe("em_andamento");
    expect(res.body.passoAtual).toBe(1);
  });

  it("GET /runbooks/:id/execucoes — lista execuções de um runbook", async () => {
    await request(app)
      .post("/api/runbooks/rb-001/execucoes")
      .send({ incidenteId: "inc-002", executor: "ops-l1" });
    const res = await request(app).get("/api/runbooks/rb-001/execucoes");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it("POST /runbooks/execucoes/:execId/avancar — avança para próximo passo", async () => {
    const { body: exec } = await request(app)
      .post("/api/runbooks/rb-001/execucoes")
      .send({ incidenteId: "inc-003", executor: "ops-l1" });
    const res = await request(app)
      .post(`/api/runbooks/execucoes/${exec.id}/avancar`)
      .send({ resultado: "Jobs verificados, 2 com status falhou" });
    expect(res.status).toBe(200);
    expect(res.body.passoAtual).toBeGreaterThan(1);
  });

  it("POST /runbooks/execucoes/:execId/encerrar — encerra execução como falhou", async () => {
    const { body: exec } = await request(app)
      .post("/api/runbooks/rb-003/execucoes")
      .send({ incidenteId: "inc-004", executor: "ops-l3" });
    const res = await request(app)
      .post(`/api/runbooks/execucoes/${exec.id}/encerrar`)
      .send({ status: "falhou" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("falhou");
    expect(res.body.concluidoEm).toBeDefined();
  });
});
