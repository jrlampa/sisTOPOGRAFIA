import request from "supertest";
import app from "../app.js";
import { IdentityLifecycleService } from "../services/identityLifecycleService.js";

beforeEach(() => IdentityLifecycleService._reset());

const joinerPayload = {
  username: "jsilva",
  email: "jsilva@empresa.com",
  nomeCompleto: "João Silva",
  departamento: "Engenharia",
  cargo: "Engenheiro Pleno",
  tenantId: "tenant-acme",
  executor: "rh-sistema",
};

describe("Identity Lifecycle — JML", () => {
  it("POST /joiner — provisiona novo usuário", async () => {
    const res = await request(app).post("/api/identity/joiner").send(joinerPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("ativo");
    expect(res.body.username).toBe("jsilva");
  });

  it("POST /joiner — 400 se payload inválido", async () => {
    const res = await request(app).post("/api/identity/joiner").send({ username: "x" });
    expect(res.status).toBe(400);
  });

  it("POST /mover/:userId — move usuário para novo cargo", async () => {
    const { body: user } = await request(app).post("/api/identity/joiner").send(joinerPayload);
    const res = await request(app)
      .post(`/api/identity/mover/${user.id}`)
      .send({ departamento: "Operações", executor: "rh-sistema" });
    expect(res.status).toBe(200);
    expect(res.body.departamento).toBe("Operações");
  });

  it("POST /mover/:userId — 404 para userId inexistente", async () => {
    const res = await request(app)
      .post("/api/identity/mover/iam-999")
      .send({ executor: "rh" });
    expect(res.status).toBe(404);
  });

  it("POST /leaver/:userId — desativa usuário", async () => {
    const { body: user } = await request(app).post("/api/identity/joiner").send(joinerPayload);
    const res = await request(app)
      .post(`/api/identity/leaver/${user.id}`)
      .send({ executor: "rh-sistema" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("inativo");
    expect(res.body.roles).toEqual([]);
  });

  it("GET /users — lista usuários por tenantId", async () => {
    await request(app).post("/api/identity/joiner").send(joinerPayload);
    const res = await request(app).get("/api/identity/users?tenantId=tenant-acme");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it("GET /users/:id — obtém usuário por id", async () => {
    const { body: user } = await request(app).post("/api/identity/joiner").send(joinerPayload);
    const res = await request(app).get(`/api/identity/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("jsilva@empresa.com");
  });

  it("GET /audit — retorna trilha JML", async () => {
    await request(app).post("/api/identity/joiner").send(joinerPayload);
    const res = await request(app).get("/api/identity/audit");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].tipo).toBe("joiner");
  });
});

describe("Identity Lifecycle — SCIM v2", () => {
  it("POST /scim/v2/Users — cria usuário SCIM", async () => {
    const res = await request(app).post("/api/identity/scim/v2/Users").send({
      userName: "scim.user",
      emails: [{ value: "scim@empresa.com", primary: true }],
      tenantId: "tenant-acme",
    });
    expect(res.status).toBe(201);
    expect(res.body.schemas).toContain("urn:ietf:params:scim:schemas:core:2.0:User");
    expect(res.body.userName).toBe("scim.user");
    expect(res.body.active).toBe(true);
  });

  it("GET /scim/v2/Users — lista usuários SCIM", async () => {
    await request(app).post("/api/identity/scim/v2/Users").send({
      userName: "u1",
      tenantId: "tenant-acme",
    });
    const res = await request(app).get("/api/identity/scim/v2/Users?tenantId=tenant-acme");
    expect(res.status).toBe(200);
    expect(res.body.totalResults).toBeGreaterThan(0);
    expect(Array.isArray(res.body.Resources)).toBe(true);
  });

  it("PUT /scim/v2/Users/:id — atualiza usuário SCIM", async () => {
    const { body: scim } = await request(app).post("/api/identity/scim/v2/Users").send({
      userName: "u2",
      tenantId: "tenant-acme",
    });
    const res = await request(app)
      .put(`/api/identity/scim/v2/Users/${scim.id}`)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it("DELETE /scim/v2/Users/:id — desativa usuário SCIM", async () => {
    const { body: scim } = await request(app).post("/api/identity/scim/v2/Users").send({
      userName: "u3",
      tenantId: "tenant-acme",
    });
    const res = await request(app).delete(`/api/identity/scim/v2/Users/${scim.id}`);
    expect(res.status).toBe(204);
  });
});
