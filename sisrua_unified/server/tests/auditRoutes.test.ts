/**
 * auditRoutes.test.ts
 *
 * Testes para /api/audit/export e /api/audit/health.
 * Mock do postgres e da autenticação Bearer.
 */

import request from "supertest";
import express from "express";
import { vi } from "vitest";

// ─── Mock logger ─────────────────────────────────────────────────────────────
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock config ─────────────────────────────────────────────────────────────
const mockConfig = {
  DATABASE_URL: "postgres://localhost/test",
  METRICS_TOKEN: "secret-token",
  NODE_ENV: "test",
};
vi.mock("../config", () => ({
  get config() {
    return mockConfig;
  },
}));

// ─── Mock bearerAuth ──────────────────────────────────────────────────────────
const isBearerAuthorized = vi.fn<() => boolean>(() => true);
vi.mock("../utils/bearerAuth", () => ({
  isBearerRequestAuthorized: isBearerAuthorized,
  setBearerChallenge: vi.fn((res: any, _realm: string) => {
    res.set("WWW-Authenticate", `Bearer realm="${_realm}"`);
  }),
}));

// ─── Mock postgres ────────────────────────────────────────────────────────────
const mockUnsafe = vi.fn<(...args: any[]) => Promise<any[]>>();
const mockPostgresInstance = { unsafe: mockUnsafe };
vi.mock("postgres", () => ({
  __esModule: true,
  default: vi.fn(() => mockPostgresInstance),
}));

// ─── Import router ────────────────────────────────────────────────────────────
let router: express.Router;
let app: express.Application;

beforeAll(async () => {
  const mod = await import("../routes/auditRoutes.js");
  router = mod.default;
  app = express();
  app.use(express.json());
  app.use("/", router);
});

beforeEach(() => {
  mockUnsafe.mockReset();
  isBearerAuthorized.mockReturnValue(true);
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /health
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /health", () => {
  it("returns enabled when DATABASE_URL is set", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.auditPersistence).toBe("enabled");
    expect(res.body.exportEndpoint).toBe("/api/audit/export");
  });

  it("returns disabled when DATABASE_URL is missing", async () => {
    const original = mockConfig.DATABASE_URL;
    (mockConfig as any).DATABASE_URL = "";
    const res = await request(app).get("/health");
    expect(res.body.auditPersistence).toBe("disabled");
    (mockConfig as any).DATABASE_URL = original;
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /export — Autenticação
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /export — auth", () => {
  it("returns 401 when bearer token is missing/invalid", async () => {
    isBearerAuthorized.mockReturnValue(false);
    const res = await request(app).get("/export");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("returns 503 when DATABASE_URL is missing", async () => {
    const original = mockConfig.DATABASE_URL;
    (mockConfig as any).DATABASE_URL = "";
    const res = await request(app)
      .get("/export")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(503);
    (mockConfig as any).DATABASE_URL = original;
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /export — Query Validation
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /export — query validation", () => {
  it("returns 400 for invalid limit", async () => {
    mockUnsafe.mockResolvedValue([]);
    const res = await request(app)
      .get("/export?limit=999999")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválidos/i);
  });

  it("returns 400 for invalid action value", async () => {
    mockUnsafe.mockResolvedValue([]);
    const res = await request(app)
      .get("/export?action=HACK")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid since date", async () => {
    mockUnsafe.mockResolvedValue([]);
    const res = await request(app)
      .get("/export?since=not-a-date")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid tenant_id (not uuid)", async () => {
    mockUnsafe.mockResolvedValue([]);
    const res = await request(app)
      .get("/export?tenant_id=not-uuid")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /export — Happy Paths
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /export — happy paths", () => {
  it("returns JSON array by default", async () => {
    const fakeEvents = [{ id: 1, event_time: "2026-01-01T00:00:00Z" }];
    mockUnsafe.mockResolvedValue(fakeEvents);
    const res = await request(app)
      .get("/export")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.events).toEqual(fakeEvents);
  });

  it("returns NDJSON when format=ndjson", async () => {
    const fakeEvents = [
      { id: 1, event_time: "2026-01-01T00:00:00Z" },
      { id: 2, event_time: "2026-01-02T00:00:00Z" },
    ];
    mockUnsafe.mockResolvedValue(fakeEvents);
    const res = await request(app)
      .get("/export?format=ndjson")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/ndjson/);
    const lines = (res.text as string).split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe(1);
  });

  it("returns empty events when DB returns no rows", async () => {
    mockUnsafe.mockResolvedValue([]);
    const res = await request(app)
      .get("/export")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.events).toEqual([]);
  });

  it("applies filters: since, until, before_event_time, tenant_id, table_name, action", async () => {
    mockUnsafe.mockResolvedValue([]);
    const res = await request(app)
      .get(
        "/export?since=2026-01-01T00:00:00.000%2B00:00&until=2026-12-31T23:59:59.000%2B00:00" +
          "&before_event_time=2026-12-31T23:00:00.000%2B00:00" +
          "&tenant_id=11111111-1111-4111-8111-111111111111" +
          "&table_name=users&action=INSERT&limit=50",
      )
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
    // Verify SQL was built with all filter params
    const sqlCall = mockUnsafe.mock.calls[0];
    const sqlStr = sqlCall[0] as string;
    expect(sqlStr).toContain("WHERE");
    expect(sqlStr).toContain("event_time <");
  });

  it("returns 500 on DB error", async () => {
    mockUnsafe.mockRejectedValue(new Error("db crash"));
    const res = await request(app)
      .get("/export")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/auditoria/i);
  });
});

