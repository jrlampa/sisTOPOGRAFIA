/**
 * Tests for btCalculationRoutes (E6-H1)
 * Tests feature flag, input validation, and route contracts.
 */

import request from "supertest";
import express from "express";
import { vi } from "vitest";

// Mock logger
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config to control feature flag
const mockConfig = { btRadialEnabled: false };
vi.mock("../config", () => ({
  get config() {
    return mockConfig;
  },
}));

// Mock btRadialCalculationService
const calculateMock = vi.fn();
const BtRadialValidationErrorMock = class extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BtRadialValidationError";
  }
};
vi.mock("../services/btRadialCalculationService", () => ({
  calculateBtRadial: calculateMock,
  BtRadialValidationError: BtRadialValidationErrorMock,
}));

// Mock btCatalogService
vi.mock("../services/btCatalogService", () => ({
  getBtCatalog: vi.fn(() => ({
    conductors: [],
    transformers: [],
    version: { version: "1.0.0", checksum: "abc", definedAt: "2026-01-01" },
  })),
  getCatalogVersion: vi.fn(() => ({
    version: "1.0.0",
    checksum: "abc",
    definedAt: "2026-01-01",
  })),
}));

// Mock btParityService
// Mock btTelescopicAnalysis
const analyzeTelescopicPathsMock = vi.fn();
vi.mock("../services/bt/btTelescopicAnalysis", () => ({
  analyzeTelescopicPaths: (...args: unknown[]) =>
    analyzeTelescopicPathsMock(...args),
}));

vi.mock("../services/btParityService", () => ({
  runBtParitySuite: vi.fn(() => ({
    generatedAt: "2026-04-09T00:00:00.000Z",
    tolerance: 1e-4,
    scenarios: [],
    totals: {
      total: 0,
      pass: 0,
      warn: 0,
      fail: 0,
      p0Pass: 0,
      p0Fail: 0,
      p1Pass: 0,
      p1Fail: 0,
      p2Pass: 0,
      p2Fail: 0,
    },
    p0Gate: true,
  })),
  listBtParityScenarios: vi.fn(() => [{ id: "A1" }, { id: "B2" }]),
}));

let btCalculationRoutes: typeof import("../routes/btCalculationRoutes.js").default;

beforeAll(async () => {
  const mod = await import("../routes/btCalculationRoutes.js");
  btCalculationRoutes = mod.default;
});

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/", btCalculationRoutes);
  return app;
};

// ─── valid request body ───────────────────────────────────────────────────────

const validBody = () => ({
  transformer: {
    id: "TR225",
    rootNodeId: "R",
    kva: 225,
    zPercent: 0.035,
    qtMt: 0.0183,
  },
  nodes: [
    { id: "R", load: { localDemandKva: 0 } },
    { id: "A", load: { localDemandKva: 10 } },
  ],
  edges: [
    {
      fromNodeId: "R",
      toNodeId: "A",
      conductorId: "95 Al - Arm",
      lengthMeters: 50,
    },
  ],
  phase: "TRI",
});

const mockCalculationResult = () => ({
  qtTrafo: 0.035,
  nodeResults: [],
  terminalResults: [],
  worstCase: {
    worstTerminalNodeId: "A",
    cqtGlobal: 0.035,
    criticalPath: ["R", "A"],
    qtTrafo: 0.035,
  },
  totalDemandKva: 10,
  consistencyAlerts: [],
});

// ─── Feature flag OFF ─────────────────────────────────────────────────────────

describe("btCalculationRoutes – feature flag OFF (E6-H1)", () => {
  beforeEach(() => {
    mockConfig.btRadialEnabled = false;
  });

  it("POST /calculate returns 404 when flag is off", async () => {
    const app = buildApp();
    const res = await request(app).post("/calculate").send(validBody());
    expect(res.status).toBe(404);
  });

  it("GET /catalog returns 200 regardless of flag", async () => {
    const app = buildApp();
    const res = await request(app).get("/catalog");
    expect(res.status).toBe(200);
  });

  it("GET /parity returns 200 regardless of flag", async () => {
    const app = buildApp();
    const res = await request(app).get("/parity");
    expect(res.status).toBe(200);
  });
});

// ─── Feature flag ON ──────────────────────────────────────────────────────────

describe("btCalculationRoutes – feature flag ON (E6-H1)", () => {
  beforeEach(() => {
    mockConfig.btRadialEnabled = true;
    calculateMock.mockReturnValue(mockCalculationResult());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /calculate returns 200 with valid body", async () => {
    const app = buildApp();
    const res = await request(app).post("/calculate").send(validBody());
    expect(res.status).toBe(200);
  });

  it("POST /calculate returns the calculation result", async () => {
    const app = buildApp();
    const res = await request(app).post("/calculate").send(validBody());
    expect(res.body.qtTrafo).toBeDefined();
    expect(res.body.worstCase).toBeDefined();
  });

  it("POST /calculate returns 400 for missing transformer", async () => {
    const app = buildApp();
    const body = { ...validBody() };
    delete (body as Partial<typeof body>).transformer;
    const res = await request(app).post("/calculate").send(body);
    expect(res.status).toBe(400);
  });

  it("POST /calculate returns 400 for missing nodes", async () => {
    const app = buildApp();
    const body = { ...validBody(), nodes: [] };
    const res = await request(app).post("/calculate").send(body);
    expect(res.status).toBe(400);
  });

  it("POST /calculate returns 400 for invalid phase", async () => {
    const app = buildApp();
    const body = { ...validBody(), phase: "INVALID" };
    const res = await request(app).post("/calculate").send(body);
    expect(res.status).toBe(400);
  });

  it("POST /calculate returns 422 for topology validation error", async () => {
    calculateMock.mockImplementationOnce(() => {
      throw new BtRadialValidationErrorMock("CYCLE_DETECTED", "Cycle detected");
    });
    const app = buildApp();
    const res = await request(app).post("/calculate").send(validBody());
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CYCLE_DETECTED");
  });

  it("POST /calculate returns 500 on unexpected error", async () => {
    calculateMock.mockImplementationOnce(() => {
      throw new Error("Unexpected failure");
    });
    const app = buildApp();
    const res = await request(app).post("/calculate").send(validBody());
    expect(res.status).toBe(500);
  });
});

