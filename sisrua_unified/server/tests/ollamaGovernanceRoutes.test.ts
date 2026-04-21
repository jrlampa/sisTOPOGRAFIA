/**
 * ollamaGovernanceRoutes.test.ts — Testes para rotas de Governança Ollama (14A + 14B [T1]).
 */
import request from "supertest";
import express from "express";
import ollamaGovernanceRoutes from "../routes/ollamaGovernanceRoutes";
import * as governanceService from "../services/ollamaGovernanceService";

jest.mock("../services/ollamaGovernanceService", () => ({
  OllamaGovernanceService: {
    getGovernanceReport: jest.fn(),
    getCompatibilityMatrix: jest.fn(),
    getModelEntry: jest.fn(),
    isModelHomologated: jest.fn(),
    getDeprecationAlerts: jest.fn(),
    runPromptRegression: jest.fn(),
    checkAndAlertRollback: jest.fn(),
  },
}));

const { OllamaGovernanceService } = governanceService;

const app = express();
app.use(express.json());
app.use("/api/ollama/governance", ollamaGovernanceRoutes);

const mockReport = {
  generatedAt: "2026-04-21T00:00:00.000Z",
  governanceStatus: { runtime: { available: true, zeroCostCompliant: true } },
  compatibilityMatrix: [],
  activeModel: "llama3.2",
  homologatedModel: "llama3.2",
  deprecationAlerts: [],
  zeroCostPolicy: { enforced: true, compliant: true, blockedReason: null },
};

const mockMatrix = [
  {
    modelName: "llama3.2",
    testedWithOllamaVersions: ["0.5.x"],
    status: "ativo",
    deprecationDate: null,
    capabilities: { jsonMode: true, contextWindow: 131072, ptBrSupport: true },
    notes: "Modelo principal.",
  },
];

// ─── GET /report ──────────────────────────────────────────────────────────────

