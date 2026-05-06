import request from "supertest";
import { vi } from "vitest";
import * as dbClient from "../repositories/dbClient.js";
import { OllamaService } from "../services/ollamaService.js";
import { listCircuitBreakers } from "../utils/circuitBreaker.js";

// Mock dependencies
vi.mock("../repositories/dbClient.js");
vi.mock("../services/ollamaService.js");
vi.mock("../utils/circuitBreaker.js");

const { pingDb, isDbAvailable } = dbClient as any;

describe("Health Check Endpoint (/health)", { timeout: 20000 }, () => {
  let app: any;
  let clearHealthCache: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should return 200 and valid structure when all systems are healthy", async () => {
    vi.doMock("../config.js", () => ({
      config: {
        NODE_ENV: "test",
        APP_VERSION: "0.9.0",
        PORT: 3001,
        CORS_ORIGIN: "http://localhost:3000",
        // Força o healthcheck a avaliar DB
        useSupabaseJobs: true,
        useDbConstantsConfig: false,
      },
    }));
    ({ default: app, clearHealthCache } = await import("../app.js"));
    clearHealthCache();

    (pingDb as vi.Mock).mockResolvedValue(true);
    (isDbAvailable as vi.Mock).mockReturnValue(true);
    (OllamaService.isAvailable as vi.Mock).mockResolvedValue(true);
    (OllamaService.getGovernanceStatus as vi.Mock).mockResolvedValue({ runtime: { available: true } });
    (listCircuitBreakers as vi.Mock).mockReturnValue([]);

    const response = await request(app).get("/health");
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("online");
    expect(response.body.dependencies.database).toBe("connected");
    // Verificamos apenas a existência da estrutura, sem depender do tempo da atualização em background
    expect(response.body.dependencies.ollama.runtime).toBeDefined();
  });

  it("should return 503 when database is down", async () => {
    vi.doMock("../config.js", () => ({
      config: {
        NODE_ENV: "test",
        APP_VERSION: "0.9.0",
        PORT: 3001,
        CORS_ORIGIN: "http://localhost:3000",
        useSupabaseJobs: true,
        useDbConstantsConfig: false,
      },
    }));
    ({ default: app, clearHealthCache } = await import("../app.js"));
    clearHealthCache();

    (pingDb as vi.Mock).mockResolvedValue(false);
    (isDbAvailable as vi.Mock).mockReturnValue(true);
    (listCircuitBreakers as vi.Mock).mockReturnValue([]);

    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.dependencies.database).toBe("disconnected");
  });

  it("should return 503 when a circuit breaker is OPEN", async () => {
    vi.doMock("../config.js", () => ({
      config: {
        NODE_ENV: "test",
        APP_VERSION: "0.9.0",
        PORT: 3001,
        CORS_ORIGIN: "http://localhost:3000",
        useSupabaseJobs: true,
        useDbConstantsConfig: false,
      },
    }));
    ({ default: app, clearHealthCache } = await import("../app.js"));
    clearHealthCache();

    (pingDb as vi.Mock).mockResolvedValue(true);
    (isDbAvailable as vi.Mock).mockReturnValue(true);
    (listCircuitBreakers as vi.Mock).mockReturnValue([
      { name: "OSM", state: "OPEN" },
    ]);

    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
  });
});

