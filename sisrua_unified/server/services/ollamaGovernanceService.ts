/**
 * ollamaGovernanceService.ts — Governança de Runtime Ollama Zero-Custo (14A [T1])
 *                              Retrocompatibilidade de Modelos e Prompts (14B [T1])
 *
 * Responsabilidades:
 * - 14A: Verificação periódica de saúde/versão, janela de manutenção, rollback,
 *         bloqueio de custo monetário.
 * - 14B: Matriz de compatibilidade por versão de modelo, testes de regressão de
 *         prompts, fallback para modelo homologado, política de depreciação gradual.
 */

import { OllamaService } from "./ollamaService.js";
import { logger } from "../utils/logger.js";

// ─── Tipos exportados ────────────────────────────────────────────────────────

/** Status de um modelo na matriz de compatibilidade. */
export type ModelStatus = "ativo" | "depreciado" | "em_teste" | "bloqueado";

/** Entrada da matriz de compatibilidade. */
export interface ModelCompatEntry {
  /** Nome canônico do modelo (ex: "llama3.2"). */
  modelName: string;
  /** Versões do Ollama com as quais o modelo foi testado. */
  testedWithOllamaVersions: string[];
  /** Status atual do modelo nesta instalação. */
  status: ModelStatus;
  /** Data de depreciação planejada (ISO 8601) ou null se não planejada. */
  deprecationDate: string | null;
  /** Capacidades verificadas. */
  capabilities: {
    jsonMode: boolean;
    contextWindow: number;
    ptBrSupport: boolean;
  };
  /** Notas de operação. */
  notes: string;
}

/** Caso de teste de regressão de prompt. */
export interface PromptRegressionCase {
  id: string;
  description: string;
  prompt: string;
  /** Substring que deve estar presente na resposta para o teste passar. */
  expectedContains: string;
  /** Modelo alvo do teste (se null, usa modelo selecionado atualmente). */
  targetModel: string | null;
}

/** Resultado de um caso de teste de regressão. */
export interface PromptRegressionResult {
  caseId: string;
  description: string;
  passed: boolean;
  responseSnippet: string;
  durationMs: number;
  error: string | null;
}

/** Relatório completo de governança. */
export interface OllamaGovernanceReport {
  generatedAt: string;
  governanceStatus: Awaited<ReturnType<typeof OllamaService.getGovernanceStatus>>;
  compatibilityMatrix: ModelCompatEntry[];
  activeModel: string;
  homologatedModel: string;
  deprecationAlerts: string[];
  zeroCostPolicy: {
    enforced: boolean;
    compliant: boolean;
    blockedReason: string | null;
  };
}

// ─── Matriz de compatibilidade canônica ─────────────────────────────────────

/** Modelos homologados para uso zero-custo local. Extensível via config. */
const COMPAT_MATRIX: ModelCompatEntry[] = [
  {
    modelName: "llama3.2",
    testedWithOllamaVersions: ["0.3.x", "0.4.x", "0.5.x"],
    status: "ativo",
    deprecationDate: null,
    capabilities: {
      jsonMode: true,
      contextWindow: 131072,
      ptBrSupport: true,
    },
    notes: "Modelo homologado principal. Zero custo. Suporte pt-BR verificado.",
  },
  {
    modelName: "llama3.1",
    testedWithOllamaVersions: ["0.3.x", "0.4.x"],
    status: "depreciado",
    deprecationDate: "2026-06-01",
    capabilities: {
      jsonMode: true,
      contextWindow: 131072,
      ptBrSupport: true,
    },
    notes: "Depreciado em favor de llama3.2. Fallback emergencial apenas.",
  },
  {
    modelName: "mistral",
    testedWithOllamaVersions: ["0.3.x"],
    status: "em_teste",
    deprecationDate: null,
    capabilities: {
      jsonMode: true,
      contextWindow: 32768,
      ptBrSupport: true,
    },
    notes: "Em avaliação como alternativa leve. Não usar em produção.",
  },
];