// ─── Catalog endpoints ────────────────────────────────────────────────────────

describe("btCalculationRoutes – catalog endpoints", () => {
  it("GET /catalog returns conductor and transformer arrays", async () => {
    mockConfig.btRadialEnabled = false;
    const app = buildApp();
    const res = await request(app).get("/catalog");
    expect(res.status).toBe(200);
    expect(res.body.conductors).toBeDefined();
    expect(res.body.transformers).toBeDefined();
    expect(res.body.version).toBeDefined();
  });

  it("GET /catalog/version returns version object", async () => {
    const app = buildApp();
    const res = await request(app).get("/catalog/version");
    expect(res.status).toBe(200);
    expect(res.body.version).toBeDefined();
    expect(res.body.checksum).toBeDefined();
  });
});

// ─── Parity endpoints ─────────────────────────────────────────────────────────

describe("btCalculationRoutes – parity endpoints", () => {
  it("GET /parity returns report with p0Gate", async () => {
    mockConfig.btRadialEnabled = false;
    const app = buildApp();
    const res = await request(app).get("/parity");
    expect(res.status).toBe(200);
    expect(typeof res.body.p0Gate).toBe("boolean");
  });

  it("GET /parity/scenarios returns paginated list payload with meta", async () => {
    const app = buildApp();
    const res = await request(app).get(
      "/parity/scenarios?search=b&sortOrder=desc",
    );
    expect(res.status).toBe(200);
    expect(res.body.scenarios).toEqual([{ id: "B2" }]);
    expect(res.body.meta.filters.search).toBe("b");
  });
});

// ─── Additional coverage tests ────────────────────────────────────────────────

describe("btCalculationRoutes – catalog 400 paths", () => {
  it("GET /catalog returns 400 for unexpected query params", async () => {
    const app = buildApp();
    const res = await request(app).get("/catalog?unexpected=true");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid query parameters");
  });

  it("GET /catalog/version returns 400 for unexpected query params", async () => {
    const app = buildApp();
    const res = await request(app).get("/catalog/version?foo=bar");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid query parameters");
  });
});

describe("btCalculationRoutes – parity 400/500 paths", () => {
  it("GET /parity returns 400 for unexpected query params", async () => {
    const app = buildApp();
    const res = await request(app).get("/parity?unexpected=true");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid query parameters");
  });

  it("GET /parity returns 500 when runBtParitySuite throws", async () => {
    const { runBtParitySuite } = await import("../services/btParityService.js");
    (runBtParitySuite as vi.Mock).mockImplementationOnce(() => {
      throw new Error("parity suite internal error");
    });
    const app = buildApp();
    const res = await request(app).get("/parity");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Parity suite execution failed");
  });

  it("GET /parity/scenarios returns 400 for invalid query params", async () => {
    const app = buildApp();
    const res = await request(app).get("/parity/scenarios?page=not-a-number");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid query parameters");
  });

  it("GET /parity/scenarios sorts descending by id", async () => {
    const app = buildApp();
    const res = await request(app).get("/parity/scenarios?sortOrder=desc");
    expect(res.status).toBe(200);
    expect(res.body.scenarios[0].id).toBe("B2");
  });
});

describe("btCalculationRoutes – POST /telescopic-analysis", () => {
  it("returns 400 for invalid body", async () => {
    mockConfig.btRadialEnabled = true;
    const app = buildApp();
    const res = await request(app)
      .post("/telescopic-analysis")
      .send({ invalid: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Payload inv\u00e1lido");
  });

  it("returns 200 with telescopic analysis result", async () => {
    mockConfig.btRadialEnabled = true;
    calculateMock.mockReturnValueOnce({
      qtTrafo: 0.035,
      nodeResults: [],
      terminalResults: [],
      totalDemandKva: 10,
    });
    analyzeTelescopicPathsMock.mockReturnValueOnce({
      suggestions: [],
      lmaxByConductor: {},
    });
    const app = buildApp();
    const res = await request(app)
      .post("/telescopic-analysis")
      .send(validBody());
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toBeDefined();
  });

  it("returns 422 for BtRadialValidationError", async () => {
    mockConfig.btRadialEnabled = true;
    calculateMock.mockImplementationOnce(() => {
      throw new BtRadialValidationErrorMock(
        "DISCONNECTED_GRAPH",
        "Disconnected",
      );
    });
    const app = buildApp();
    const res = await request(app)
      .post("/telescopic-analysis")
      .send(validBody());
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("DISCONNECTED_GRAPH");
  });

  it("returns 500 for unexpected error", async () => {
    mockConfig.btRadialEnabled = true;
    calculateMock.mockImplementationOnce(() => {
      throw new Error("unexpected");
    });
    const app = buildApp();
    const res = await request(app)
      .post("/telescopic-analysis")
      .send(validBody());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Erro interno de c\u00e1lculo");
  });
});

