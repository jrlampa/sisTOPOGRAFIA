/**
 * analysisService.test.ts
 *
 * Testes unitários para OllamaService.analyzeArea().
 * Moca fetch global para evitar chamadas reais ao Ollama.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Mock logger ──────────────────────────────────────────────────────────────
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock config ──────────────────────────────────────────────────────────────
vi.mock("../config.js", () => ({
  config: {
    OLLAMA_HOST: "http://localhost:11434",
    OLLAMA_MODEL: "llama3.2",
    OLLAMA_ENFORCE_ZERO_COST: undefined,
    OLLAMA_FALLBACK_MODELS: "",
    OLLAMA_ALLOWED_REMOTE_HOSTS: "",
    OLLAMA_MIN_VERSION: "0.0.0",
    OLLAMA_UPDATE_MAINTENANCE_WINDOW_UTC: "02:00-04:00",
    OLLAMA_UPDATE_CHECK_ENABLED: undefined,
    OLLAMA_STARTUP_WAIT_MS: 3000,
    OLLAMA_CHECK_TIMEOUT_MS: 2000,
  },
}));

// ─── Import service (after mocks) ─────────────────────────────────────────────
import { OllamaService } from "../services/ollamaService.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stats = { buildings: 12, roads: 5, trees: 3 };
const noDataStats = { buildings: 0, roads: 0, trees: 0 };
const location = "São Paulo, SP";

function makeOllamaResponse(responseText: string): Response {
  return new Response(JSON.stringify({ response: responseText }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeRuntimeStatus(
  overrides: Partial<{
    available: boolean;
    zeroCostCompliant: boolean;
    selectedModel: string;
    compatibility: {
      configuredModelAvailable: boolean;
      fallbackModelUsed: boolean;
    };
  }> = {},
) {
  return {
    available: true,
    zeroCostCompliant: true,
    selectedModel: "llama3.2",
    configuredModel: "llama3.2",
    host: "http://localhost:11434",
    availableModels: ["llama3.2"],
    zeroCostEnforced: true,
    fallbackModels: [],
    warnings: [],
    compatibility: { configuredModelAvailable: true, fallbackModelUsed: false },
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Error conditions
// ═════════════════════════════════════════════════════════════════════════════

describe("OllamaService.analyzeArea — error conditions", () => {
  beforeEach(() => {
    vi.spyOn(OllamaService, "getRuntimeStatus").mockResolvedValue(
      makeRuntimeStatus() as any,
    );
  });

  it("returns blocked message when zero-cost policy is violated", async () => {
    vi.spyOn(OllamaService, "getRuntimeStatus").mockResolvedValue(
      makeRuntimeStatus({ zeroCostCompliant: false }) as any,
    );
    const result = await OllamaService.analyzeArea(stats, location);
    expect(result.analysis).toContain("zero custo");
  });

  it("returns analysis text when Ollama returns non-JSON response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(makeOllamaResponse("Análise sem JSON"));
    const result = await OllamaService.analyzeArea(stats, location);
    expect(result.analysis).toBe("Análise sem JSON");
  });

  it("returns error message when Ollama HTTP request fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );
    const result = await OllamaService.analyzeArea(stats, location);
    expect(result.analysis).toContain("500");
  });

  it("returns error message when fetch throws (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network timeout"));
    const result = await OllamaService.analyzeArea(stats, location);
    expect(result.analysis).toContain("network timeout");
  });

  it("returns error message when Ollama response is empty", async () => {
    global.fetch = vi.fn().mockResolvedValue(makeOllamaResponse(""));
    const result = await OllamaService.analyzeArea(stats, location);
    expect(typeof result.analysis).toBe("string");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Happy path
// ═════════════════════════════════════════════════════════════════════════════

describe("OllamaService.analyzeArea — happy path", () => {
  beforeEach(() => {
    vi.spyOn(OllamaService, "getRuntimeStatus").mockResolvedValue(
      makeRuntimeStatus() as any,
    );
  });

  it("returns parsed analysis on valid JSON response", async () => {
    const analysisText = "Melhorias recomendadas para mobilidade";
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        makeOllamaResponse(JSON.stringify({ analysis: analysisText })),
      );
    const result = await OllamaService.analyzeArea(stats, location);
    expect(result.analysis).toBe(analysisText);
  });

  it("parses JSON embedded in surrounding text", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        makeOllamaResponse(
          'Aqui está a análise: { "analysis": "conteúdo" } fim.',
        ),
      );
    const result = await OllamaService.analyzeArea(stats, location);
    expect(result.analysis).toBe("conteúdo");
  });

  it("sends request to correct Ollama endpoint", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeOllamaResponse('{ "analysis": "ok" }'));
    global.fetch = fetchSpy;
    await OllamaService.analyzeArea(stats, location);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/generate"),
      expect.any(Object),
    );
  });

  it("sends configured model name in request body", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeOllamaResponse('{ "analysis": "ok" }'));
    global.fetch = fetchSpy;
    await OllamaService.analyzeArea(stats, location);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe("llama3.2");
  });

  it("uses no-data prompt when all stats are zero", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeOllamaResponse('{ "analysis": "sem dados" }'));
    global.fetch = fetchSpy;
    await OllamaService.analyzeArea(noDataStats, location);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.prompt).toContain("sem dados OSM");
  });

  it("uses data prompt when stats have values", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeOllamaResponse('{ "analysis": "com dados" }'));
    global.fetch = fetchSpy;
    await OllamaService.analyzeArea(stats, location);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.prompt).toContain(location);
  });
});
