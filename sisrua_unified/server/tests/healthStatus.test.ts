import request from "supertest";
import app, { clearHealthCache } from "../app.js";
import { jest } from "@jest/globals";
import * as dbClient from "../repositories/dbClient.js";
import { OllamaService } from "../services/ollamaService.js";
import { listCircuitBreakers } from "../utils/circuitBreaker.js";

// Mock dependencies
jest.mock("../repositories/dbClient.js");
jest.mock("../services/ollamaService.js");
jest.mock("../utils/circuitBreaker.js");

const { pingDb, isDbAvailable } = dbClient as any;

describe("Health Check Endpoint (/health)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearHealthCache(); 
  });

  it("should return 200 and valid structure when all systems are healthy", async () => {
    (pingDb as jest.Mock).mockResolvedValue(true);
    (isDbAvailable as jest.Mock).mockReturnValue(true);
    (OllamaService.isAvailable as jest.Mock).mockResolvedValue(true);
    (OllamaService.getGovernanceStatus as jest.Mock).mockResolvedValue({ runtime: { available: true } });
    (listCircuitBreakers as jest.Mock).mockReturnValue([]);

    const response = await request(app).get("/health");
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("online");
    expect(response.body.dependencies.database).toBe("connected");
    // Verificamos apenas a existência da estrutura, sem depender do tempo da atualização em background
    expect(response.body.dependencies.ollama.runtime).toBeDefined();
  });

  it("should return 503 when database is down", async () => {
    (pingDb as jest.Mock).mockResolvedValue(false);
    (isDbAvailable as jest.Mock).mockReturnValue(true);
    (listCircuitBreakers as jest.Mock).mockReturnValue([]);

    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.dependencies.database).toBe("disconnected");
  });

  it("should return 503 when a circuit breaker is OPEN", async () => {
    (pingDb as jest.Mock).mockResolvedValue(true);
    (isDbAvailable as jest.Mock).mockReturnValue(true);
    (listCircuitBreakers as jest.Mock).mockReturnValue([
      { name: "OSM", state: "OPEN" },
    ]);

    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
  });
});
