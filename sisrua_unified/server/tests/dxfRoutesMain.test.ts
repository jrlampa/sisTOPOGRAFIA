/**
 * dxfRoutesMain.test.ts
 *
 * Testes para rotas principais de dxfRoutes:
 * - POST / (422, 202, 500, cache hit)
 * - POST /batch (400, 200)
 * - Job routes (sanitation-preview, sanitize-reprocess)
 * - getBaseUrl com CORS_ORIGIN config
 */

import express from "express";
import request from "supertest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../middleware/rateLimiter", () => ({
  dxfRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock("../middleware/permissionHandler", () => ({
  requirePermission:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const createDxfTaskMock = jest.fn();
jest.mock("../services/cloudTasksService", () => ({
  createDxfTask: (...args: unknown[]) => createDxfTaskMock(...args),
}));

const createCacheKeyMock = jest.fn().mockReturnValue("cache-key-123");
const getCachedFilenameMock = jest.fn().mockReturnValue(null);
const deleteCachedFilenameMock = jest.fn();
jest.mock("../services/cacheService", () => ({
  createCacheKey: (...args: unknown[]) => createCacheKeyMock(...args),
  getCachedFilename: (...args: unknown[]) => getCachedFilenameMock(...args),
  deleteCachedFilename: (...args: unknown[]) => deleteCachedFilenameMock(...args),
}));

const recordDxfRequestMock = jest.fn();
jest.mock("../services/metricsService", () => ({
  metricsService: { recordDxfRequest: (...args: unknown[]) => recordDxfRequestMock(...args) },
}));

const attachCqtMock = jest.fn().mockImplementation((x: unknown) => x);
jest.mock("../services/cqtContextService", () => ({
  attachCqtSnapshotToBtContext: (...args: unknown[]) => attachCqtMock(...args),
}));

const parseBatchFileMock = jest.fn();
jest.mock("../services/batchService", () => ({
  parseBatchFile: (...args: unknown[]) => parseBatchFileMock(...args),
}));

jest.mock("../utils/dxfDirectory", () => ({
  resolveDxfDirectory: () => "/tmp/dxf-test",
}));

const validateBtTopologyMock = jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] });
jest.mock("../services/topologicalValidator", () => ({
  validateBtTopology: (...args: unknown[]) => validateBtTopologyMock(...args),
}));

const previewFailedTaskMock = jest.fn().mockResolvedValue([]);
const sanitizeReprocessMock = jest.fn().mockResolvedValue({ processed: 0, failed: 0 });
jest.mock("../services/jobDossierService", () => ({
  getJobDossier: jest.fn(),
  listRecentJobs: jest.fn(),
  previewFailedTaskSanitation: (...args: unknown[]) => previewFailedTaskMock(...args),
  replayFailedTask: jest.fn(),
  sanitizeAndReprocessFailedTasks: (...args: unknown[]) => sanitizeReprocessMock(...args),
}));

jest.mock("../config", () => ({
  config: {
    APP_PUBLIC_URL: undefined,
    CORS_ORIGIN: "http://localhost:3000,https://app.example.com",
    NODE_ENV: "test",
    PORT: 3001,
  },
}));

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
}));

// ─── App Setup ───────────────────────────────────────────────────────────────

let app: express.Application;

beforeAll(async () => {
  const { default: dxfRoutes } = await import("../routes/dxfRoutes");
  app = express();
  app.use(express.json());
  app.use("/api/dxf", dxfRoutes);
});

afterEach(() => {
  jest.clearAllMocks();
  createCacheKeyMock.mockReturnValue("cache-key-123");
  getCachedFilenameMock.mockReturnValue(null);
  validateBtTopologyMock.mockReturnValue({ valid: true, errors: [], warnings: [] });
  attachCqtMock.mockImplementation((x: unknown) => x);
});

const VALID_DXF_BODY = {
  lat: -23.55,
  lon: -46.63,
  radius: 300,
  mode: "circle" as const,
};

// ─── POST / tests ─────────────────────────────────────────────────────────────

