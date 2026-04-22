import request from "supertest";
import app from "../app.js";
import { TeleEngenhariaArService } from "../services/teleEngenhariaArService.js";

const BASE = "/api/tele-engenharia";

beforeEach(() => TeleEngenhariaArService._reset());

describe("teleEngenhariaArRoutes", () => {
  it("POST /sessoes cria sessão", async () => {
    const res = await request(app).post(`${BASE}/sessoes`).send({
      tenantId: "t1",
      projetoId: "p1",
      nomeProjeto: "Projeto AR",
      engenheiroResponsavel: "Eng Responsavel",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("te-1");
    expect(res.body.status).toBe("pendente");
  });

  it("GET /sessoes filtra por tenant", async () => {
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t1", projetoId: "p1", nomeProjeto: "Projeto A", engenheiroResponsavel: "Eng A" });
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t2", projetoId: "p2", nomeProjeto: "Projeto B", engenheiroResponsavel: "Eng B" });
    const res = await request(app).get(`${BASE}/sessoes?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /sessoes/:id/iniciar ativa sessão", async () => {
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t1", projetoId: "p1", nomeProjeto: "Projeto", engenheiroResponsavel: "Eng" });
    const res = await request(app).post(`${BASE}/sessoes/te-1/iniciar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ativa");
  });

  it("POST /sessoes/:id/participantes adiciona participante", async () => {
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t1", projetoId: "p1", nomeProjeto: "Projeto", engenheiroResponsavel: "Eng" });
    const res = await request(app).post(`${BASE}/sessoes/te-1/participantes`).send({ usuarioId: "u1", nomeUsuario: "Maria Silva", papel: "operador" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("tp-1");
  });

  it("POST /sessoes/:id/anotacoes registra quando sessão ativa", async () => {
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t1", projetoId: "p1", nomeProjeto: "Projeto", engenheiroResponsavel: "Eng" });
    await request(app).post(`${BASE}/sessoes/te-1/iniciar`);
    await request(app).post(`${BASE}/sessoes/te-1/participantes`).send({ usuarioId: "u1", nomeUsuario: "Maria Silva", papel: "operador" });
    const res = await request(app).post(`${BASE}/sessoes/te-1/anotacoes`).send({
      participanteId: "tp-1",
      tipoAnotacao: "linha",
      geometria: { x1: 1, y1: 2, x2: 5, y2: 6 },
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ta-1");
  });

  it("POST /sessoes/:id/anotacoes retorna 422 se não ativa", async () => {
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t1", projetoId: "p1", nomeProjeto: "Projeto", engenheiroResponsavel: "Eng" });
    await request(app).post(`${BASE}/sessoes/te-1/participantes`).send({ usuarioId: "u1", nomeUsuario: "Maria Silva", papel: "operador" });
    const res = await request(app).post(`${BASE}/sessoes/te-1/anotacoes`).send({ participanteId: "tp-1", tipoAnotacao: "linha", geometria: {} });
    expect(res.status).toBe(422);
  });

  it("PATCH /sessoes/:id/sincronia atualiza estado", async () => {
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t1", projetoId: "p1", nomeProjeto: "Projeto", engenheiroResponsavel: "Eng" });
    const res = await request(app).patch(`${BASE}/sessoes/te-1/sincronia`).send({ estadoSincronia: "degradado" });
    expect(res.status).toBe(200);
    expect(res.body.estadoSincronia).toBe("degradado");
  });

  it("POST /sessoes/:id/encerrar finaliza sessão", async () => {
    await request(app).post(`${BASE}/sessoes`).send({ tenantId: "t1", projetoId: "p1", nomeProjeto: "Projeto", engenheiroResponsavel: "Eng" });
    const res = await request(app).post(`${BASE}/sessoes/te-1/encerrar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("encerrada");
  });

  it("GET /tipos-anotacao retorna catálogo", async () => {
    const res = await request(app).get(`${BASE}/tipos-anotacao`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("marcador");
  });
});
