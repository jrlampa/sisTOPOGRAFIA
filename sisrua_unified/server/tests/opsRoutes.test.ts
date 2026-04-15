import express from "express";
import request from "supertest";

describe("opsRoutes", () => {
  const originalMetricsToken = process.env.METRICS_TOKEN;

  afterEach(() => {
    process.env.METRICS_TOKEN = originalMetricsToken;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("returns 401 when token is configured and request is unauthorized", async () => {
    process.env.METRICS_TOKEN = "ops-secret-token";
    jest.resetModules();

    const { default: opsRoutes } = await import("../routes/opsRoutes");

    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/external-apis");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns degraded with breaker details when any circuit is open", async () => {
    delete process.env.METRICS_TOKEN;
    jest.resetModules();

    const { default: opsRoutes } = await import("../routes/opsRoutes");
    const { getCircuitBreaker, clearCircuitBreakerRegistry } =
      await import("../utils/circuitBreaker");

    clearCircuitBreakerRegistry();

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
    expect(Array.isArray(response.body.circuitBreakers)).toBe(true);
    expect(
      response.body.runbook?.recommendedActionsPtBr?.length,
    ).toBeGreaterThan(0);
  });

  it("supports summary mode without breaker details payload", async () => {
    delete process.env.METRICS_TOKEN;
    jest.resetModules();

    const { default: opsRoutes } = await import("../routes/opsRoutes");
    const { clearCircuitBreakerRegistry } =
      await import("../utils/circuitBreaker");

    clearCircuitBreakerRegistry();

    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get(
      "/api/ops/external-apis?details=summary",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("online");
    expect(response.body.circuitBreakers).toBeUndefined();
    expect(response.body.summary.totalRegistered).toBe(0);
  });

  it("returns AI runtime diagnostics as degraded when governance is not compliant", async () => {
    delete process.env.METRICS_TOKEN;
    jest.resetModules();

    const { default: opsRoutes } = await import("../routes/opsRoutes");
    const { OllamaService } = await import("../services/ollamaService");

    jest.spyOn(OllamaService, "getGovernanceStatus").mockResolvedValue({
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
      updateRecommended: true,
      canAutoUpdate: false,
    });
    expect(
      response.body.runbook?.recommendedActionsPtBr?.length,
    ).toBeGreaterThan(0);
  });

  it("enforces auth on AI runtime endpoint when token is configured", async () => {
    process.env.METRICS_TOKEN = "ops-secret-token";
    jest.resetModules();

    const { default: opsRoutes } = await import("../routes/opsRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/ops", opsRoutes);

    const response = await request(app).get("/api/ops/ai-runtime");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });
});