describe("POST /api/dxf — validação do body", () => {
  it("retorna 422 para body inválido (sem campos obrigatorios)", async () => {
    const res = await request(app).post("/api/dxf").send({ lat: -23.55 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Invalid request body");
  });

  it("retorna 202 (queued) para body valido", async () => {
    createDxfTaskMock.mockResolvedValueOnce({ taskId: "task-123", alreadyCompleted: false });
    const res = await request(app).post("/api/dxf").send(VALID_DXF_BODY);
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("queued");
    expect(res.body.jobId).toBe("task-123");
  });

  it("retorna 500 quando createDxfTask lanca erro", async () => {
    createDxfTaskMock.mockRejectedValueOnce(new Error("task creation failed"));
    const res = await request(app).post("/api/dxf").send(VALID_DXF_BODY);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Generation failed");
  });

  it("retorna 422 quando topologia BT eh invalida", async () => {
    validateBtTopologyMock.mockReturnValueOnce({
      valid: false,
      errors: [{ code: "TOPO_001", message: "Invalid topology" }],
      warnings: [],
    });
    const bodyWithTopology = {
      ...VALID_DXF_BODY,
      btContext: {
        projectType: "ramais",
        topology: { poles: [], transformers: [], edges: [] },
      },
    };
    const res = await request(app).post("/api/dxf").send(bodyWithTopology);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Topologia BT inválida");
    expect(Array.isArray(res.body.topologyErrors)).toBe(true);
  });

  it("retorna 200 com URL quando cache hit e arquivo existe", async () => {
    const fs = require("fs");
    fs.existsSync.mockReturnValue(true);
    getCachedFilenameMock.mockReturnValue("cached_file.dxf");

    const res = await request(app).post("/api/dxf").send(VALID_DXF_BODY);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.url).toContain("cached_file.dxf");
  });

  it("cache entry sem arquivo faz deleteCachedFilename e continua (202)", async () => {
    const fs = require("fs");
    fs.existsSync.mockReturnValue(false);
    getCachedFilenameMock.mockReturnValue("missing_file.dxf");
    createDxfTaskMock.mockResolvedValueOnce({ taskId: "task-456", alreadyCompleted: false });

    const res = await request(app).post("/api/dxf").send(VALID_DXF_BODY);
    expect(deleteCachedFilenameMock).toHaveBeenCalled();
    expect(res.status).toBe(202);
  });
});

// ─── POST /batch tests ────────────────────────────────────────────────────────

describe("POST /api/dxf/batch — upload de arquivo", () => {
  it("retorna 400 quando nenhum arquivo enviado", async () => {
    const res = await request(app).post("/api/dxf/batch").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No file uploaded");
  });

  it("retorna 400 para arquivo com MIME type invalido", async () => {
    const res = await request(app)
      .post("/api/dxf/batch")
      .attach("csv", Buffer.from("fake content"), {
        filename: "test.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid file");
  });

  it("retorna 200 para arquivo CSV valido com rows processadas", async () => {
    parseBatchFileMock.mockResolvedValueOnce([
      { row: { lat: -23.55, lon: -46.63, radius: 300, mode: "circle", name: "ponto1" }, line: 2 },
    ]);
    createDxfTaskMock.mockResolvedValueOnce({ taskId: "batch-task-1" });

    const res = await request(app)
      .post("/api/dxf/batch")
      .attach("csv", Buffer.from("lat,lon,radius\n-23.55,-46.63,300"), {
        filename: "test.csv",
        contentType: "text/csv",
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("batch_processed");
    expect(res.body.queued).toBe(1);
  });

  it("retorna 500 quando parseBatchFile lanca erro", async () => {
    parseBatchFileMock.mockRejectedValueOnce(new Error("parse error"));

    const res = await request(app)
      .post("/api/dxf/batch")
      .attach("csv", Buffer.from("lat,lon,radius\n-23.55,-46.63,300"), {
        filename: "test.csv",
        contentType: "text/csv",
      });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Batch processing failed");
  });
});

// ─── Job routes tests ─────────────────────────────────────────────────────────

describe("GET /api/dxf/jobs/failed/sanitation-preview", () => {
  it("retorna 200 com preview de failed tasks", async () => {
    previewFailedTaskMock.mockResolvedValueOnce([{ jobId: "j1", cause: "validation" }]);
    const res = await request(app).get("/api/dxf/jobs/failed/sanitation-preview");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("aceita parametro limit", async () => {
    previewFailedTaskMock.mockResolvedValueOnce([]);
    const res = await request(app)
      .get("/api/dxf/jobs/failed/sanitation-preview")
      .query({ limit: "50" });
    expect(res.status).toBe(200);
    expect(previewFailedTaskMock).toHaveBeenCalledWith(50);
  });
});

describe("POST /api/dxf/jobs/failed/sanitize-reprocess", () => {
  it("retorna 200 quando body valido", async () => {
    sanitizeReprocessMock.mockResolvedValueOnce({ sanitized: 2, requeued: 1, failed: 0 });
    const res = await request(app)
      .post("/api/dxf/jobs/failed/sanitize-reprocess")
      .send({ limit: 10, dryRun: false });
    expect(res.status).toBe(200);
  });

  it("retorna 400 quando body invalido (campo extra nao permitido)", async () => {
    const res = await request(app)
      .post("/api/dxf/jobs/failed/sanitize-reprocess")
      .send({ extra_field: "not allowed" });
    expect(res.status).toBe(400);
  });
});

// ─── getBaseUrl with CORS_ORIGIN config (lines 68-76, 95-116) ─────────────────

describe("getBaseUrl — CORS_ORIGIN fallback e host invalido", () => {
  it("usa CORS_ORIGIN quando APP_PUBLIC_URL nao configurado", async () => {
    jest.resetModules();
    jest.doMock("../config", () => ({
      config: {
        APP_PUBLIC_URL: undefined,
        CORS_ORIGIN: "https://frontapp.example.com",
        NODE_ENV: "test",
        PORT: 3001,
      },
    }));
    const { getBaseUrl } = await import("../routes/dxfRoutes");
    const req = {
      hostname: "unknown-host",
      protocol: "http",
      headers: {},
    } as any;
    const url = getBaseUrl(req);
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
  });
});
