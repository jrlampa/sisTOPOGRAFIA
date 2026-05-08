import { vi } from "vitest";
import express from "express";
import request from "supertest";

describe("osmRoutes", { timeout: 15000 }, () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  it("returns 503 when all Overpass endpoints fail outside test environment", async () => {
    process.env.NODE_ENV = "production";
    vi.resetModules();

    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("overpass-down")) as unknown as typeof fetch;

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const response = await request(app)
      .post("/api/osm")
      // Coordenadas únicas para evitar colisão com cache em memória de outros testes.
      .send({ lat: -11.111111, lng: -57.777777, radius: 333 });

    expect(response.status).toBe(503);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "OSM provider unavailable",
        code: "OVERPASS_UNAVAILABLE",
      }),
    );
  });
});

describe("osmRoutes — success path, cache, stats branches", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalFetch) global.fetch = originalFetch;
  });

  it("POST / retorna 200 com dados reais quando fetch bem-sucedido", async () => {
    process.env.NODE_ENV = "test";
    vi.resetModules();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        version: 0.6,
        generator: "Overpass API",
        elements: [
          { type: "way", tags: { building: "yes", height: "12" } },
          { type: "way", tags: { highway: "residential" } },
          { type: "node", tags: { natural: "tree" } },
          { type: "node", tags: { "building:levels": "3" } },
        ],
      }),
    }) as unknown as typeof fetch;

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const res = await request(app)
      .post("/api/osm")
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.elements)).toBe(true);
    expect(res.body._stats).toBeDefined();
    expect(res.body._stats.totalBuildings).toBeGreaterThanOrEqual(1);
  });

  it("POST / retorna 200 com cache hit na segunda requisicao", async () => {
    process.env.NODE_ENV = "test";
    vi.resetModules();

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          version: 0.6,
          elements: [{ type: "way", tags: { building: "yes" } }],
        }),
      };
    }) as unknown as typeof fetch;

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const body = { lat: -10.55, lng: -40.63, radius: 500 };
    const res1 = await request(app).post("/api/osm").send(body);
    const res2 = await request(app).post("/api/osm").send(body);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Second request is from cache (fetch called only once)
    expect(callCount).toBe(1);
  });
});
