import request from "supertest";
import app from "../app.js";
import { GisHardeningService } from "../services/gisHardeningService.js";

const BASE = "/api/gis-hardening";

beforeEach(() => GisHardeningService._reset());

describe("gisHardeningRoutes", () => {
  it("POST /perfis cria perfil", async () => {
    const res = await request(app)
      .post(`${BASE}/perfis`)
      .send({
        tenantId: "t1",
        ambiente: "prod",
        mtlsObrigatorio: true,
        certFingerprint: "CERT-FINGERPRINT-12345",
        provedorSegredo: "vault",
        rolesPermitidas: ["admin", "ops"],
        rotateDays: 30,
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("gh-1");
  });

  it("GET /perfis filtra por tenant", async () => {
    await request(app)
      .post(`${BASE}/perfis`)
      .send({
        tenantId: "t1",
        ambiente: "prod",
        mtlsObrigatorio: true,
        certFingerprint: "CERT-FINGERPRINT-12345",
        provedorSegredo: "vault",
        rolesPermitidas: ["admin"],
        rotateDays: 30,
      });
    await request(app)
      .post(`${BASE}/perfis`)
      .send({
        tenantId: "t2",
        ambiente: "prod",
        mtlsObrigatorio: true,
        certFingerprint: "CERT-FINGERPRINT-54321",
        provedorSegredo: "vault",
        rolesPermitidas: ["admin"],
        rotateDays: 30,
      });
    const res = await request(app).get(`${BASE}/perfis?tenantId=t1`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /perfis/:id/validar-handshake retorna autorizado quando fingerprint confere", async () => {
    await request(app)
      .post(`${BASE}/perfis`)
      .send({
        tenantId: "t1",
        ambiente: "prod",
        mtlsObrigatorio: true,
        certFingerprint: "CERT-FINGERPRINT-12345",
        provedorSegredo: "vault",
        rolesPermitidas: ["admin"],
        rotateDays: 30,
      });
    const res = await request(app)
      .post(`${BASE}/perfis/gh-1/validar-handshake`)
      .send({ certFingerprintRecebido: "CERT-FINGERPRINT-12345" });
    expect(res.status).toBe(200);
    expect(res.body.autorizado).toBe(true);
  });

  it("POST /perfis/:id/validar-handshake nega quando fingerprint diverge", async () => {
    await request(app)
      .post(`${BASE}/perfis`)
      .send({
        tenantId: "t1",
        ambiente: "prod",
        mtlsObrigatorio: true,
        certFingerprint: "CERT-FINGERPRINT-12345",
        provedorSegredo: "vault",
        rolesPermitidas: ["admin"],
        rotateDays: 30,
      });
    const res = await request(app)
      .post(`${BASE}/perfis/gh-1/validar-handshake`)
      .send({ certFingerprintRecebido: "CERT-FINGERPRINT-99999" });
    expect(res.status).toBe(200);
    expect(res.body.autorizado).toBe(false);
  });

  it("POST /perfis/:id/eventos registra evento", async () => {
    await request(app)
      .post(`${BASE}/perfis`)
      .send({
        tenantId: "t1",
        ambiente: "prod",
        mtlsObrigatorio: true,
        certFingerprint: "CERT-FINGERPRINT-12345",
        provedorSegredo: "vault",
        rolesPermitidas: ["admin"],
        rotateDays: 30,
      });
    const res = await request(app)
      .post(`${BASE}/perfis/gh-1/eventos`)
      .send({
        tipo: "policy_violation",
        severidade: "alta",
        descricao: "Tentativa de acesso fora de role",
      });
    expect(res.status).toBe(201);
    expect(res.body.hashEvento).toMatch(/^[a-f0-9]{64}$/);
  });

  it("POST /perfis/:id/rotacionar-segredo rotaciona segredo", async () => {
    await request(app)
      .post(`${BASE}/perfis`)
      .send({
        tenantId: "t1",
        ambiente: "prod",
        mtlsObrigatorio: true,
        certFingerprint: "CERT-FINGERPRINT-12345",
        provedorSegredo: "vault",
        rolesPermitidas: ["admin"],
        rotateDays: 30,
      });
    const res = await request(app).post(
      `${BASE}/perfis/gh-1/rotacionar-segredo`,
    );
    expect(res.status).toBe(200);
    expect(res.body.ultimoRotateEm).toBeDefined();
  });

  it("GET /tipos-evento retorna catálogo", async () => {
    const res = await request(app).get(`${BASE}/tipos-evento`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("handshake_ok");
  });
});
