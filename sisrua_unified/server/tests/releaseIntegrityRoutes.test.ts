/**
 * releaseIntegrityRoutes.test.ts — Testes para rotas de Integridade de Release (16 [T1]).
 */
import request from "supertest";
import express from "express";
import releaseIntegrityRoutes from "../routes/releaseIntegrityRoutes";
import * as integrityService from "../services/releaseIntegrityService";

jest.mock("../services/releaseIntegrityService", () => ({
  ReleaseIntegrityService: {
    generateManifest: jest.fn(),
    getBuildProvenance: jest.fn(),
    verifyManifest: jest.fn(),
    signManifest: jest.fn(),
  },
}));

const { ReleaseIntegrityService } = integrityService;

const app = express();
app.use(express.json());
app.use("/api/release", releaseIntegrityRoutes);

const mockManifest = {
  version: "0.9.0",
  packageName: "sisrua-unified",
  buildTime: "2026-04-21T00:00:00.000Z",
  packageJsonHash: "abc123def456",
  artifacts: [
    {
      name: "package.json",
      relativePath: "package.json",
      sha256: "sha256packagejson",
      sizeBytes: 1024,
    },
    {
      name: "VERSION",
      relativePath: "VERSION",
      sha256: "sha256version",
      sizeBytes: 6,
    },
  ],
  signature: "hmac-sha256-abc",
};

const mockProvenance = {
  version: "0.9.0",
  packageName: "sisrua-unified",
  buildTime: "2026-04-21T00:00:00.000Z",
  nodeVersion: "v20.12.0",
  environment: "production",
  platform: "linux",
  arch: "x64",
  gitCommit: "968b495a",
  gitBranch: "dev",
};

// ─── GET /manifest ────────────────────────────────────────────────────────────

describe("GET /api/release/manifest", () => {
  it("retorna manifesto de release com artefatos e assinatura", async () => {
    (ReleaseIntegrityService.generateManifest as jest.Mock).mockReturnValue(mockManifest);
    const res = await request(app).get("/api/release/manifest");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("0.9.0");
    expect(res.body.artifacts).toHaveLength(2);
    expect(res.body.signature).toBe("hmac-sha256-abc");
  });

  it("retorna 500 em caso de erro interno", async () => {
    (ReleaseIntegrityService.generateManifest as jest.Mock).mockImplementation(() => {
      throw new Error("falha leitura");
    });
    const res = await request(app).get("/api/release/manifest");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── GET /provenance ──────────────────────────────────────────────────────────

describe("GET /api/release/provenance", () => {
  it("retorna informações de proveniência do build", async () => {
    (ReleaseIntegrityService.getBuildProvenance as jest.Mock).mockReturnValue(mockProvenance);
    const res = await request(app).get("/api/release/provenance");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("0.9.0");
    expect(res.body.gitBranch).toBe("dev");
    expect(res.body.nodeVersion).toBe("v20.12.0");
  });

  it("retorna 500 em caso de erro interno", async () => {
    (ReleaseIntegrityService.getBuildProvenance as jest.Mock).mockImplementation(() => {
      throw new Error("falha");
    });
    const res = await request(app).get("/api/release/provenance");
    expect(res.status).toBe(500);
  });
});

// ─── POST /verify ─────────────────────────────────────────────────────────────

describe("POST /api/release/verify", () => {
  it("retorna valid:true para manifesto íntegro", async () => {
    (ReleaseIntegrityService.verifyManifest as jest.Mock).mockReturnValue({
      valid: true,
      reason: "Assinatura verificada com sucesso.",
    });
    const res = await request(app)
      .post("/api/release/verify")
      .send({ manifest: mockManifest });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it("retorna 422 para manifesto adulterado", async () => {
    (ReleaseIntegrityService.verifyManifest as jest.Mock).mockReturnValue({
      valid: false,
      reason: "Assinatura inválida — possível adulteração.",
    });
    const res = await request(app)
      .post("/api/release/verify")
      .send({ manifest: { ...mockManifest, signature: "assinatura-errada" } });
    expect(res.status).toBe(422);
    expect(res.body.valid).toBe(false);
  });

  it("retorna 400 se manifesto ausente", async () => {
    const res = await request(app).post("/api/release/verify").send({});
    expect(res.status).toBe(400);
  });

  it("retorna 400 se artifacts não é array", async () => {
    const res = await request(app)
      .post("/api/release/verify")
      .send({ manifest: { ...mockManifest, artifacts: "invalid" } });
    expect(res.status).toBe(400);
  });
});
