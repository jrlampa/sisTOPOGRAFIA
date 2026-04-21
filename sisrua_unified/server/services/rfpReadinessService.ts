/**
 * rfpReadinessService.ts — Prontidão para RFP/RFI (Cloud/Legal/Risk) (117 [T1])
 *
 * Responsabilidades:
 * - Biblioteca de respostas técnicas padronizadas para questionários RFP/RFI.
 * - Arquivo de referência de arquitetura exportável.
 * - Busca full-text por categoria e palavras-chave.
 * - Geração de Perfil de Prontidão resumindo cobertura por categoria.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type RfpCategory =
  | "seguranca"
  | "cloud"
  | "dados_privacidade"
  | "continuidade"
  | "conformidade_regulatoria"
  | "integracao"
  | "desempenho"
  | "suporte"
  | "licenciamento"
  | "arquitetura";

export interface RfpQuestion {
  id: string;
  category: RfpCategory;
  question: string;
  answer: string;
  tags: string[];
  updatedAt: string;
}

export interface ArchitectureRef {
  component: string;
  technology: string;
  purpose: string;
  tier: "frontend" | "backend" | "dados" | "infra" | "seguranca";
  cloudCompatible: boolean;
  onPremCompatible: boolean;
}

// ─── Biblioteca pré-semeada ───────────────────────────────────────────────────

const RFP_LIBRARY: RfpQuestion[] = [
  // SEGURANÇA
  {
    id: "rfp-sec-001",
    category: "seguranca",
    question: "O sistema suporta autenticação multifator (MFA)?",
    answer:
      "Sim. O sisTOPOGRAFIA suporta MFA via integração OAuth 2.0/OIDC com provedores externos (ex: Google, Azure AD, Gov.br). O módulo de autenticação (IAM) implementa TOTP e SMS como fatores adicionais via middleware configurável.",
    tags: ["mfa", "autenticação", "iam", "oauth"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rfp-sec-002",
    category: "seguranca",
    question: "Como são gerenciados e auditados os acessos privilegiados?",
    answer:
      "Controle de acesso granular via ABAC/RBAC com política contextual. Todos os acessos privilegiados são auditados em trilha write-once com contexto geográfico, IP, dispositivo e identidade. Suporte a recertificação periódica de acesso (Item 31 — módulo accessRecertificationService).",
    tags: ["rbac", "abac", "auditoria", "acesso privilegiado"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rfp-sec-003",
    category: "seguranca",
    question: "Existe gestão formal de vulnerabilidades com SLA de correção?",
    answer:
      "Sim. Pipeline automatizado de varredura de dependências (SBOM + npm audit) com SLA de correção por CVSS: Crítico ≤7d, Alto ≤30d, Médio ≤90d, Baixo ≤180d. Relatórios de conformidade disponíveis via API /api/vuln-management.",
    tags: ["vulnerabilidades", "cvss", "sbom", "sla"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // CLOUD
  {
    id: "rfp-cld-001",
    category: "cloud",
    question: "Quais provedores de nuvem são suportados?",
    answer:
      "Google Cloud Platform (GCP) como plataforma primária (Cloud Tasks, Cloud Run, Supabase/PostgreSQL gerenciado). AWS e Azure compatíveis via abstração de fila e containerização Docker/Kubernetes. O sistema é cloud-agnostic desde que o banco de dados PostgreSQL ≥14 e fila de jobs sejam provisionados.",
    tags: ["gcp", "aws", "azure", "cloud", "docker"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rfp-cld-002",
    category: "cloud",
    question: "O sistema pode operar em modo on-premise ou híbrido?",
    answer:
      "Sim. Modo on-premise suportado com Docker Compose + PostgreSQL local + workers Python locais. Modo híbrido combina controle local com storage cloud opcional. Documentação de implantação incluída no pacote de homologação enterprise.",
    tags: ["on-premise", "híbrido", "docker", "postgresql"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // DADOS E PRIVACIDADE
  {
    id: "rfp-prv-001",
    category: "dados_privacidade",
    question: "O sistema está em conformidade com a LGPD?",
    answer:
      "Sim. Implementação completa de LGPD: registro de finalidade de tratamento, consentimento e revogação, DPO configurável, retenção configurável por tipo de dado, anonimização e exportação de dados do titular, e dossiê regulatório exportável. Módulo: lgpdRetencaoService.",
    tags: ["lgpd", "privacidade", "dpd", "consentimento"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rfp-prv-002",
    category: "dados_privacidade",
    question: "Como são protegidos os dados em repouso e em trânsito?",
    answer:
      "Dados em trânsito: TLS 1.2+ obrigatório em todos os endpoints. Dados em repouso: criptografia gerenciada pelo provedor de banco de dados (PostgreSQL/Supabase) com backups cifrados. Suporte a master keys cliente (AES-256-GCM) via encryptionAtRestService para dados sensíveis de projeto.",
    tags: ["criptografia", "tls", "aes-256", "repouso"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // CONTINUIDADE
  {
    id: "rfp-cnt-001",
    category: "continuidade",
    question: "Quais são os targets de RTO e RPO?",
    answer:
      "RTO (Recovery Time Objective): ≤4h para ambiente de produção principal. RPO (Recovery Point Objective): ≤1h com backups incrementais a cada 60 minutos. Suporte a circuit breakers para APIs externas e self-healing automático de workers Python (OOM/crash).",
    tags: ["rto", "rpo", "backup", "continuidade"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // CONFORMIDADE REGULATÓRIA
  {
    id: "rfp-reg-001",
    category: "conformidade_regulatoria",
    question: "O sistema suporta exportação no formato BDGD (ANEEL)?",
    answer:
      "Sim. Módulo nativo de exportação e validação BDGD conforme normas ANEEL. Inclui dossiê regulatório com cadeia de custódia e proveniência técnica por entrega, exportável para fiscalização. Módulo: bdgdService + Dossiê ANEEL.",
    tags: ["aneel", "bdgd", "regulatório", "exportação"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rfp-reg-002",
    category: "conformidade_regulatoria",
    question: "Existe trilha de auditoria forense exportável?",
    answer:
      "Sim. Trilha write-once com contexto multicamada (geográfico, dispositivo, IP, identidade). Exportável em formato JSON/SIEM (Syslog). Integração com SIEMs externos via webhook configurável. Módulo: auditRoutes + audit_context_siem migration.",
    tags: ["auditoria", "forense", "siem", "write-once"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // INTEGRAÇÃO
  {
    id: "rfp-int-001",
    category: "integracao",
    question: "O sistema oferece API REST documentada?",
    answer:
      "Sim. API REST com ≥50 endpoints documentados via OpenAPI/Swagger. Autenticação via JWT Bearer Token. Versionamento de API. Rate limiting configurável por tenant. Schemas validados com Zod em todos os endpoints de escrita.",
    tags: ["api", "rest", "openapi", "swagger", "jwt"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // DESEMPENHO
  {
    id: "rfp-prf-001",
    category: "desempenho",
    question: "Qual é a capacidade de processamento simultâneo de jobs DXF?",
    answer:
      "Capacity planning documentado: capacidade alvo de 50 jobs DXF simultâneos por instância. Escalonamento horizontal via Cloud Tasks/fila distribuída. Self-healing automático de workers com OOM. Testes de carga periódicos via capacityPlanningService.",
    tags: ["desempenho", "jobs", "dxf", "capacidade"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // SUPORTE
  {
    id: "rfp-sup-001",
    category: "suporte",
    question: "Qual o modelo de suporte oferecido?",
    answer:
      "Modelo L1/L2/L3: L1 (triagem, SLA 30min crítico), L2 (engenharia, SLA 2h crítico), L3 (especialista, SLA 4h crítico). Runbooks operacionais padronizados para incidentes conhecidos. SLA contratual por fluxo crítico com penalidades definidas.",
    tags: ["suporte", "sla", "l1", "l2", "l3", "runbook"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  // ARQUITETURA
  {
    id: "rfp-arq-001",
    category: "arquitetura",
    question: "Qual a arquitetura técnica do sistema?",
    answer:
      "Frontend: React 18 + TypeScript + Vite. Backend: Node.js + Express + TypeScript. Motor geoespacial: Python 3.11+ (ezdxf, Shapely, GDAL). Banco de dados: PostgreSQL 14+ (Supabase). Filas: Google Cloud Tasks ou equivalente. Containerização: Docker + Docker Compose. Padrão de testes: Vitest (frontend) + Jest + Supertest (backend).",
    tags: ["arquitetura", "react", "node", "python", "postgresql", "docker"],
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const ARCHITECTURE_REFS: ArchitectureRef[] = [
  { component: "Frontend SPA", technology: "React 18 + TypeScript + Vite", purpose: "Interface web responsiva para projeto geoespacial", tier: "frontend", cloudCompatible: true, onPremCompatible: true },
  { component: "API Gateway / BFF", technology: "Node.js + Express + TypeScript", purpose: "Backend-for-Frontend, roteamento e validação", tier: "backend", cloudCompatible: true, onPremCompatible: true },
  { component: "Motor Python DXF", technology: "Python 3.11 + ezdxf + Shapely", purpose: "Geração de artefatos CAD/DXF e cálculo BT", tier: "backend", cloudCompatible: true, onPremCompatible: true },
  { component: "Banco de Dados", technology: "PostgreSQL 14+ (Supabase)", purpose: "Persistência de projetos, auditoria e jobs", tier: "dados", cloudCompatible: true, onPremCompatible: true },
  { component: "Fila de Jobs", technology: "Google Cloud Tasks / Docker Queue", purpose: "Processamento assíncrono de exports DXF", tier: "infra", cloudCompatible: true, onPremCompatible: true },
  { component: "Autenticação", technology: "JWT + OAuth 2.0 / OIDC", purpose: "IAM com ABAC/RBAC contextual", tier: "seguranca", cloudCompatible: true, onPremCompatible: true },
  { component: "Armazenamento de Objetos", technology: "GCS / MinIO (on-prem)", purpose: "Artefatos DXF e relatórios exportados", tier: "dados", cloudCompatible: true, onPremCompatible: true },
  { component: "Observabilidade", technology: "Structured Logging (JSON) + metricsService", purpose: "SLA, KPIs, anomaly detection", tier: "infra", cloudCompatible: true, onPremCompatible: true },
];

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class RfpReadinessService {
  /** Retorna toda a biblioteca RFP. */
  static getLibrary(category?: RfpCategory): RfpQuestion[] {
    if (category) {
      return RFP_LIBRARY.filter((q) => q.category === category);
    }
    return [...RFP_LIBRARY];
  }

  /** Busca por texto livre em pergunta, resposta ou tags. */
  static search(query: string): RfpQuestion[] {
    const q = query.toLowerCase();
    return RFP_LIBRARY.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q)),
    );
  }

  /** Retorna referência de arquitetura. */
  static getArchitectureRef(tier?: ArchitectureRef["tier"]): ArchitectureRef[] {
    if (tier) return ARCHITECTURE_REFS.filter((r) => r.tier === tier);
    return [...ARCHITECTURE_REFS];
  }

  /**
   * Perfil de Prontidão: cobertura de respostas por categoria.
   * Útil para medir quão bem coberto está o sistema para um RFP.
   */
  static getReadinessProfile(): {
    totalQuestions: number;
    byCategory: Record<
      RfpCategory,
      { count: number; coveragePct: number }
    >;
    overallCoverage: number;
  } {
    const categories: RfpCategory[] = [
      "seguranca",
      "cloud",
      "dados_privacidade",
      "continuidade",
      "conformidade_regulatoria",
      "integracao",
      "desempenho",
      "suporte",
      "licenciamento",
      "arquitetura",
    ];

    /** Número esperado de questões por categoria para cobertura completa. */
    const EXPECTED_PER_CATEGORY = 5;

    const byCategory = {} as Record<
      RfpCategory,
      { count: number; coveragePct: number }
    >;

    for (const cat of categories) {
      const count = RFP_LIBRARY.filter((q) => q.category === cat).length;
      byCategory[cat] = {
        count,
        coveragePct: Math.min(count / EXPECTED_PER_CATEGORY, 1),
      };
    }

    const overallCoverage =
      Object.values(byCategory).reduce((sum, v) => sum + v.coveragePct, 0) /
      categories.length;

    return {
      totalQuestions: RFP_LIBRARY.length,
      byCategory,
      overallCoverage: Math.round(overallCoverage * 100) / 100,
    };
  }
}