/** Modelo homologado primário (fallback final). */
const HOMOLOGATED_MODEL = "llama3.2";

// ─── Casos de regressão de prompt padrão ────────────────────────────────────

const DEFAULT_REGRESSION_CASES: PromptRegressionCase[] = [
  {
    id: "ptbr-json-response",
    description: "Resposta JSON válida em pt-BR com análise urbana",
    prompt:
      'Responda SOMENTE com JSON válido: {"analysis":"<resumo>"}. Área: "Teste". Dados: {"buildings":10,"roads":5}. Resumo curto em pt-BR.',
    expectedContains: "analysis",
    targetModel: null,
  },
  {
    id: "json-format-compliance",
    description: "Modelo retorna JSON estruturado sem markdown",
    prompt:
      'Retorne APENAS JSON sem markdown: {"status":"ok","valor":42}. Nenhum texto adicional.',
    expectedContains: "status",
    targetModel: null,
  },
  {
    id: "ptbr-language-check",
    description: "Resposta em português brasileiro",
    prompt:
      'Responda em português: {"resposta":"<uma palavra em português>"}. Apenas JSON.',
    expectedContains: "resposta",
    targetModel: null,
  },
];

// ─── Serviço ─────────────────────────────────────────────────────────────────

export class OllamaGovernanceService {
  /**
   * Retorna a matriz de compatibilidade completa.
   */
  static getCompatibilityMatrix(): ModelCompatEntry[] {
    return structuredClone(COMPAT_MATRIX);
  }

  /**
   * Retorna a entrada da matriz para um modelo específico ou null se não catalogado.
   */
  static getModelEntry(modelName: string): ModelCompatEntry | null {
    const normalized = modelName.trim().toLowerCase();
    return (
      COMPAT_MATRIX.find(
        (entry) => entry.modelName.toLowerCase() === normalized,
      ) ?? null
    );
  }

  /**
   * Verifica se o modelo está homologado (ativo ou em_teste) para uso.
   */
  static isModelHomologated(modelName: string): {
    homologated: boolean;
    reason: string;
  } {
    const entry = this.getModelEntry(modelName);
    if (!entry) {
      return {
        homologated: false,
        reason: `Modelo '${modelName}' não consta na matriz de compatibilidade homologada.`,
      };
    }
    if (entry.status === "bloqueado") {
      return {
        homologated: false,
        reason: `Modelo '${modelName}' está bloqueado por política de governança.`,
      };
    }
    if (entry.status === "depreciado") {
      return {
        homologated: true,
        reason: `Modelo '${modelName}' está depreciado (deprecação: ${entry.deprecationDate ?? "indefinido"}). Use como emergência apenas.`,
      };
    }
    return {
      homologated: true,
      reason: `Modelo '${modelName}' está homologado (status: ${entry.status}).`,
    };
  }

