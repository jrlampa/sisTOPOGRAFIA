import request from "supertest";
import app from "../app.js";
import { MultiTenantIsolationService } from "../services/multiTenantIsolationService.js";

beforeEach(() => MultiTenantIsolationService._reset());

describe("Multi-tenant Isolation", () => {
  it("POST /tenants — registra novo tenant com isolamento strict", async () => {
    const res = await request(app)
      .post("/api/multi-tenant-isolation/tenants")
      .send({ tenantId: "tenant-alpha", level: "strict" });
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe("tenant-alpha");
    expect(res.body.level).toBe("strict");
    expect(res.body.encryptionKeyRef).toBeDefined();
    expect(res.body.namespace).toBeDefined();
  });

  it("POST /tenants — idempotente: segundo registro retorna perfil existente", async () => {
    await request(app)
      .post("/api/multi-tenant-isolation/tenants")
      .send({ tenantId: "tenant-beta" });
    const res = await request(app)
      .post("/api/multi-tenant-isolation/tenants")
      .send({ tenantId: "tenant-beta" });
    expect(res.status).toBe(201);
  });

  it("GET /tenants — lista todos os tenants", async () => {
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "t1" });
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "t2" });
    const res = await request(app).get("/api/multi-tenant-isolation/tenants");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("GET /tenants/:tenantId — retorna perfil de isolamento", async () => {
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "tenant-gamma" });
    const res = await request(app).get("/api/multi-tenant-isolation/tenants/tenant-gamma");
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("tenant-gamma");
  });

  it("GET /tenants/:tenantId — 404 para tenant desconhecido", async () => {
    const res = await request(app).get("/api/multi-tenant-isolation/tenants/desconhecido");
    expect(res.status).toBe(404);
  });

  it("PUT /tenants/:tenantId/level — atualiza nível de isolamento", async () => {
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "tenant-delta" });
    const res = await request(app)
      .put("/api/multi-tenant-isolation/tenants/tenant-delta/level")
      .send({ level: "relaxed" });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe("relaxed");
  });

  it("POST /verificar — permite acesso do mesmo tenant", async () => {
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "tenant-A" });
    const res = await request(app)
      .post("/api/multi-tenant-isolation/verificar")
      .send({ tenantId: "tenant-A", solicitanteId: "tenant-A" });
    expect(res.status).toBe(200);
    expect(res.body.permitido).toBe(true);
  });

  it("POST /verificar — bloqueia acesso cross-tenant", async () => {
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "tenant-A" });
    const res = await request(app)
      .post("/api/multi-tenant-isolation/verificar")
      .send({ tenantId: "tenant-A", solicitanteId: "tenant-B" });
    expect(res.status).toBe(403);
    expect(res.body.permitido).toBe(false);
  });

  it("POST /tenants/:tenantId/rotacionar-chave — gera nova chave de criptografia", async () => {
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "tenant-E" });
    const { body: antes } = await request(app).get("/api/multi-tenant-isolation/tenants/tenant-E");
    const res = await request(app).post("/api/multi-tenant-isolation/tenants/tenant-E/rotacionar-chave");
    expect(res.status).toBe(200);
    expect(res.body.encryptionKeyRef).not.toBe(antes.encryptionKeyRef);
    expect(res.body.rotacoes).toBe(1);
  });

  it("GET /relatorio — retorna relatório de isolamento", async () => {
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "t1", level: "strict" });
    await request(app).post("/api/multi-tenant-isolation/tenants").send({ tenantId: "t2", level: "standard" });
    const res = await request(app).get("/api/multi-tenant-isolation/relatorio");
    expect(res.status).toBe(200);
    expect(res.body.totalTenants).toBe(2);
    expect(res.body.nivelDistribuicao.strict).toBe(1);
    expect(res.body.nivelDistribuicao.standard).toBe(1);
  });
});
