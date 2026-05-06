import request from "supertest";
import express from "express";
import { vi } from "vitest";

// Mock logger before route import
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock btDerivedService so route tests remain pure contract tests
const computeMock = vi.fn();
vi.mock("../services/btDerivedService", () => ({
  computeBtDerivedState: computeMock,
}));

let btDerivedRoutes: typeof import("../routes/btDerivedRoutes.js").default;

beforeAll(async () => {
  const mod = await import("../routes/btDerivedRoutes.js");
  btDerivedRoutes = mod.default;
});

// ─── minimal valid request body ──────────────────────────────────────────────

const minimalBody = () => ({
  projectType: "geral",
  topology: {
    poles: [{ id: "p1", lat: -23.5, lng: -46.6 }],
    transformers: [{ id: "tr1", poleId: "p1", demandKw: 10, readings: [] }],
    edges: [],
  },
});

const mockDerivedResponse = () => ({
  summary: {
    poles: 1,
    transformers: 1,
    edges: 0,
    totalLengthMeters: 0,
    transformerDemandKw: 10,
  },
  pointDemandKva: 0,
  criticalPoleId: null,
  accumulatedByPole: [],
  estimatedByTransformer: [],
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/bt", btDerivedRoutes);
  return app;
}

// ─── happy path ───────────────────────────────────────────────────────────────

describe("POST /api/bt/derived – happy path", () => {
  let app: express.Application;

  beforeEach(() => {
    computeMock.mockReset();
    computeMock.mockReturnValue(mockDerivedResponse());
    app = buildApp();
  });

  it("returns 200 with BtDerivedResponse structure", async () => {
    const res = await request(app).post("/api/bt/derived").send(minimalBody());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("accumulatedByPole");
    expect(res.body).toHaveProperty("estimatedByTransformer");
    expect(res.body).toHaveProperty("criticalPoleId");
    expect(res.body).toHaveProperty("pointDemandKva");
  });

  it("calls computeBtDerivedState with correct arguments", async () => {
    await request(app).post("/api/bt/derived").send(minimalBody());
    expect(computeMock).toHaveBeenCalledTimes(1);
    const [topology, projectType, clandestinoAreaM2] = (
      computeMock as vi.MockedFunction<typeof computeMock>
    ).mock.calls[0];
    expect(projectType).toBe("geral");
    expect(clandestinoAreaM2).toBe(0);
    expect((topology as { poles: unknown[] }).poles).toHaveLength(1);
  });

  it("defaults clandestinoAreaM2 to 0 when not provided", async () => {
    await request(app).post("/api/bt/derived").send(minimalBody());
    const [, , clandestinoAreaM2] = (
      computeMock as vi.MockedFunction<typeof computeMock>
    ).mock.calls[0];
    expect(clandestinoAreaM2).toBe(0);
  });

  it("passes clandestinoAreaM2 when provided", async () => {
    const body = { ...minimalBody(), clandestinoAreaM2: 120 };
    await request(app).post("/api/bt/derived").send(body);
    const [, , clandestinoAreaM2] = (
      computeMock as vi.MockedFunction<typeof computeMock>
    ).mock.calls[0];
    expect(clandestinoAreaM2).toBe(120);
  });

  it("accepts all valid projectType values", async () => {
    for (const projectType of ["ramais", "geral", "clandestino"] as const) {
      computeMock.mockReturnValue(mockDerivedResponse());
      const res = await request(app)
        .post("/api/bt/derived")
        .send({ ...minimalBody(), projectType });
      expect(res.status).toBe(200);
    }
  });
});

// ─── validation errors ────────────────────────────────────────────────────────

describe("POST /api/bt/derived – validation errors", () => {
  let app: express.Application;

  beforeEach(() => {
    computeMock.mockReset();
    app = buildApp();
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/bt/derived").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when projectType is invalid", async () => {
    const body = { ...minimalBody(), projectType: "invalid" };
    const res = await request(app).post("/api/bt/derived").send(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when topology.poles is missing", async () => {
    const body = {
      projectType: "geral",
      topology: { transformers: [], edges: [] },
    };
    const res = await request(app).post("/api/bt/derived").send(body);
    expect(res.status).toBe(400);
  });

  it("returns 400 when pole id is empty string", async () => {
    const body = {
      projectType: "geral",
      topology: {
        poles: [{ id: "", lat: 0, lng: 0 }],
        transformers: [],
        edges: [],
      },
    };
    const res = await request(app).post("/api/bt/derived").send(body);
    expect(res.status).toBe(400);
  });

  it("returns 400 when clandestinoAreaM2 is negative", async () => {
    const body = { ...minimalBody(), clandestinoAreaM2: -10 };
    const res = await request(app).post("/api/bt/derived").send(body);
    expect(res.status).toBe(400);
  });

  it("does not call computeBtDerivedState on validation failure", async () => {
    await request(app).post("/api/bt/derived").send({});
    expect(computeMock).not.toHaveBeenCalled();
  });
});

// ─── internal error ───────────────────────────────────────────────────────────

describe("POST /api/bt/derived – internal error", () => {
  let app: express.Application;

  beforeEach(() => {
    computeMock.mockReset();
    app = buildApp();
  });

  it("returns 500 when computeBtDerivedState throws", async () => {
    computeMock.mockImplementation(() => {
      throw new Error("unexpected");
    });
    const res = await request(app).post("/api/bt/derived").send(minimalBody());
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

