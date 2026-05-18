import { vi, describe, it, expect, beforeEach } from "vitest";
import { OllamaGovernanceService } from "../services/ollamaGovernanceService";
import { OllamaService } from "../services/ollamaService";

vi.mock("../services/ollamaService", () => ({
  OllamaService: {
    getGovernanceStatus: vi.fn(),
    getRuntimeStatus: vi.fn(),
  },
}));

describe("OllamaGovernanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCompatibilityMatrix", () => {
    it("deve retornar a matriz de compatibilidade canônica", () => {
      const matrix = OllamaGovernanceService.getCompatibilityMatrix();
      expect(Array.isArray(matrix)).toBe(true);
      expect(matrix.length).toBeGreaterThan(0);
      expect(matrix[0]).toHaveProperty("modelName");
    });
  });

  describe("getModelEntry", () => {
    it("deve retornar a entrada para um modelo existente (case-insensitive)", () => {
      const entry = OllamaGovernanceService.getModelEntry("LLAMA3.2");
      expect(entry).not.toBeNull();
      expect(entry?.modelName).toBe("llama3.2");
    });

    it("deve retornar null para um modelo inexistente", () => {
      const entry = OllamaGovernanceService.getModelEntry("non-existent-model");
      expect(entry).toBeNull();
    });
  });

  describe("isModelHomologated", () => {
    it("deve retornar homologated: true para modelo ativo", () => {
      const result = OllamaGovernanceService.isModelHomologated("llama3.2");
      expect(result.homologated).toBe(true);
      expect(result.reason).toContain("homologado");
    });

    it("deve retornar homologated: true para modelo depreciado", () => {
      const result = OllamaGovernanceService.isModelHomologated("llama3.1");
      expect(result.homologated).toBe(true);
      expect(result.reason).toContain("depreciado");
    });

    it("deve retornar homologated: false para modelo inexistente", () => {
      const result = OllamaGovernanceService.isModelHomologated("gpt-4");
      expect(result.homologated).toBe(false);
      expect(result.reason).toContain("não consta na matriz");
    });
  });

  describe("getDeprecationAlerts", () => {
    it("deve retornar alertas para modelos depreciados ou próximos da depreciação", () => {
      // llama3.1 tem deprecationDate: "2026-06-01"
      // Se hoje for 2026-05-09, está dentro dos 30 dias (23 dias para 01/06)
      const alerts = OllamaGovernanceService.getDeprecationAlerts(30);
      expect(alerts.some(a => a.includes("llama3.1"))).toBe(true);
    });
  });

  describe("getGovernanceReport", () => {
    it("deve gerar um relatório completo", async () => {
      const mockStatus = {
        runtime: {
          available: true,
          selectedModel: "llama3.2",
          zeroCostEnforced: true,
          zeroCostCompliant: true,
          host: "http://localhost:11434"
        }
      };
      (OllamaService.getGovernanceStatus as any).mockResolvedValue(mockStatus);

      const report = await OllamaGovernanceService.getGovernanceReport();
      expect(report.activeModel).toBe("llama3.2");
      expect(report.zeroCostPolicy.compliant).toBe(true);
      expect(report.compatibilityMatrix.length).toBeGreaterThan(0);
    });
  });

  describe("checkAndAlertRollback", () => {
    it("deve retornar rollbackNeeded: false se o modelo atual for homologado", async () => {
      (OllamaService.getRuntimeStatus as any).mockResolvedValue({
        selectedModel: "llama3.2",
        available: true
      });

      const result = await OllamaGovernanceService.checkAndAlertRollback();
      expect(result.rollbackNeeded).toBe(false);
    });

    it("deve retornar rollbackNeeded: true se o modelo atual NÃO for homologado", async () => {
      (OllamaService.getRuntimeStatus as any).mockResolvedValue({
        selectedModel: "unauthorized-model",
        available: true
      });

      const result = await OllamaGovernanceService.checkAndAlertRollback();
      expect(result.rollbackNeeded).toBe(true);
    });
  });

  describe("runPromptRegression", () => {
    it("deve retornar erro se o Ollama estiver indisponível", async () => {
      (OllamaService.getRuntimeStatus as any).mockResolvedValue({
        available: false,
        zeroCostCompliant: false
      });

      const results = await OllamaGovernanceService.runPromptRegression();
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain("indisponível");
    });

    it("deve executar testes de regressão e retornar resultados", async () => {
      (OllamaService.getRuntimeStatus as any).mockResolvedValue({
        available: true,
        zeroCostCompliant: true,
        selectedModel: "llama3.2"
      });
      (OllamaService.getGovernanceStatus as any).mockResolvedValue({
        runtime: { host: "http://localhost:11434" }
      });

      // Mock fetch global
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: '{"analysis": "Teste OK"}' })
      });

      const results = await OllamaGovernanceService.runPromptRegression();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].passed).toBe(true);
      expect(results[0].responseSnippet).toContain("analysis");
    });
  });
});
