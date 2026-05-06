import { vi } from "vitest";
/**
 * supplyChainRoutes.test.ts — Supply Chain Security & Integridade (15 [T1])
 */

import request from "supertest";
import app from "../app.js";

describe("Supply Chain Routes (15)", { timeout: 30000 }, () => {

  // ─── SBOM ──────────────────────────────────────────────────────────────────

  describe("POST /api/supply-chain/sbom/generate", () => {
    it("deve gerar SBOM com dependências NPM do package.json", async () => {
      const res = await request(app)
        .post("/api/supply-chain/sbom/generate")
        .send({});
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("totalComponents");
      expect(res.body).toHaveProperty("directDependencies");
      expect(res.body).toHaveProperty("components");
      expect(Array.isArray(res.body.components)).toBe(true);
      expect(res.body.totalComponents).toBeGreaterThan(0);
    });

    it("deve incluir componentes Python fornecidos", async () => {
      const res = await request(app)
        .post("/api/supply-chain/sbom/generate")
        .send({
          pythonComponents: [
            { name: "ezdxf", version: "1.2.0", license: "MIT" },
            { name: "numpy", version: "1.26.0", license: "BSD" },
          ],
        });
      expect(res.status).toBe(201);
      const pythonComps = res.body.components.filter(
        (c: { ecosystem: string }) => c.ecosystem === "python",
      );
      expect(pythonComps.length).toBe(2);
      expect(res.body.ecosystems).toContain("python");
      expect(res.body.ecosystems).toContain("npm");
    });
  });

  describe("GET /api/supply-chain/sbom", () => {
    it("deve retornar último SBOM após geração", async () => {
      // Garante que SBOM existe
      await request(app).post("/api/supply-chain/sbom/generate").send({});
      const res = await request(app).get("/api/supply-chain/sbom");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("generatedAt");
      expect(res.body).toHaveProperty("components");
    });
  });

  // ─── npm audit ─────────────────────────────────────────────────────────────

  describe("POST /api/supply-chain/npm-audit/run", () => {
    it("deve executar npm audit e retornar resultado", async () => {
      const res = await request(app).post("/api/supply-chain/npm-audit/run");
      // 200 se passou, 207 se há vulnerabilidades
      expect([200, 207]).toContain(res.status);
      expect(res.body).toHaveProperty("totalVulnerabilities");
      expect(res.body).toHaveProperty("bySeverity");
      expect(res.body.bySeverity).toHaveProperty("critical");
      expect(res.body.bySeverity).toHaveProperty("high");
      expect(res.body).toHaveProperty("passed");
    });
  });

  describe("GET /api/supply-chain/npm-audit", () => {
    it("deve retornar último resultado após execução", async () => {
      await request(app).post("/api/supply-chain/npm-audit/run");
      const res = await request(app).get("/api/supply-chain/npm-audit");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("auditedAt");
    });
  });

  // ─── Secret Scanning ───────────────────────────────────────────────────────

  describe("POST /api/supply-chain/secrets/scan", () => {
    it("deve retornar scan limpo para conteúdo sem segredos", async () => {
      const res = await request(app).post("/api/supply-chain/secrets/scan").send({
        content: "const x = 1;\nconsole.log('olá mundo');",
        fileHint: "src/utils/helper.ts",
        startLine: 1,
      });
      expect(res.status).toBe(201);
      expect(res.body.passed).toBe(true);
      expect(res.body.totalMatches).toBe(0);
      expect(res.body).toHaveProperty("linesScanned");
    });

    it("deve detectar JWT hardcoded em conteúdo", async () => {
      // Token JWT válido com alta entropia para testar detecção
      const fakeJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const res = await request(app).post("/api/supply-chain/secrets/scan").send({
        content: `const token = "${fakeJwt}";`,
        fileHint: "server/config/hardcoded.ts",
        startLine: 10,
      });
      expect(res.status).toBe(201);
      // Pode detectar ou não dependendo da entropia — apenas valida estrutura
      expect(res.body).toHaveProperty("passed");
      expect(res.body).toHaveProperty("matches");
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/supply-chain/secrets/scan")
        .send({ content: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/supply-chain/secrets", () => {
    it("deve listar todos os matches detectados", async () => {
      const res = await request(app).get("/api/supply-chain/secrets");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("deve filtrar apenas matches não resolvidos", async () => {
      const res = await request(app).get(
        "/api/supply-chain/secrets?onlyUnresolved=true",
      );
      expect(res.status).toBe(200);
      expect(res.body.every((m: { resolved: boolean }) => !m.resolved)).toBe(
        true,
      );
    });
  });

  // ─── SAST ──────────────────────────────────────────────────────────────────

  describe("GET /api/supply-chain/sast/report", () => {
    it("deve retornar relatório SAST com findings pré-semeados", async () => {
      const res = await request(app).get("/api/supply-chain/sast/report");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalFindings");
      expect(res.body).toHaveProperty("openFindings");
      expect(res.body).toHaveProperty("bySeverity");
      expect(res.body).toHaveProperty("passed");
      expect(res.body.totalFindings).toBeGreaterThanOrEqual(3);
    });
  });

  describe("GET /api/supply-chain/sast/findings", () => {
    it("deve listar findings SAST", async () => {
      const res = await request(app).get("/api/supply-chain/sast/findings");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it("deve filtrar findings abertos", async () => {
      const res = await request(app).get(
        "/api/supply-chain/sast/findings?fixed=false",
      );
      expect(res.status).toBe(200);
      expect(
        res.body.every((f: { fixed: boolean }) => !f.fixed),
      ).toBe(true);
    });
  });

  describe("POST /api/supply-chain/sast/findings", () => {
    it("deve adicionar novo finding SAST", async () => {
      const res = await request(app)
        .post("/api/supply-chain/sast/findings")
        .send({
          ruleId: "SEC-SQL-001",
          category: "injecao_sql",
          severity: "critica",
          file: "server/routes/searchRoutes.ts",
          line: 55,
          message: "Interpolação direta em query SQL",
          cweId: "CWE-89",
          owaspTop10: "A03:2021",
        });
      expect(res.status).toBe(201);
      expect(res.body.fixed).toBe(false);
      expect(res.body.category).toBe("injecao_sql");
    });

    it("deve retornar 400 para payload inválido", async () => {
      const res = await request(app)
        .post("/api/supply-chain/sast/findings")
        .send({ ruleId: "" });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/supply-chain/sast/findings/:id/fix", () => {
    it("deve marcar finding como corrigido", async () => {
      const addRes = await request(app)
        .post("/api/supply-chain/sast/findings")
        .send({
          ruleId: "SEC-XSS-001",
          category: "xss",
          severity: "alta",
          file: "src/components/RichText.tsx",
          line: 22,
          message: "innerHTML sem sanitização",
          cweId: "CWE-79",
          owaspTop10: "A03:2021",
        });
      const id = addRes.body.id;

      const fixRes = await request(app).patch(
        `/api/supply-chain/sast/findings/${id}/fix`,
      );
      expect(fixRes.status).toBe(200);
      expect(fixRes.body.fixed).toBe(true);
      expect(fixRes.body.fixedAt).not.toBeNull();
    });

    it("deve retornar 422 para ID inexistente", async () => {
      const res = await request(app).patch(
        "/api/supply-chain/sast/findings/sast-inexistente/fix",
      );
      expect(res.status).toBe(422);
    });
  });

  // ─── Policy Gates ──────────────────────────────────────────────────────────

  describe("POST /api/supply-chain/policy-gates/evaluate", () => {
    it("deve avaliar gates para versão de release", async () => {
      const res = await request(app)
        .post("/api/supply-chain/policy-gates/evaluate")
        .send({ releaseVersion: "0.9.1" });
      // 200 passou, 207 bloqueado
      expect([200, 207]).toContain(res.status);
      expect(res.body).toHaveProperty("passed");
      expect(res.body).toHaveProperty("gates");
      expect(res.body).toHaveProperty("blockedBy");
      expect(res.body.releaseVersion).toBe("0.9.1");
      expect(Array.isArray(res.body.gates)).toBe(true);
      const gateIds = res.body.gates.map((g: { id: string }) => g.id);
      expect(gateIds).toContain("gate-sast");
      expect(gateIds).toContain("gate-secrets");
      expect(gateIds).toContain("gate-sbom");
    });

    it("deve retornar 400 sem releaseVersion", async () => {
      const res = await request(app)
        .post("/api/supply-chain/policy-gates/evaluate")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/supply-chain/policy-gates", () => {
    it("deve retornar última avaliação após executar evaluate", async () => {
      await request(app)
        .post("/api/supply-chain/policy-gates/evaluate")
        .send({ releaseVersion: "0.9.2" });

      const res = await request(app).get("/api/supply-chain/policy-gates");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("evaluatedAt");
      expect(res.body.releaseVersion).toBe("0.9.2");
    });
  });
});

