import { vi } from "vitest";
/**
 * firestoreAndBdgdRoutes.test.ts
 *
 * Testes para:
 * - firestoreRoutes (health + quota)
 * - bdgdRoutes (layers + validate)
 */

import request from "supertest";
import express from "express";

// ─── Mocks ───────────────────────────────────────────────────────────────────
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockConfig = { useFirestore: false, DATABASE_URL: "postgres://test" };
vi.mock("../config", () => ({ config: mockConfig }));

const mockBuildReport = vi.fn();
const mockIsConformant = vi.fn();
vi.mock("../services/bdgdValidatorService", () => ({
  buildBdgdValidationReport: mockBuildReport,
  isBdgdConformant: mockIsConformant,
}));

// ─── Apps ─────────────────────────────────────────────────────────────────────
let firestoreApp: express.Application;
let bdgdApp: express.Application;

beforeAll(async () => {
  const [fMod, bMod] = await Promise.all([
    import("../routes/firestoreRoutes.js"),
    import("../routes/bdgdRoutes.js"),
  ]);

  firestoreApp = express();
  firestoreApp.use(express.json());
  firestoreApp.use("/", fMod.default);

  bdgdApp = express();
  bdgdApp.use(express.json());
  bdgdApp.use("/", bMod.default);
});

// ════════════════════════════════════════════════════════════════════════════
// FIRESTORE ROUTES
// ════════════════════════════════════════════════════════════════════════════

describe("firestoreRoutes — health", () => {
  it("GET /health — retorna disabled quando useFirestore=false", async () => {
    mockConfig.useFirestore = false;
    const res = await request(firestoreApp).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("disabled");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /health — retorna enabled quando useFirestore=true", async () => {
    mockConfig.useFirestore = true;
    const res = await request(firestoreApp).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("enabled");
  });
});

describe("firestoreRoutes — quota", () => {
  it("GET /quota — retorna status da quota", async () => {
    mockConfig.useFirestore = false;
    const res = await request(firestoreApp).get("/quota");
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /quota — retorna enabled=true quando useFirestore=true", async () => {
    mockConfig.useFirestore = true;
    const res = await request(firestoreApp).get("/quota");
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// BDGD ROUTES
// ════════════════════════════════════════════════════════════════════════════

describe("bdgdRoutes — layers", () => {
  it("GET /layers — retorna camadas BDGD", async () => {
    const res = await request(bdgdApp).get("/layers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.layers)).toBe(true);
    expect(res.body.layers.length).toBeGreaterThan(0);
    expect(res.body.layers[0].code).toBeDefined();
    expect(Array.isArray(res.body.layers[0].fields)).toBe(true);
  });
});

describe("bdgdRoutes — validate", () => {
  const sampleReport = {
    generatedAt: new Date().toISOString(),
    aneelSpec: "ANEEL-BDGD-2024",
    layers: [],
    totals: {
      layersChecked: 1,
      layersConformant: 1,
      totalRecords: 5,
      totalIssues: 0,
      errors: 0,
      warnings: 0,
    },
    conformant: true,
  };

  it("POST /validate — 400 quando layers ausente", async () => {
    const res = await request(bdgdApp).post("/validate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("POST /validate — 400 quando layers está vazio", async () => {
    const res = await request(bdgdApp).post("/validate").send({ layers: {} });
    expect(res.status).toBe(400);
  });

  it("POST /validate — 200 quando relatório é conformante", async () => {
    mockBuildReport.mockReturnValue({ ...sampleReport, conformant: true });
    mockIsConformant.mockReturnValue(true);
    const res = await request(bdgdApp)
      .post("/validate")
      .send({ layers: { SEGBT: [{ cod_id: "1", tip_unid: "MT" }] } });
    expect(res.status).toBe(200);
    expect(res.body.conformant).toBe(true);
  });

  it("POST /validate — 422 quando relatório não é conformante", async () => {
    mockBuildReport.mockReturnValue({ ...sampleReport, conformant: false });
    mockIsConformant.mockReturnValue(false);
    const res = await request(bdgdApp)
      .post("/validate")
      .send({ layers: { SEGBT: [{ cod_id: "2" }] } });
    expect(res.status).toBe(422);
    expect(res.body.conformant).toBe(false);
  });
});

describe("firestoreRoutes — catch blocks", () => {
  afterEach(() => {
    // Restore useFirestore to plain property
    Object.defineProperty(mockConfig, "useFirestore", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it("GET /health — retorna 500 quando config.useFirestore lanca erro", async () => {
    Object.defineProperty(mockConfig, "useFirestore", {
      get: () => { throw new Error("firestore config error"); },
      configurable: true,
    });
    const res = await request(firestoreApp).get("/health");
    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
  });

  it("GET /quota — retorna 500 quando config.useFirestore lanca erro", async () => {
    Object.defineProperty(mockConfig, "useFirestore", {
      get: () => { throw new Error("quota config error"); },
      configurable: true,
    });
    const res = await request(firestoreApp).get("/quota");
    expect(res.status).toBe(500);
    expect(res.body.enabled).toBe(false);
  });
});

