/**
 * indeRoutes.test.ts
 *
 * Testes adicionais para cobrir caminhos não cobertos pelos outros arquivos:
 * - capabilities 400/200/500
 * - features 400 (source inválida), 200 (com dados), 404 (sem dados), 500
 * - wms 400 (source inválida), 200, 500
 */

import express from "express";
import request from "supertest";

const getWfsCapabilitiesMock = jest.fn();
const getFeaturesByBBoxMock = jest.fn();
const getWmsMapUrlMock = jest.fn();

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../services/indeService", () => ({
  IndeService: {
    getWfsCapabilities: (...args: unknown[]) => getWfsCapabilitiesMock(...args),
    getFeaturesByBBox: (...args: unknown[]) => getFeaturesByBBoxMock(...args),
    getWmsMapUrl: (...args: unknown[]) => getWmsMapUrlMock(...args),
  },
}));

let app: express.Application;

beforeAll(async () => {
  const { default: router } = await import("../routes/indeRoutes");
  app = express();
  app.use(express.json());
  app.use("/api/inde", router);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── capabilities ─────────────────────────────────────────────────────────────

describe("GET /capabilities/:source", () => {
  it("retorna 400 para source invalida", async () => {
    const res = await request(app).get("/api/inde/capabilities/xyz");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid source");
  });

  it("retorna 200 com capabilities para source valida", async () => {
    getWfsCapabilitiesMock.mockResolvedValueOnce([
      { name: "REDES_HIDROGRAFICAS", title: "Redes" },
    ]);
    const res = await request(app).get("/api/inde/capabilities/ibge");
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("ibge");
    expect(Array.isArray(res.body.layers)).toBe(true);
  });

  it("retorna 500 quando IndeService lanca erro", async () => {
    getWfsCapabilitiesMock.mockRejectedValueOnce(new Error("service error"));
    const res = await request(app).get("/api/inde/capabilities/ibge");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("INDE service temporarily unavailable");
  });
});

// ─── features ─────────────────────────────────────────────────────────────────

describe("GET /features/:source", () => {
  const validBbox = { layer: "camadas", west: "-49", south: "-23", east: "-46", north: "-21" };

  it("retorna 400 para source invalida", async () => {
    const res = await request(app)
      .get("/api/inde/features/invalida")
      .query(validBbox);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid source");
  });

  it("retorna 400 para bbox invalida", async () => {
    const res = await request(app)
      .get("/api/inde/features/ibge")
      .query({ layer: "camadas", west: "200", south: "-23", east: "-46", north: "-21" });
    expect(res.status).toBe(400);
  });

  it("retorna 200 com features quando getFeaturesByBBox retorna dados", async () => {
    getFeaturesByBBoxMock.mockResolvedValueOnce({
      type: "FeatureCollection",
      features: [
        { id: "1", type: "Feature", geometry: null, properties: {} },
        { id: "2", type: "Feature", geometry: null, properties: {} },
      ],
    });
    const res = await request(app)
      .get("/api/inde/features/ibge")
      .query(validBbox);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.features).toHaveLength(2);
    expect(res.body.meta).toBeDefined();
  });

  it("retorna 404 quando getFeaturesByBBox retorna null", async () => {
    getFeaturesByBBoxMock.mockResolvedValueOnce(null);
    const res = await request(app)
      .get("/api/inde/features/ibge")
      .query(validBbox);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("No features found");
  });

  it("retorna 500 quando IndeService lanca erro", async () => {
    getFeaturesByBBoxMock.mockRejectedValueOnce(new Error("inde crash"));
    const res = await request(app)
      .get("/api/inde/features/ibge")
      .query(validBbox);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("INDE service temporarily unavailable");
  });
});

// ─── wms ──────────────────────────────────────────────────────────────────────

describe("GET /wms/:source", () => {
  const validWmsParams = {
    layer: "camadas",
    west: "-49",
    south: "-23",
    east: "-46",
    north: "-21",
    width: "800",
    height: "600",
  };

  it("retorna 400 para source invalida", async () => {
    const res = await request(app)
      .get("/api/inde/wms/invalida")
      .query(validWmsParams);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid source");
  });

  it("retorna 400 para bbox invalida (west >= east)", async () => {
    const res = await request(app)
      .get("/api/inde/wms/ibge")
      .query({ ...validWmsParams, west: "-40", east: "-49" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Parâmetros inválidos");
  });

  it("retorna 200 com URL quando IndeService retorna URL", async () => {
    getWmsMapUrlMock.mockReturnValueOnce("https://maps.example.com/wms?...");
    const res = await request(app)
      .get("/api/inde/wms/ibge")
      .query(validWmsParams);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://maps.example.com/wms?...");
  });

  it("retorna 500 quando IndeService lanca erro", async () => {
    getWmsMapUrlMock.mockImplementationOnce(() => {
      throw new Error("wms crash");
    });
    const res = await request(app)
      .get("/api/inde/wms/ibge")
      .query(validWmsParams);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("INDE service temporarily unavailable");
  });
});
