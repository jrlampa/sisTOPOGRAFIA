import request from "supertest";
import app from "../app.js";
import { PortalStakeholderService } from "../services/portalStakeholderService.js";

const BASE = "/api/portal-stakeholder";

beforeEach(() => PortalStakeholderService._reset());

describe("portalStakeholderRoutes", () => {
  it("POST /acessos cria acesso", async () => {
    const res = await request(app).post(`${BASE}/acessos`).send({
      tenantId: "t1",
      orgao: "Prefeitura Municipal",
      nomeResponsavel: "Ana Costa",
      email: "ana@prefeitura.gov.br",
      perfil: "prefeitura",
      escopos: ["mapa", "relatorio"],
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("st-1");
    expect(res.body.status).toBe("convite_enviado");
    expect(res.body.tokenAcessoHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("GET /acessos filtra por tenant", async () => {
    await request(app).post(`${BASE}/acessos`).send({ tenantId: "t1", orgao: "Pref A", nomeResponsavel: "Ana", email: "a@pref.gov.br", perfil: "prefeitura", escopos: ["mapa"] });
    await request(app).post(`${BASE}/acessos`).send({ tenantId: "t2", orgao: "Pref B", nomeResponsavel: "Bia", email: "b@pref.gov.br", perfil: "prefeitura", escopos: ["mapa"] });
    const res = await request(app).get(`${BASE}/acessos?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /acessos/:id/ativar ativa acesso", async () => {
    await request(app).post(`${BASE}/acessos`).send({ tenantId: "t1", orgao: "Pref A", nomeResponsavel: "Ana", email: "ana@pref.gov.br", perfil: "prefeitura", escopos: ["mapa"] });
    const res = await request(app).post(`${BASE}/acessos/st-1/ativar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ativo");
  });

  it("POST /acessos/:id/solicitacoes cria solicitação com acesso ativo", async () => {
    await request(app).post(`${BASE}/acessos`).send({ tenantId: "t1", orgao: "Pref A", nomeResponsavel: "Ana", email: "ana@pref.gov.br", perfil: "prefeitura", escopos: ["mapa"] });
    await request(app).post(`${BASE}/acessos/st-1/ativar`);
    const res = await request(app).post(`${BASE}/acessos/st-1/solicitacoes`).send({
      tipoConsulta: "projeto",
      justificativa: "Análise técnica para reunião de fiscalização",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("ss-1");
    expect(res.body.status).toBe("pendente");
  });

  it("POST /acessos/:id/solicitacoes retorna 422 se acesso não ativo", async () => {
    await request(app).post(`${BASE}/acessos`).send({ tenantId: "t1", orgao: "Pref A", nomeResponsavel: "Ana", email: "ana@pref.gov.br", perfil: "prefeitura", escopos: ["mapa"] });
    const res = await request(app).post(`${BASE}/acessos/st-1/solicitacoes`).send({ tipoConsulta: "projeto", justificativa: "abcde" });
    expect(res.status).toBe(422);
  });

  it("POST /solicitacoes/:id/responder atualiza status", async () => {
    await request(app).post(`${BASE}/acessos`).send({ tenantId: "t1", orgao: "Pref A", nomeResponsavel: "Ana", email: "ana@pref.gov.br", perfil: "prefeitura", escopos: ["mapa"] });
    await request(app).post(`${BASE}/acessos/st-1/ativar`);
    await request(app).post(`${BASE}/acessos/st-1/solicitacoes`).send({ tipoConsulta: "projeto", justificativa: "Análise técnica para reunião" });
    const res = await request(app).post(`${BASE}/solicitacoes/ss-1/responder`).send({ status: "aprovado", resposta: "Acesso liberado" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("aprovado");
  });

  it("POST /acessos/:id/revogar revoga acesso", async () => {
    await request(app).post(`${BASE}/acessos`).send({ tenantId: "t1", orgao: "Pref A", nomeResponsavel: "Ana", email: "ana@pref.gov.br", perfil: "prefeitura", escopos: ["mapa"] });
    const res = await request(app).post(`${BASE}/acessos/st-1/revogar`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("revogado");
  });

  it("GET /perfis retorna catálogo", async () => {
    const res = await request(app).get(`${BASE}/perfis`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("fiscalizacao");
  });
});
