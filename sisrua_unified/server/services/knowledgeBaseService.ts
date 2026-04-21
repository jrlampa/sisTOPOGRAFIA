/**
 * knowledgeBaseService.ts — Base de Conhecimento Forense (119 [T1])
 *
 * Responsabilidades:
 * - Catálogo de artigos forenses: problemas conhecidos, causas-raiz e soluções.
 * - Histórico de resoluções para auditoria interna e investigações.
 * - Busca por categoria, severidade e tags.
 * - Geração de relatório de incidents recorrentes para prevenção proativa.
 */

import { logger } from "../utils/logger.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type KbCategory =
  | "exportacao_dxf"
  | "calculo_bt"
  | "autenticacao"
  | "banco_de_dados"
  | "integracao_api"
  | "seguranca"
  | "desempenho"
  | "infraestrutura"
  | "conformidade"
  | "python_worker";

export type KbSeverity = "critica" | "alta" | "media" | "baixa" | "informativa";

export interface KbArticle {
  id: string;
  title: string;
  category: KbCategory;
  severity: KbSeverity;
  /** Descrição do problema/sintoma. */
  problem: string;
  /** Causa-raiz identificada. */
  rootCause: string;
  /** Solução ou workaround aplicado. */
  solution: string;
  /** Passos de verificação pós-resolução. */
  verificationSteps: string[];
  /** Referências (commits, tickets, docs externos). */
  references: string[];
  /** Tags de busca. */
  tags: string[];
  /** Número de vezes que o problema recorreu. */
  occurrenceCount: number;
  /** Data da primeira ocorrência conhecida. */
  firstSeenAt: string;
  /** Data da última ocorrência. */
  lastSeenAt: string;
  /** Indica se tem prevenção automatizada implementada. */
  preventionAutomated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Catálogo pré-semeado com incidentes reais conhecidos ─────────────────────

const KB_CATALOG: KbArticle[] = [
  {
    id: "kb-dxf-001",
    title: "Worker Python OOM em job DXF com >10.000 pontos",
    category: "exportacao_dxf",
    severity: "alta",
    problem:
      "Worker Python termina com MemoryError (OOM kill) ao processar projetos com mais de 10.000 pontos de levantamento.",
    rootCause:
      "Carregamento integral do shapefile em memória sem streaming. Geometria não dividida em chunks.",
    solution:
      "1. Ajuste de PYTHON_WORKER_MEMORY_MB=1024 em variáveis de ambiente. 2. Implementação de chunking em dxf_generator.py para processar por lotes de 2.000 pontos. 3. Self-healing automático via pythonBridge.ts com retry exponencial.",
    verificationSteps: [
      "Executar job com 12.000 pontos e verificar conclusão sem OOM.",
      "Checar logs de pythonBridge.ts por mensagens de retry.",
      "Verificar métricas de memória do worker no painel de observabilidade.",
    ],
    references: [
      "server/pythonBridge.ts (OOM self-healing)",
      "py_engine/dxf_generator.py (chunking)",
      "BATCH_5_IMPLEMENTATION_SUMMARY.md",
    ],
    tags: ["oom", "python", "dxf", "memória", "worker"],
    occurrenceCount: 3,
    firstSeenAt: "2026-02-10T14:00:00.000Z",
    lastSeenAt: "2026-03-25T09:30:00.000Z",
    preventionAutomated: true,
    createdAt: "2026-02-10T18:00:00.000Z",
    updatedAt: "2026-03-26T10:00:00.000Z",
  },
  {
    id: "kb-auth-001",
    title: "JWT expirado retorna 500 em vez de 401",
    category: "autenticacao",
    severity: "media",
    problem:
      "Token JWT vencido causa Internal Server Error (500) em endpoints protegidos em vez de retornar 401 Unauthorized.",
    rootCause:
      "Middleware de autenticação não capturava JsonWebTokenError corretamente. Erro propagava ao handler genérico de erros.",
    solution:
      "Adicionada captura explícita de JsonWebTokenError e TokenExpiredError no middleware authMiddleware.ts, retornando 401 com mensagem padronizada em pt-BR.",
    verificationSteps: [
      "Enviar requisição com token expirado e verificar resposta HTTP 401.",
      "Verificar que o body contém { error: 'Token expirado' }.",
    ],
    references: [
      "server/middleware/authMiddleware.ts",
      "server/tests/authMiddleware.test.ts",
    ],
    tags: ["jwt", "401", "token", "autenticação", "middleware"],
    occurrenceCount: 1,
    firstSeenAt: "2026-01-15T10:00:00.000Z",
    lastSeenAt: "2026-01-15T10:00:00.000Z",
    preventionAutomated: true,
    createdAt: "2026-01-15T14:00:00.000Z",
    updatedAt: "2026-01-16T09:00:00.000Z",
  },
  {
    id: "kb-db-001",
    title: "Connection pool esgotado sob carga alta de exports simultâneos",
    category: "banco_de_dados",
    severity: "alta",
    problem:
      "Timeout de conexão ao banco de dados quando >20 jobs de export executam simultaneamente, causando falha em cascata.",
    rootCause:
      "Pool de conexões Supabase configurado com max_connections=10 (padrão). Cada job abria 2 conexões sem release adequado.",
    solution:
      "1. Aumentar max_connections no pool para 30. 2. Implementar finally-block para release de conexão em todos os repositórios. 3. Circuit breaker configurado para limitar jobs simultâneos a 15.",
    verificationSteps: [
      "Executar 20 jobs simultâneos e verificar 0 connection timeouts.",
      "Verificar métricas de pool no painel de observabilidade.",
    ],
    references: [
      "server/repositories/jobRepository.ts",
      "server/repositories/dxfTaskRepository.ts",
      "docker-compose.yml (POSTGRES_MAX_CONNECTIONS)",
    ],
    tags: ["postgresql", "pool", "conexão", "timeout", "carga"],
    occurrenceCount: 2,
    firstSeenAt: "2026-03-01T16:00:00.000Z",
    lastSeenAt: "2026-03-20T11:00:00.000Z",
    preventionAutomated: false,
    createdAt: "2026-03-01T20:00:00.000Z",
    updatedAt: "2026-03-21T08:00:00.000Z",
  },
  {
    id: "kb-sec-001",
    title: "Exposição de stack trace em resposta de erro de produção",
    category: "seguranca",
    severity: "alta",
    problem:
      "Em ambiente NODE_ENV=production, respostas de erro incluíam stack trace completo, expondo estrutura interna da aplicação.",
    rootCause:
      "Handler global de erros não verificava NODE_ENV antes de incluir stack. Padrão de desenvolvimento perpetuado em produção.",
    solution:
      "Handler global de erros (server/middleware/errorHandler.ts) modificado para omitir stack em NODE_ENV=production. Apenas message e code são retornados ao cliente.",
    verificationSteps: [
      "Provocar erro 500 em produção e verificar que resposta não contém 'stack'.",
      "Verificar que logs internos ainda capturam stack para diagnóstico.",
    ],
    references: [
      "server/middleware/errorHandler.ts",
      "SECURITY_CODE_QUALITY_AUDIT.md",
    ],
    tags: ["segurança", "stack trace", "produção", "erro", "informação sensível"],
    occurrenceCount: 1,
    firstSeenAt: "2026-01-20T09:00:00.000Z",
    lastSeenAt: "2026-01-20T09:00:00.000Z",
    preventionAutomated: true,
    createdAt: "2026-01-20T12:00:00.000Z",
    updatedAt: "2026-01-21T10:00:00.000Z",
  },
  {
    id: "kb-int-001",
    title: "Timeout na API de Geoprocessamento externo sem circuit breaker",
    category: "integracao_api",
    severity: "media",
    problem:
      "Chamadas a APIs de geoprocessamento externas sem timeout configurado causavam hang de requisições por até 120 segundos.",
    rootCause:
      "axios/fetch sem timeout explícito. APIs externas lentas bloqueavam o event loop do Express.",
    solution:
      "1. Timeout de 30s configurado em todas as chamadas a APIs externas via externalApi.ts. 2. Circuit breaker implementado com estado aberto após 3 falhas em 60s. 3. Fallback retorna dados em cache se disponível.",
    verificationSteps: [
      "Simular API externa lenta e verificar timeout em 30s.",
      "Verificar que circuit breaker abre após 3 falhas consecutivas.",
    ],
    references: [
      "server/utils/externalApi.ts",
      "server/services/metricsService.ts",
    ],
    tags: ["timeout", "api externa", "circuit breaker", "geoprocessamento"],
    occurrenceCount: 4,
    firstSeenAt: "2026-01-05T10:00:00.000Z",
    lastSeenAt: "2026-02-28T14:00:00.000Z",
    preventionAutomated: true,
    createdAt: "2026-01-06T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
  },
];

// ─── Estado em memória ────────────────────────────────────────────────────────

const articles: KbArticle[] = [...KB_CATALOG];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `kb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class KnowledgeBaseService {
  /** Retorna artigos com filtros opcionais. */
  static getArticles(filters?: {
    category?: KbCategory;
    severity?: KbSeverity;
    preventionAutomated?: boolean;
  }): KbArticle[] {
    let result = [...articles];
    if (filters?.category) {
      result = result.filter((a) => a.category === filters.category);
    }
    if (filters?.severity) {
      result = result.filter((a) => a.severity === filters.severity);
    }
    if (filters?.preventionAutomated !== undefined) {
      result = result.filter(
        (a) => a.preventionAutomated === filters.preventionAutomated,
      );
    }
    return result.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  /** Busca full-text em título, problema, solução e tags. */
  static search(query: string): KbArticle[] {
    const q = query.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.problem.toLowerCase().includes(q) ||
        a.solution.toLowerCase().includes(q) ||
        a.rootCause.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q)),
    );
  }

  /** Retorna artigo por ID. */
  static getById(id: string): KbArticle | null {
    return articles.find((a) => a.id === id) ?? null;
  }

  /** Registra novo artigo. */
  static createArticle(
    data: Omit<
      KbArticle,
      "id" | "occurrenceCount" | "createdAt" | "updatedAt"
    >,
  ): KbArticle {
    const now = new Date().toISOString();
    const article: KbArticle = {
      ...data,
      id: generateId(),
      occurrenceCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    articles.push(article);
    logger.info("[KB] Novo artigo criado", { id: article.id, title: article.title });
    return article;
  }

  /**
   * Registra nova ocorrência de um problema conhecido.
   * Atualiza lastSeenAt e incrementa occurrenceCount.
   */
  static recordOccurrence(id: string): KbArticle {
    const article = articles.find((a) => a.id === id);
    if (!article) throw new Error(`Artigo KB '${id}' não encontrado.`);
    article.occurrenceCount++;
    article.lastSeenAt = new Date().toISOString();
    article.updatedAt = new Date().toISOString();
    logger.warn("[KB] Recorrência registrada", {
      id,
      occurrenceCount: article.occurrenceCount,
    });
    return article;
  }

  /**
   * Relatório de incidentes recorrentes.
   * Identifica problemas com occurrenceCount > 1 sem prevenção automatizada.
   */
  static getRecurrenceReport(): {
    totalArticles: number;
    recurrentWithoutAutomation: KbArticle[];
    topRecurrent: KbArticle[];
    criticalWithoutPrevention: KbArticle[];
  } {
    const recurrentWithoutAutomation = articles.filter(
      (a) => a.occurrenceCount > 1 && !a.preventionAutomated,
    );
    const topRecurrent = [...articles]
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 5);
    const criticalWithoutPrevention = articles.filter(
      (a) =>
        (a.severity === "critica" || a.severity === "alta") &&
        !a.preventionAutomated,
    );

    return {
      totalArticles: articles.length,
      recurrentWithoutAutomation,
      topRecurrent,
      criticalWithoutPrevention,
    };
  }
}
