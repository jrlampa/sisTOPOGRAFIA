import express from "express";
import request from "supertest";

describe("osmRoutes", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  it("returns 503 when all Overpass endpoints fail outside test environment", async () => {
    process.env.NODE_ENV = "production";
    jest.resetModules();

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("overpass-down")) as unknown as typeof fetch;

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const response = await request(app)
      .post("/api/osm")
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(response.status).toBe(503);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "OSM provider unavailable",
        code: "OVERPASS_UNAVAILABLE",
        reason: "NETWORK_OR_UPSTREAM",
      }),
    );
  });

  it("returns 503 with RATE_LIMIT reason when Overpass responds 429", async () => {
    process.env.NODE_ENV = "production";
    jest.resetModules();

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    }) as unknown as typeof fetch;

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const response = await request(app)
      .post("/api/osm")
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(response.status).toBe(503);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "OSM provider unavailable",
        code: "OVERPASS_UNAVAILABLE",
        reason: "RATE_LIMIT",
      }),
    );
    expect(response.body.message).toContain("limite");
  });

  it("keeps synthetic fallback enabled only in test environment", async () => {
    process.env.NODE_ENV = "test";
    jest.resetModules();

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("overpass-down")) as unknown as typeof fetch;

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const response = await request(app)
      .post("/api/osm")
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        _fallback: true,
      }),
    );
    expect(Array.isArray(response.body.elements)).toBe(true);
  });

  it("blocks /mock route outside test environment", async () => {
    process.env.NODE_ENV = "production";
    jest.resetModules();

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const response = await request(app)
      .post("/api/osm/mock")
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(response.status).toBe(404);
  });
});

describe("osmRoutes — success path, cache, mock route, stats branches", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    jest.resetModules();
    if (originalFetch) global.fetch = originalFetch;
  });

  it("POST / retorna 200 com dados reais quando fetch bem-sucedido", async () => {
    process.env.NODE_ENV = "test";
    jest.resetModules();

    global.fetch = jest.fn().mockResolvedValueOnce({
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
    jest.resetModules();

    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
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

  it("POST /mock retorna 200 em ambiente de teste", async () => {
    process.env.NODE_ENV = "test";
    jest.resetModules();

    const { default: osmRoutes } = await import("../routes/osmRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/osm", osmRoutes);

    const res = await request(app)
      .post("/api/osm/mock")
      .send({ lat: -23.55, lng: -46.63, radius: 300 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.elements)).toBe(true);
    });

    it("POST / handles non-OK response status (500) from Overpass with graceful fallback", async () => {
      process.env.NODE_ENV = "production";
      jest.resetModules();

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }) as unknown as typeof fetch;

      const { default: osmRoutes } = await import("../routes/osmRoutes");
      const app = express();
      app.use(express.json());
      app.use("/api/osm", osmRoutes);

      const response = await request(app)
        .post("/api/osm")
        .send({ lat: -23.55, lng: -46.63, radius: 300 });

      // Should return 503 (unavailable) not 500, because error is caught properly
      expect(response.status).toBe(503);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: "OSM provider unavailable",
          code: "OVERPASS_UNAVAILABLE",
        }),
      );
  });
});
