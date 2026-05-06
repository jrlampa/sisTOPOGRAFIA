/**
 * encryptionAtRestRoutes.test.ts — Item 75 [T1]
 */

import crypto from "crypto";
import request from "supertest";
import app from "../app.js";

describe("Encryption at Rest Routes (75)", () => {
  const customerId = `tenant-${Date.now()}`;
  const firstKey = crypto.randomBytes(32).toString("base64");
  const secondKey = crypto.randomBytes(32).toString("base64");

  describe("POST /api/encryption-at-rest/master-keys/register", () => {
    it("deve registrar master key válida", async () => {
      const res = await request(app)
        .post("/api/encryption-at-rest/master-keys/register")
        .send({ customerId, keyMaterialB64: firstKey });

      expect(res.status).toBe(201);
      expect(res.body.customerId).toBe(customerId);
      expect(res.body.version).toBe(1);
      expect(res.body.active).toBe(true);
    });

    it("deve retornar 422 ao registrar segunda key sem rotação", async () => {
      const res = await request(app)
        .post("/api/encryption-at-rest/master-keys/register")
        .send({ customerId, keyMaterialB64: crypto.randomBytes(32).toString("base64") });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/encryption-at-rest/encrypt + decrypt", () => {
    it("deve criptografar e decriptografar payload", async () => {
      const enc = await request(app).post("/api/encryption-at-rest/encrypt").send({
        customerId,
        plaintext: "payload-sensivel-123",
      });
      expect(enc.status).toBe(201);
      expect(enc.body).toHaveProperty("ciphertextB64");

      const dec = await request(app).post("/api/encryption-at-rest/decrypt").send({
        payload: enc.body,
      });
      expect(dec.status).toBe(200);
      expect(dec.body.plaintext).toBe("payload-sensivel-123");
    });
  });

  describe("POST /api/encryption-at-rest/master-keys/:customerId/rotate", () => {
    it("deve rotacionar master key do cliente", async () => {
      const rotate = await request(app)
        .post(`/api/encryption-at-rest/master-keys/${customerId}/rotate`)
        .send({ keyMaterialB64: secondKey });
      expect(rotate.status).toBe(201);
      expect(rotate.body.version).toBe(2);
      expect(rotate.body.active).toBe(true);
      expect(rotate.body.rotatedFromKeyId).toContain("v1");
    });

    it("deve listar versões de key com apenas uma ativa", async () => {
      const list = await request(app).get(`/api/encryption-at-rest/master-keys/${customerId}`);
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.length).toBeGreaterThanOrEqual(2);

      const active = list.body.filter((k: { active: boolean }) => k.active);
      expect(active.length).toBe(1);
      expect(active[0].version).toBe(2);
    });
  });

  describe("validações", () => {
    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/encryption-at-rest/master-keys/register")
        .send({ customerId: "", keyMaterialB64: "x" });
      expect(res.status).toBe(400);
    });

    it("deve retornar 422 para decrypt com payload inconsistente", async () => {
      const res = await request(app)
        .post("/api/encryption-at-rest/decrypt")
        .send({
          payload: {
            customerId,
            keyId: "cmk-ghost",
            algorithm: "aes-256-gcm",
            ivB64: "AA==",
            authTagB64: "AA==",
            ciphertextB64: "AA==",
            aadB64: null,
            encryptedAt: new Date().toISOString(),
          },
        });
      expect(res.status).toBe(422);
    });
  });
});