describe("GET /api/ollama/governance/report", () => {
  it("retorna relatório de governança completo", async () => {
    (OllamaGovernanceService.getGovernanceReport as jest.Mock).mockResolvedValue(mockReport);
    const res = await request(app).get("/api/ollama/governance/report");
    expect(res.status).toBe(200);
    expect(res.body.activeModel).toBe("llama3.2");
    expect(res.body).toHaveProperty("compatibilityMatrix");
  });

  it("retorna 500 em caso de erro interno", async () => {
    (OllamaGovernanceService.getGovernanceReport as jest.Mock).mockRejectedValue(
      new Error("falha"),
    );
    const res = await request(app).get("/api/ollama/governance/report");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── GET /compatibility ───────────────────────────────────────────────────────

describe("GET /api/ollama/governance/compatibility", () => {
  it("retorna matriz de compatibilidade com total", async () => {
    (OllamaGovernanceService.getCompatibilityMatrix as jest.Mock).mockReturnValue(mockMatrix);
    const res = await request(app).get("/api/ollama/governance/compatibility");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.modelos[0].modelName).toBe("llama3.2");
  });
});

// ─── GET /deprecation-alerts ──────────────────────────────────────────────────

describe("GET /api/ollama/governance/deprecation-alerts", () => {
  it("retorna lista de alertas com total", async () => {
    (OllamaGovernanceService.getDeprecationAlerts as jest.Mock).mockReturnValue([
      "Modelo 'llama3.1' será depreciado em 10 dia(s).",
    ]);
    const res = await request(app).get("/api/ollama/governance/deprecation-alerts");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.alertas[0]).toContain("llama3.1");
  });

  it("aceita parâmetro dias", async () => {
    (OllamaGovernanceService.getDeprecationAlerts as jest.Mock).mockReturnValue([]);
    const res = await request(app).get(
      "/api/ollama/governance/deprecation-alerts?dias=90",
    );
    expect(res.status).toBe(200);
    expect(OllamaGovernanceService.getDeprecationAlerts).toHaveBeenCalledWith(90);
  });

  it("rejeita dias inválido", async () => {
    const res = await request(app).get(
      "/api/ollama/governance/deprecation-alerts?dias=0",
    );
    expect(res.status).toBe(400);
  });
});

// ─── POST /validate-model ─────────────────────────────────────────────────────

describe("POST /api/ollama/governance/validate-model", () => {
  it("valida modelo homologado", async () => {
    (OllamaGovernanceService.isModelHomologated as jest.Mock).mockReturnValue({
      homologated: true,
      reason: "Modelo ativo.",
    });
    (OllamaGovernanceService.getModelEntry as jest.Mock).mockReturnValue(mockMatrix[0]);

    const res = await request(app)
      .post("/api/ollama/governance/validate-model")
      .send({ model: "llama3.2" });

    expect(res.status).toBe(200);
    expect(res.body.homologated).toBe(true);
    expect(res.body.model).toBe("llama3.2");
  });

  it("retorna homologated:false para modelo desconhecido", async () => {
    (OllamaGovernanceService.isModelHomologated as jest.Mock).mockReturnValue({
      homologated: false,
      reason: "Não consta na matriz.",
    });
    (OllamaGovernanceService.getModelEntry as jest.Mock).mockReturnValue(null);

    const res = await request(app)
      .post("/api/ollama/governance/validate-model")
      .send({ model: "gpt-4" });

    expect(res.status).toBe(200);
    expect(res.body.homologated).toBe(false);
  });

  it("retorna 400 se 'model' ausente", async () => {
    const res = await request(app)
      .post("/api/ollama/governance/validate-model")
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── POST /regression ────────────────────────────────────────────────────────

describe("POST /api/ollama/governance/regression", () => {
  it("retorna resultados de regressão com totais", async () => {
    (OllamaGovernanceService.runPromptRegression as jest.Mock).mockResolvedValue([
      {
        caseId: "ptbr-json-response",
        description: "Teste JSON pt-BR",
        passed: true,
        responseSnippet: '{"analysis":"ok"}',
        durationMs: 120,
        error: null,
      },
      {
        caseId: "json-format-compliance",
        description: "JSON sem markdown",
        passed: false,
        responseSnippet: "",
        durationMs: 0,
        error: "Timeout",
      },
    ]);

    const res = await request(app).post("/api/ollama/governance/regression");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.passed).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.resultados).toHaveLength(2);
  });

  it("retorna 500 em caso de erro", async () => {
    (OllamaGovernanceService.runPromptRegression as jest.Mock).mockRejectedValue(
      new Error("falha"),
    );
    const res = await request(app).post("/api/ollama/governance/regression");
    expect(res.status).toBe(500);
  });
});

// ─── GET /rollback-check ─────────────────────────────────────────────────────

describe("GET /api/ollama/governance/rollback-check", () => {
  it("retorna rollbackNeeded:false quando modelo homologado", async () => {
    (OllamaGovernanceService.checkAndAlertRollback as jest.Mock).mockResolvedValue({
      rollbackNeeded: false,
      currentModel: "llama3.2",
      homologatedModel: "llama3.2",
      reason: "Modelo homologado.",
    });
    const res = await request(app).get("/api/ollama/governance/rollback-check");
    expect(res.status).toBe(200);
    expect(res.body.rollbackNeeded).toBe(false);
  });

  it("retorna rollbackNeeded:true quando modelo não homologado", async () => {
    (OllamaGovernanceService.checkAndAlertRollback as jest.Mock).mockResolvedValue({
      rollbackNeeded: true,
      currentModel: "gpt-4",
      homologatedModel: "llama3.2",
      reason: "Modelo não consta na matriz.",
    });
    const res = await request(app).get("/api/ollama/governance/rollback-check");
    expect(res.status).toBe(200);
    expect(res.body.rollbackNeeded).toBe(true);
  });

  it("retorna 500 em caso de erro", async () => {
    (OllamaGovernanceService.checkAndAlertRollback as jest.Mock).mockRejectedValue(
      new Error("falha"),
    );
    const res = await request(app).get("/api/ollama/governance/rollback-check");
    expect(res.status).toBe(500);
  });
});
