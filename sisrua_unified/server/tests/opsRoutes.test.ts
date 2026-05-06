import { vi } from "vitest";
import express from "express";
import request from "supertest";
import opsRoutes from "../routes/opsRoutes.js";
import { OllamaService } from "../services/ollamaService.js";
import { getCircuitBreaker, clearCircuitBreakerRegistry } from "../utils/circuitBreaker.js";
import { config } from "../config.js";

// Mock config to allow dynamic token testing
vi.mock("../config.js", () => ({
  config: {
    METRICS_TOKEN: undefined,
    OLLAMA_MIN_VERSION: "0.5.0",
    ollamaUpdateCheckEnabled: true,
    ollamaEnforceZeroCost: true,
    ollamaFallbackModels: ["llama3.1"],
  },
}));

describe("opsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCircuitBreakerRegistry();
    (config as any).METRICS_TOKEN = undefined;
  });

  it("returns 200 when no token is configured", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/external-apis?details=summary");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("online");
  });

  it("returns 401 when token is configured and request is unauthorized", async () => {
    (config as any).METRICS_TOKEN = "ops-secret-token";

    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/external-apis");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns degraded with breaker details when any circuit is open", async () => {
    (config as any).METRICS_TOKEN = undefined;

    const openBreaker = getCircuitBreaker("TEST_OPEN", { failureThreshold: 1 });
    await expect(
      openBreaker.execute(async () => {
        throw new Error("forced failure");
      }),
    ).rejects.toThrow("forced failure");

    getCircuitBreaker("TEST_CLOSED");

    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/external-apis");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.summary).toEqual(
      expect.objectContaining({
        totalRegistered: 2,
        openCircuits: 1,
        closedCircuits: 1,
      }),
    );
  });

  it("returns AI runtime diagnostics as degraded when governance is not compliant", async () => {
    (config as any).METRICS_TOKEN = undefined;

    vi.spyOn(OllamaService, "getGovernanceStatus").mockResolvedValue({
      runtime: {
        available: true,
        host: "http://remote-ollama.example",
        configuredModel: "llama3.2",
        selectedModel: "llama3.2",
        availableModels: ["llama3.2"],
        zeroCostEnforced: true,
        zeroCostCompliant: false,
        fallbackModels: ["llama3.1"],
        compatibility: {
          configuredModelAvailable: true,
          fallbackModelUsed: false,
        },
        warnings: ["Host do Ollama fora da política zero-custo."],
      },
      version: {
        current: "0.4.0",
        minimum: "0.5.0",
        compliant: false,
        updateRecommended: true,
        checkEnabled: true,
      },
      maintenanceWindow: {
        configuredUtc: "02:00-04:00",
        inWindow: false,
        nowUtc: "2026-04-14T12:00:00.000Z",
      },
      updatePolicy: {
        canAutoUpdate: false,
        reason: "Host do Ollama fora da política zero-custo.",
      },
    });

    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/ai-runtime");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.summary).toMatchObject({
      runtimeAvailable: true,
      zeroCostCompliant: false,
      versionCompliant: false,
    });
  });

  it("returns 400 for invalid query parameters in external-apis", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/external-apis?details=invalid-mode");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Parâmetros inválidos");
  });

  it("returns 401 for unauthorized AI runtime access", async () => {
    (config as any).METRICS_TOKEN = "ai-secret";
    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/ai-runtime");

    expect(response.status).toBe(401);
  });

  it("returns 500 when governance service fails", async () => {
    (config as any).METRICS_TOKEN = undefined;
    vi.spyOn(OllamaService, "getGovernanceStatus").mockRejectedValue(new Error("Service crash"));

    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/ai-runtime");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Ops AI runtime status failed");
  });
});