  /**
   * Verifica alertas de depreciação iminente (nos próximos 30 dias).
   */
  static getDeprecationAlerts(daysAhead = 30): string[] {
    const alerts: string[] = [];
    const now = new Date();
    const threshold = new Date(
      now.getTime() + daysAhead * 24 * 60 * 60 * 1000,
    );

    for (const entry of COMPAT_MATRIX) {
      if (entry.deprecationDate) {
        const deprecationAt = new Date(entry.deprecationDate);
        if (deprecationAt <= threshold && deprecationAt > now) {
          const daysLeft = Math.ceil(
            (deprecationAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          );
          alerts.push(
            `Modelo '${entry.modelName}' será depreciado em ${daysLeft} dia(s) (${entry.deprecationDate}). Migrar para modelo ativo.`,
          );
        }
        if (deprecationAt <= now) {
          alerts.push(
            `Modelo '${entry.modelName}' passou da data de depreciação (${entry.deprecationDate}). Remover uso imediato.`,
          );
        }
      }
    }
    return alerts;
  }

  /**
   * Gera relatório completo de governança (14A + 14B).
   */
  static async getGovernanceReport(): Promise<OllamaGovernanceReport> {
    const governanceStatus = await OllamaService.getGovernanceStatus();
    const activeModel = governanceStatus.runtime.selectedModel;
    const deprecationAlerts = this.getDeprecationAlerts();
    const homologationCheck = this.isModelHomologated(activeModel);

    return {
      generatedAt: new Date().toISOString(),
      governanceStatus,
      compatibilityMatrix: this.getCompatibilityMatrix(),
      activeModel,
      homologatedModel: HOMOLOGATED_MODEL,
      deprecationAlerts,
      zeroCostPolicy: {
        enforced: governanceStatus.runtime.zeroCostEnforced,
        compliant: governanceStatus.runtime.zeroCostCompliant,
        blockedReason: homologationCheck.homologated
          ? null
          : homologationCheck.reason,
      },
    };
  }

  /**
   * Executa testes de regressão de prompt contra o modelo ativo.
   * Retorna lista de resultados por caso de teste.
   *
   * @param cases - Casos de teste. Se omitido, usa os casos padrão.
   * @param timeoutMs - Timeout por prompt em ms (padrão 30s).
   */
  static async runPromptRegression(
    cases: PromptRegressionCase[] = DEFAULT_REGRESSION_CASES,
    timeoutMs = 30_000,
  ): Promise<PromptRegressionResult[]> {
    const runtime = await OllamaService.getRuntimeStatus();

    if (!runtime.zeroCostCompliant || !runtime.available) {
      return cases.map((c) => ({
        caseId: c.id,
        description: c.description,
        passed: false,
        responseSnippet: "",
        durationMs: 0,
        error: "Ollama indisponível ou fora da política zero-custo.",
      }));
    }

    const results: PromptRegressionResult[] = [];

    for (const testCase of cases) {
      const model = testCase.targetModel ?? runtime.selectedModel;
      const start = Date.now();
      let passed = false;
      let responseSnippet = "";
      let error: string | null = null;

      try {
        const response = await fetch(
          `${(await OllamaService.getGovernanceStatus()).runtime.host}/api/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              prompt: testCase.prompt,
              stream: false,
              options: { temperature: 0 },
            }),
            signal: AbortSignal.timeout(timeoutMs),
          },
        );

        if (response.ok) {
          const data = (await response.json()) as { response?: string };
          const text = data.response ?? "";
          responseSnippet = text.slice(0, 200);
          passed = text.toLowerCase().includes(testCase.expectedContains.toLowerCase());
        } else {
          error = `HTTP ${response.status}`;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        logger.warn(`[OllamaGovernance] Regressão '${testCase.id}' falhou`, {
          error,
        });
      }

      results.push({
        caseId: testCase.id,
        description: testCase.description,
        passed,
        responseSnippet,
        durationMs: Date.now() - start,
        error,
      });
    }

    return results;
  }

  /**
   * Verifica se o modelo ativo é o homologado; se não, loga alerta de rollback.
   * Não força rollback automático (requer intervenção humana por segurança).
   */
  static async checkAndAlertRollback(): Promise<{
    rollbackNeeded: boolean;
    currentModel: string;
    homologatedModel: string;
    reason: string;
  }> {
    const runtime = await OllamaService.getRuntimeStatus();
    const current = runtime.selectedModel;
    const check = this.isModelHomologated(current);

    if (!check.homologated) {
      logger.warn(
        `[OllamaGovernance] Rollback necessário: modelo '${current}' não homologado. Modelo estável: '${HOMOLOGATED_MODEL}'.`,
      );
      return {
        rollbackNeeded: true,
        currentModel: current,
        homologatedModel: HOMOLOGATED_MODEL,
        reason: check.reason,
      };
    }

    return {
      rollbackNeeded: false,
      currentModel: current,
      homologatedModel: HOMOLOGATED_MODEL,
      reason: check.reason,
    };
  }
}
