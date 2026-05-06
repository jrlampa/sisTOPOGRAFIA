/**
 * modelRetrocompatService.ts — Retrocompatibilidade de Modelos e Prompts (14B [T1])
 *
 * Responsabilidades:
 * - Manter matriz de compatibilidade por versão de modelo LLM.
 * - Verificar se um prompt/template é compatível com uma versão de modelo.
 * - Fornecer modelo de fallback quando versão solicitada não está disponível.
 * - Registrar política de depreciação e alertas de migração.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ModelProvider = "ollama" | "openai" | "anthropic" | "local";

export type ModelStatus = "stable" | "deprecated" | "experimental" | "removed";

export interface ModelVersion {
  id: string;
  provider: ModelProvider;
  name: string;
  version: string;
  status: ModelStatus;
  releasedAt: string;
  deprecatedAt?: string;
  removedAt?: string;
  replacedBy?: string;
  capabilities: ModelCapability[];
  maxContextTokens: number;
  supportsJsonMode: boolean;
  supportsSystemPrompt: boolean;
}

export type ModelCapability =
  | "text-generation"
  | "code-generation"
  | "function-calling"
  | "vision"
  | "embedding"
  | "reasoning";

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  compatibleModels: string[];   // IDs de ModelVersion
  systemPrompt?: string;
  userPromptTemplate: string;
  requiredCapabilities: ModelCapability[];
  createdAt: string;
  deprecatedAt?: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  modelId: string;
  promptTemplateId: string;
  missingCapabilities: ModelCapability[];
  warnings: string[];
  suggestedFallback?: string;
}

export interface DeprecationAlert {
  modelId: string;
  modelName: string;
  status: ModelStatus;
  deprecatedAt?: string;
  removedAt?: string;
  replacedBy?: string;
  daysUntilRemoval?: number;
  migratePrompt: string;
}

// ─── Catálogo de modelos ──────────────────────────────────────────────────────

const MODEL_CATALOG: ModelVersion[] = [
  // Ollama (modelos locais)
  {
    id: "ollama-llama3.2-3b",
    provider: "ollama",
    name: "llama3.2",
    version: "3.2",
    status: "stable",
    releasedAt: "2024-09-01",
    capabilities: ["text-generation", "code-generation", "reasoning"],
    maxContextTokens: 128000,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    id: "ollama-llama3.1-8b",
    provider: "ollama",
    name: "llama3.1",
    version: "3.1",
    status: "stable",
    releasedAt: "2024-07-01",
    capabilities: ["text-generation", "code-generation", "function-calling", "reasoning"],
    maxContextTokens: 131072,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  {
    id: "ollama-llama3-8b",
    provider: "ollama",
    name: "llama3",
    version: "3.0",
    status: "deprecated",
    releasedAt: "2024-04-01",
    deprecatedAt: "2025-01-01",
    removedAt: "2025-07-01",
    replacedBy: "ollama-llama3.2-3b",
    capabilities: ["text-generation", "code-generation"],
    maxContextTokens: 8192,
    supportsJsonMode: false,
    supportsSystemPrompt: true,
  },
  {
    id: "ollama-llama2-7b",
    provider: "ollama",
    name: "llama2",
    version: "2.0",
    status: "removed",
    releasedAt: "2023-07-01",
    deprecatedAt: "2024-01-01",
    removedAt: "2024-12-01",
    replacedBy: "ollama-llama3.2-3b",
    capabilities: ["text-generation"],
    maxContextTokens: 4096,
    supportsJsonMode: false,
    supportsSystemPrompt: false,
  },
  {
    id: "ollama-mistral-7b",
    provider: "ollama",
    name: "mistral",
    version: "0.3",
    status: "stable",
    releasedAt: "2024-05-01",
    capabilities: ["text-generation", "code-generation", "function-calling"],
    maxContextTokens: 32768,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  // Modo experimental
  {
    id: "ollama-deepseek-r1",
    provider: "ollama",
    name: "deepseek-r1",
    version: "1.0",
    status: "experimental",
    releasedAt: "2025-01-01",
    capabilities: ["text-generation", "code-generation", "reasoning"],
    maxContextTokens: 65536,
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
];

// ─── Catálogo de templates de prompt ─────────────────────────────────────────

const PROMPT_CATALOG: PromptTemplate[] = [
  {
    id: "pt-dg-analysis-v1",
    name: "Análise de Grafo DG",
    version: "1.0",
    compatibleModels: [
      "ollama-llama3.2-3b",
      "ollama-llama3.1-8b",
      "ollama-mistral-7b",
      "ollama-deepseek-r1",
    ],
    systemPrompt:
      "Você é um especialista em análise de grafos viários para serviços de telecomunicações urbanas.",
    userPromptTemplate:
      "Analise o grafo de ruas com {nodeCount} nós e {edgeCount} arestas. Identifique gargalos e sugira otimizações.",
    requiredCapabilities: ["text-generation", "reasoning"],
    createdAt: "2025-01-01",
  },
  {
    id: "pt-dxf-summary-v1",
    name: "Resumo de Projeto DXF",
    version: "1.0",
    compatibleModels: [
      "ollama-llama3.2-3b",
      "ollama-llama3.1-8b",
      "ollama-mistral-7b",
    ],
    systemPrompt: "Você é um especialista em projetos de implantação de cabos em DXF/CAD.",
    userPromptTemplate:
      "Resuma o projeto DXF com {cablesCount} cabos e {totalLengthKm} km de extensão total.",
    requiredCapabilities: ["text-generation"],
    createdAt: "2025-01-01",
  },
  {
    id: "pt-json-extraction-v1",
    name: "Extração JSON Estruturada",
    version: "1.0",
    compatibleModels: [
      "ollama-llama3.1-8b",
      "ollama-mistral-7b",
      "ollama-deepseek-r1",
    ],
    userPromptTemplate:
      "Extraia as informações do texto a seguir em formato JSON: {inputText}",
    requiredCapabilities: ["text-generation", "function-calling"],
    createdAt: "2025-02-01",
  },
];

// ─── Funções de consulta ──────────────────────────────────────────────────────

export function getModelById(modelId: string): ModelVersion | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

export function getActiveModels(): ModelVersion[] {
  return MODEL_CATALOG.filter((m) => m.status !== "removed");
}

export function getStableModels(): ModelVersion[] {
  return MODEL_CATALOG.filter((m) => m.status === "stable");
}

export function getFallbackModel(modelId: string): ModelVersion | undefined {
  const model = getModelById(modelId);
  if (!model) return getStableModels()[0];
  if (model.replacedBy) return getModelById(model.replacedBy);
  // Se não há substituto explícito, retorna o primeiro stable do mesmo provider
  return MODEL_CATALOG.find(
    (m) => m.provider === model.provider && m.status === "stable" && m.id !== modelId
  );
}

export function checkCompatibility(
  modelId: string,
  promptTemplateId: string
): CompatibilityResult {
  const model = getModelById(modelId);
  const template = PROMPT_CATALOG.find((p) => p.id === promptTemplateId);

  if (!model) {
    return {
      compatible: false,
      modelId,
      promptTemplateId,
      missingCapabilities: [],
      warnings: [`Modelo '${modelId}' não encontrado no catálogo.`],
      suggestedFallback: getStableModels()[0]?.id,
    };
  }

  if (!template) {
    return {
      compatible: false,
      modelId,
      promptTemplateId,
      missingCapabilities: [],
      warnings: [`Template de prompt '${promptTemplateId}' não encontrado.`],
    };
  }

  const warnings: string[] = [];

  // Verifica status do modelo
  if (model.status === "removed") {
    return {
      compatible: false,
      modelId,
      promptTemplateId,
      missingCapabilities: [],
      warnings: [`Modelo '${model.name} v${model.version}' foi removido. Use '${model.replacedBy ?? "modelo alternativo"}'.`],
      suggestedFallback: model.replacedBy ?? getFallbackModel(modelId)?.id,
    };
  }

  if (model.status === "deprecated") {
    warnings.push(
      `Modelo '${model.name} v${model.version}' está depreciado e será removido em ${model.removedAt ?? "data indefinida"}. Migre para '${model.replacedBy ?? "versão mais recente"}'.`
    );
  }

  if (model.status === "experimental") {
    warnings.push(
      `Modelo '${model.name} v${model.version}' é experimental. Não recomendado para produção.`
    );
  }

  // Verifica capabilities
  const missingCapabilities = template.requiredCapabilities.filter(
    (cap) => !model.capabilities.includes(cap)
  );

  // Verifica se o modelo está na lista de compatíveis do template
  const explicitlyCompatible = template.compatibleModels.includes(modelId);
  if (!explicitlyCompatible && missingCapabilities.length === 0) {
    warnings.push(
      `Modelo '${modelId}' não está na lista de modelos testados para este template, mas possui as capacidades necessárias.`
    );
  }

  const compatible = missingCapabilities.length === 0;

  return {
    compatible,
    modelId,
    promptTemplateId,
    missingCapabilities,
    warnings,
    suggestedFallback: compatible ? undefined : (model.replacedBy ?? getFallbackModel(modelId)?.id),
  };
}

export function getDeprecationAlerts(): DeprecationAlert[] {
  const now = new Date();

  return MODEL_CATALOG.filter((m) => m.status === "deprecated" || m.status === "removed").map(
    (m) => {
      const removedAtDate = m.removedAt ? new Date(m.removedAt) : null;
      const daysUntilRemoval = removedAtDate
        ? Math.max(0, Math.ceil((removedAtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : undefined;

      return {
        modelId: m.id,
        modelName: `${m.name} v${m.version}`,
        status: m.status,
        deprecatedAt: m.deprecatedAt,
        removedAt: m.removedAt,
        replacedBy: m.replacedBy,
        daysUntilRemoval,
        migratePrompt: m.replacedBy
          ? `Substitua todas as referências a '${m.id}' por '${m.replacedBy}'.`
          : `Modifique a integração para usar um modelo ${m.provider} com status 'stable'.`,
      };
    }
  );
}

export function getPromptTemplateById(templateId: string): PromptTemplate | undefined {
  return PROMPT_CATALOG.find((p) => p.id === templateId);
}

export function getAllPromptTemplates(): PromptTemplate[] {
  return PROMPT_CATALOG;
}
