/**
 * analysisService.test.ts
 *
 * Testes unitários para AnalysisService.analyzeArea().
 * Mock da lib groq-sdk para evitar chamadas reais de rede.
 */

import { jest } from "@jest/globals";

// ─── Mock logger ─────────────────────────────────────────────────────────────
jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Mock groq-sdk ────────────────────────────────────────────────────────────
// Factory stores mockCreate on the constructor so we can access it after import
jest.mock("groq-sdk", () => {
  const mockCreate = jest.fn();
  const MockGroq = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  (MockGroq as any).__mockCreate = mockCreate;
  return { default: MockGroq, __esModule: true };
});

// ─── Import service (after mocks) ─────────────────────────────────────────────
import { AnalysisService } from "../services/analysisService.js";
import Groq from "groq-sdk";

// Access the shared mockCreate exposed by the factory
const mockCreate = (Groq as any).__mockCreate as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stats = { buildings: 12, roads: 5, trees: 3 };
const noDataStats = { buildings: 0, roads: 0, trees: 0 };
const location = "São Paulo, SP";
const apiKey = "test-api-key";

function makeCompletion(text: string) {
  return {
    choices: [{ message: { content: text } }],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Error conditions
// ═════════════════════════════════════════════════════════════════════════════

describe("AnalysisService.analyzeArea — error conditions", () => {
  it("throws when apiKey is empty string", async () => {
    await expect(
      AnalysisService.analyzeArea(stats, location, ""),
    ).rejects.toThrow("GROQ_API_KEY is missing");
  });

  it("throws when apiKey is undefined/null", async () => {
    await expect(
      AnalysisService.analyzeArea(stats, location, undefined as any),
    ).rejects.toThrow("GROQ_API_KEY is missing");
  });

  it("returns error message string when Groq throws", async () => {
    mockCreate.mockRejectedValue(new Error("network timeout"));
    const result = await AnalysisService.analyzeArea(stats, location, apiKey);
    expect(result.analysis).toContain("network timeout");
    expect(result.analysis).toContain(location);
  });

  it("returns error message when Groq returns empty content", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: "" } }] });
    const result = await AnalysisService.analyzeArea(stats, location, apiKey);
    expect(result.analysis).toBe(
      "Erro ao processar análise AI. Formato inválido.",
    );
  });

  it("returns error message when Groq response has no JSON block", async () => {
    mockCreate.mockResolvedValue(makeCompletion("Análise sem JSON"));
    const result = await AnalysisService.analyzeArea(stats, location, apiKey);
    expect(result.analysis).toContain("Erro ao processar análise AI");
  });

  it("returns error message when choices is undefined", async () => {
    mockCreate.mockResolvedValue({ choices: [] });
    const result = await AnalysisService.analyzeArea(stats, location, apiKey);
    expect(result.analysis).toContain("Erro");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Happy path
// ═════════════════════════════════════════════════════════════════════════════

describe("AnalysisService.analyzeArea — happy path", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns parsed analysis on valid JSON response", async () => {
    const analysisText = "Melhorias recomendadas para mobilidade";
    mockCreate.mockResolvedValue(
      makeCompletion(JSON.stringify({ analysis: analysisText })),
    );
    const result = await AnalysisService.analyzeArea(stats, location, apiKey);
    expect(result.analysis).toBe(analysisText);
  });

  it("parses JSON embedded in surrounding text", async () => {
    mockCreate.mockResolvedValue(
      makeCompletion('Aqui está a análise: { "analysis": "conteúdo" } fim.'),
    );
    const result = await AnalysisService.analyzeArea(stats, location, apiKey);
    expect(result.analysis).toBe("conteúdo");
  });

  it("instantiates Groq with provided apiKey", async () => {
    mockCreate.mockResolvedValue(makeCompletion('{ "analysis": "ok" }'));
    await AnalysisService.analyzeArea(stats, location, apiKey);
    expect(Groq).toHaveBeenCalledWith({ apiKey });
  });

  it("sends correct model name to Groq", async () => {
    mockCreate.mockResolvedValue(makeCompletion('{ "analysis": "ok" }'));
    await AnalysisService.analyzeArea(stats, location, apiKey);
    const callArg = mockCreate.mock.calls[0][0] as any;
    expect(callArg.model).toBe("llama-3.3-70b-versatile");
  });

  it("uses no-data prompt when all stats are zero", async () => {
    mockCreate.mockResolvedValue(makeCompletion('{ "analysis": "sem dados" }'));
    await AnalysisService.analyzeArea(noDataStats, location, apiKey);
    const callArg = mockCreate.mock.calls[0][0] as any;
    expect(callArg.messages[0].content).toContain("complementado");
  });

  it("uses data prompt when stats have values", async () => {
    mockCreate.mockResolvedValue(makeCompletion('{ "analysis": "com dados" }'));
    await AnalysisService.analyzeArea(stats, location, apiKey);
    const callArg = mockCreate.mock.calls[0][0] as any;
    expect(callArg.messages[0].content).toContain("mobilidade");
  });
});
