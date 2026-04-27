// Mock dependencies before importing app
jest.mock("../repositories/index.js", () => ({
  pingDb: jest.fn(),
  initDbClient: jest.fn().mockResolvedValue(undefined),
  isDbAvailable: jest.fn().mockReturnValue(true),
}));

jest.mock("../services/ollamaService.js", () => ({
  OllamaService: {
    isAvailable: jest.fn(),
    getGovernanceStatus: jest.fn().mockResolvedValue({ status: "running" }),
  },
}));

jest.mock("../utils/circuitBreaker.js", () => ({
  listCircuitBreakers: jest.fn(),
}));

jest.mock("../services/constantsService.js", () => ({
  constantsService: {
    stats: jest.fn().mockReturnValue({}),
  },
}));

jest.mock("../utils/requestContext.js", () => ({
  requestContext: {
    run: jest.fn((_store, cb) => cb()),
    getStore: jest.fn(),
  },
}));

jest.mock("../config.js", () => ({
  config: {
    APP_VERSION: "1.0.0",
    NODE_ENV: "test",
    useSupabaseJobs: true,
    useDbConstantsConfig: false,
  },
}));

import request from "supertest";
import app from "../app.js";
import { pingDb } from "../repositories/index.js";
import { isDbAvailable } from "../repositories/index.js";
import { OllamaService } from "../services/ollamaService.js";
import { listCircuitBreakers } from "../utils/circuitBreaker.js";
import { requestContext } from "../utils/requestContext.js";

describe("Health Check Endpoint (/health)", () => {
  const governanceRunning = {
    runtime: {
      available: true,
      configuredModel: "llama3.2",
      selectedModel: "llama3.2",
      zeroCostCompliant: true,
    },
    version: {
      current: "0.5.0",
      minimum: "0.5.0",
      compliant: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 and status online when all systems are healthy", async () => {
    (pingDb as jest.Mock).mockResolvedValue(true);
    (isDbAvailable as jest.Mock).mockReturnValue(true);
    (OllamaService.isAvailable as jest.Mock).mockResolvedValue(true);
    (OllamaService.getGovernanceStatus as jest.Mock).mockResolvedValue(governanceRunning);
    (listCircuitBreakers as jest.Mock).mockReturnValue([
      { name: "OSM", state: "CLOSED" },
    ]);

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("online");
    expect(response.body.dependencies.database).toBe("connected");
    expect(response.body.dependencies.ollama.runtime.available).toBe(true);
  });

  it("should return 503 and status degraded when database is down", async () => {
    (pingDb as jest.Mock).mockResolvedValue(false);
    (isDbAvailable as jest.Mock).mockReturnValue(true);
    (OllamaService.isAvailable as jest.Mock).mockResolvedValue(true);
    (OllamaService.getGovernanceStatus as jest.Mock).mockResolvedValue(governanceRunning);
    (listCircuitBreakers as jest.Mock).mockReturnValue([
      { name: "OSM", state: "CLOSED" },
    ]);

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.dependencies.database).toBe("disconnected");
  });

  it("should return 503 and status degraded when a circuit breaker is OPEN", async () => {
    (pingDb as jest.Mock).mockResolvedValue(true);
    (isDbAvailable as jest.Mock).mockReturnValue(true);
    (OllamaService.isAvailable as jest.Mock).mockResolvedValue(true);
    (OllamaService.getGovernanceStatus as jest.Mock).mockResolvedValue(governanceRunning);
    (listCircuitBreakers as jest.Mock).mockReturnValue([
      { name: "OSM", state: "OPEN" },
    ]);

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
  });

  it("should show ollama as stopped but return 200 if DB is healthy and no open circuits", async () => {
    (pingDb as jest.Mock).mockResolvedValue(true);
    (isDbAvailable as jest.Mock).mockReturnValue(true);
    (OllamaService.isAvailable as jest.Mock).mockResolvedValue(false);
    (OllamaService.getGovernanceStatus as jest.Mock).mockResolvedValue({
      ...governanceRunning,
      runtime: {
        ...governanceRunning.runtime,
        available: false,
      },
    });
    (listCircuitBreakers as jest.Mock).mockReturnValue([
      { name: "OSM", state: "CLOSED" },
    ]);

    const response = await request(app).get("/health");

    if (response.status !== 200) {
      console.log("Response Body:", response.body);
    }

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("online");
    expect(response.body.dependencies.ollama.runtime.available).toBe(false);
  });
});
