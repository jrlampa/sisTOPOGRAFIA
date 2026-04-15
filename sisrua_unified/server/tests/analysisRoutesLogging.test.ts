import express from "express";
import request from "supertest";

const isAvailableMock = jest.fn();
const analyzeAreaMock = jest.fn();
const getRuntimeStatusMock = jest.fn();
const getGovernanceStatusMock = jest.fn();
const loggerErrorMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();

jest.mock("../services/ollamaService", () => ({
  OllamaService: {
    isAvailable: (...args: unknown[]) => isAvailableMock(...args),
    getRuntimeStatus: (...args: unknown[]) => getRuntimeStatusMock(...args),
    getGovernanceStatus: (...args: unknown[]) =>
      getGovernanceStatusMock(...args),
    analyzeArea: (...args: unknown[]) => analyzeAreaMock(...args),
  },
}));

jest.mock("../utils/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerErrorMock(...args),
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
}));

describe("analysisRoutes logging hardening", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("logs only request metadata with truncated preview on analysis errors", async () => {
    getRuntimeStatusMock.mockResolvedValue({
      available: true,
      selectedModel: "llama3.2",
      configuredModel: "llama3.2",
      zeroCostCompliant: true,
    });
    isAvailableMock.mockResolvedValue(true);
    analyzeAreaMock.mockRejectedValueOnce(new Error("internal error"));

    const { default: analysisRoutes } =
      await import("../routes/analysisRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/analysis", analysisRoutes);

    const largeValue = "x".repeat(1500);
    const response = await request(app)
      .post("/api/analysis")
      .send({
        locationName: "Area Teste",
        stats: {
          buildings: 10,
          privatePayload: largeValue,
          apiToken: "super-secret-token",
        },
      });

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);

    const logPayload = loggerErrorMock.mock.calls[0][1] as {
      body?: unknown;
      request?: {
        hasBody: boolean;
        bodyType: string;
        topLevelKeyCount: number;
        topLevelKeys: string[];
        serializedSize: number;
        bodyPreview: string;
        bodyPreviewTruncated: boolean;
      };
    };

    expect(logPayload.body).toBeUndefined();
    expect(logPayload.request).toBeDefined();
    expect(logPayload.request?.hasBody).toBe(true);
    expect(logPayload.request?.bodyType).toBe("object");
    expect(logPayload.request?.topLevelKeys).toEqual(
      expect.arrayContaining(["stats", "locationName"]),
    );
    expect(logPayload.request?.serializedSize).toBeGreaterThan(200);
    expect(logPayload.request?.bodyPreview.length).toBeLessThanOrEqual(200);
    expect(logPayload.request?.bodyPreviewTruncated).toBe(true);
    expect(logPayload.request?.bodyPreview).not.toContain("x".repeat(500));
  });

  it("returns runtime diagnostics with degraded status when Ollama is unavailable", async () => {
    getRuntimeStatusMock.mockResolvedValue({
      available: false,
      host: "http://remote-ollama.example",
      configuredModel: "llama3.2",
      selectedModel: "llama3.2",
      availableModels: [],
      zeroCostEnforced: true,
      zeroCostCompliant: false,
      fallbackModels: [],
      compatibility: {
        configuredModelAvailable: false,
        fallbackModelUsed: false,
      },
      warnings: ["Host do Ollama fora da política zero-custo."],
    });

    const { default: analysisRoutes } = await import("../routes/analysisRoutes");
    const app = express();
    app.use("/api/analysis", analysisRoutes);

    const response = await request(app).get("/api/analysis/runtime");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      available: false,
      zeroCostCompliant: false,
      configuredModel: "llama3.2",
    });
  });

  it("returns governance diagnostics for controlled Ollama updates", async () => {
    getGovernanceStatusMock.mockResolvedValue({
      runtime: {
        available: true,
        host: "http://localhost:11434",
        configuredModel: "llama3.2",
        selectedModel: "llama3.2",
        availableModels: ["llama3.2"],
        zeroCostEnforced: true,
        zeroCostCompliant: true,
        fallbackModels: ["llama3.1"],
        compatibility: {
          configuredModelAvailable: true,
          fallbackModelUsed: false,
        },
        warnings: [],
      },
      version: {
        current: "0.4.9",
        minimum: "0.5.0",
        compliant: false,
        updateRecommended: true,
        checkEnabled: true,
      },
      maintenanceWindow: {
        configuredUtc: "02:00-04:00",
        inWindow: true,
        nowUtc: "2026-01-01T02:30:00.000Z",
      },
      updatePolicy: {
        canAutoUpdate: true,
        reason: "Governança de runtime aprovada para atualização controlada.",
      },
    });

    const { default: analysisRoutes } = await import("../routes/analysisRoutes");
    const app = express();
    app.use("/api/analysis", analysisRoutes);

    const response = await request(app).get("/api/analysis/runtime/governance");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      version: {
        current: "0.4.9",
        minimum: "0.5.0",
        updateRecommended: true,
      },
      updatePolicy: {
        canAutoUpdate: true,
      },
    });
  });
});
