/**
 * enterpriseReadinessService.ts — Resiliência & Readiness Corporativo
 *
 * Cobre 3 itens Tier 1:
 * - 121: Hardening para Ambiente Corporativo Restritivo (proxy, TLS inspeção, antivírus)
 * - 122: Pacote de Homologação Enterprise (checklist de portas, domínios, requisitos de rede)
 * - 123: Suporte a Implantação On-Premise / Híbrida (modo isolado para clientes com alta restrição)
 */

import { logger } from "../utils/logger.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CheckStatus = "ok" | "aviso" | "falha" | "nao_aplicavel";

export interface HardeningCheck {
  id: string;
  name: string;
  category:
    | "proxy"
    | "tls"
    | "antivirus"
    | "firewall"
    | "certificados"
    | "dns"
    | "rede";
  description: string;
  status: CheckStatus;
  detail: string;
  recommendation: string | null;
}

export interface OnboardingChecklistItem {
  id: string;
  area: "rede" | "portas" | "dominios" | "certificados" | "autenticacao" | "storage" | "monitoramento";
  title: string;
  description: string;
  required: boolean;
  verified: boolean;
  verificationNote: string | null;
}

export interface DeploymentMode {
  mode: "cloud" | "on_premise" | "hibrido";
  description: string;
  requirements: string[];
  limitations: string[];
  networkDependencies: string[];
  setupGuideUrl: string;
}

export interface ProxyConfig {
  enabled: boolean;
  httpProxy: string | null;
  httpsProxy: string | null;
  noProxy: string[];
}

type ChecklistSnapshot = Pick<OnboardingChecklistItem, "id" | "verified" | "verificationNote">;

// ─── Configuração de proxy lida do ambiente ───────────────────────────────────

function readProxyConfig(): ProxyConfig {
  const httpProxy =
    process.env.HTTP_PROXY ?? process.env.http_proxy ?? null;
  const httpsProxy =
    process.env.HTTPS_PROXY ?? process.env.https_proxy ?? null;
  const noProxyRaw =
    process.env.NO_PROXY ?? process.env.no_proxy ?? "";
  return {
    enabled: !!(httpProxy || httpsProxy),
    httpProxy,
    httpsProxy,
    noProxy: noProxyRaw ? noProxyRaw.split(",").map((s) => s.trim()) : [],
  };
}

// ─── Catálogo de checklist de homologação ────────────────────────────────────

const ONBOARDING_CHECKLIST: OnboardingChecklistItem[] = [
  // REDE
  {
    id: "net-001",
    area: "rede",
    title: "Conectividade com internet (ou intranet isolada configurada)",
    description: "O servidor deve ter acesso à internet para APIs externas ou rede interna configurada para modo off-line.",
    required: true,
    verified: false,
    verificationNote: null,
  },
  {
    id: "net-002",
    area: "rede",
    title: "Proxy corporativo configurado (HTTP/HTTPS)",
    description: "Se houver proxy corporativo, definir HTTP_PROXY, HTTPS_PROXY e NO_PROXY no .env do servidor.",
    required: false,
    verified: false,
    verificationNote: null,
  },
  // PORTAS
  {
    id: "port-001",
    area: "portas",
    title: "Porta 3000 (API) liberada internamente",
    description: "A API REST do backend requer a porta 3000 TCP (configurável via PORT).",
    required: true,
    verified: false,
    verificationNote: null,
  },
  {
    id: "port-002",
    area: "portas",
    title: "Porta 5173 (Frontend Vite) liberada em dev",
    description: "Desenvolvimento local: porta 5173. Produção: servido pelo Express na porta 3000.",
    required: false,
    verified: false,
    verificationNote: null,
  },
  {
    id: "port-003",
    area: "portas",
    title: "Porta 5432 (PostgreSQL) acessível pelo backend",
    description: "Backend precisa de acesso TCP à porta 5432 do PostgreSQL (local ou remoto).",
    required: true,
    verified: false,
    verificationNote: null,
  },
  {
    id: "port-004",
    area: "portas",
    title: "Porta 443 (HTTPS externas) para APIs de geoprocessamento",
    description: "Integração com APIs externas requer saída HTTPS na porta 443.",
    required: true,
    verified: false,
    verificationNote: null,
  },
  // DOMÍNIOS
  {
    id: "dom-001",
    area: "dominios",
    title: "Acesso a supabase.io (banco de dados gerenciado)",
    description: "Se usando Supabase Cloud: *.supabase.io deve estar liberado no firewall/proxy.",
    required: false,
    verified: false,
    verificationNote: "Alternativa: PostgreSQL local não requer este domínio.",
  },
  {
    id: "dom-002",
    area: "dominios",
    title: "Acesso a storage.googleapis.com (GCS)",
    description: "Se usando Google Cloud Storage para artefatos: *.googleapis.com deve estar liberado.",
    required: false,
    verified: false,
    verificationNote: "Alternativa: MinIO on-premise ou storage local.",
  },
  // CERTIFICADOS
  {
    id: "cert-001",
    area: "certificados",
    title: "Certificado TLS válido instalado para o domínio da aplicação",
    description: "Produção requer TLS. Let's Encrypt ou certificado corporativo (PEM) aceitos.",
    required: true,
    verified: false,
    verificationNote: null,
  },
  {
    id: "cert-002",
    area: "certificados",
    title: "CA root corporativo instalado no Node.js (se TLS inspection ativo)",
    description: "Ambientes com inspeção TLS requerem NODE_EXTRA_CA_CERTS apontando para CA corporativo.",
    required: false,
    verified: false,
    verificationNote: null,
  },
  // AUTENTICAÇÃO
  {
    id: "auth-001",
    area: "autenticacao",
    title: "JWT_SECRET definido com 32+ caracteres em .env",
    description: "Variável obrigatória para autenticação. Usar secret aleatório com entropia adequada.",
    required: true,
    verified: false,
    verificationNote: null,
  },
  {
    id: "auth-002",
    area: "autenticacao",
    title: "RELEASE_SIGNING_SECRET definido para integridade de release",
    description: "Opcional mas recomendado para ambientes produtivos.",
    required: false,
    verified: false,
    verificationNote: null,
  },
  // STORAGE
  {
    id: "stor-001",
    area: "storage",
    title: "Diretório de artefatos com permissão de escrita",
    description: "O processo Node.js precisa de permissão de escrita em /tmp ou diretório configurado para artefatos temporários.",
    required: true,
    verified: false,
    verificationNote: null,
  },
  // MONITORAMENTO
  {
    id: "mon-001",
    area: "monitoramento",
    title: "Endpoint de healthcheck /health acessível pelo balanceador",
    description: "Load balancers e orquestradores devem monitorar GET /health (retorna 200 se OK).",
    required: true,
    verified: false,
    verificationNote: null,
  },
];

const ONBOARDING_CHECKLIST_BASELINE: ChecklistSnapshot[] = ONBOARDING_CHECKLIST.map((item) => ({
  id: item.id,
  verified: item.verified,
  verificationNote: item.verificationNote,
}));

// ─── Modos de implantação ─────────────────────────────────────────────────────

const DEPLOYMENT_MODES: DeploymentMode[] = [
  {
    mode: "cloud",
    description:
      "Implantação completa em nuvem pública (GCP/AWS/Azure). Alta disponibilidade, backups gerenciados, escalonamento automático.",
    requirements: [
      "Conta no provedor cloud (GCP recomendado)",
      "PostgreSQL gerenciado (Supabase ou Cloud SQL)",
      "Google Cloud Tasks ou equivalente para fila de jobs",
      "Google Cloud Storage ou equivalente para artefatos",
    ],
    limitations: ["Requer conectividade com internet"],
    networkDependencies: [
      "*.supabase.io ou *.googleapis.com",
      "storage.googleapis.com",
      "cloudtasks.googleapis.com",
    ],
    setupGuideUrl: "docs/DOCKER_USAGE.md",
  },
  {
    mode: "on_premise",
    description:
      "Implantação totalmente isolada na infraestrutura do cliente. Sem dependências de serviços cloud externos.",
    requirements: [
      "Docker Engine 24+ e Docker Compose v2",
      "PostgreSQL 14+ local ou em servidor interno",
      "Python 3.11+ com dependências instaladas off-line",
      "MinIO (storage) ou volume local para artefatos",
      "Servidor de fila local (Redis + Bull ou equivalente)",
    ],
    limitations: [
      "Backup e HA devem ser gerenciados pelo cliente",
      "Atualizações requerem pacote de atualização offline",
      "Sem integração com APIs externas de geoprocessamento por padrão",
    ],
    networkDependencies: [],
    setupGuideUrl: "docs/DOCKER_MIGRATION.md",
  },
  {
    mode: "hibrido",
    description:
      "Controle local com storage e backups opcionalmente em nuvem. Balanceia privacidade e conveniência.",
    requirements: [
      "Todos os requisitos on-premise",
      "Conectividade opcional para storage cloud",
      "VPN corporativa para separação de ambientes",
    ],
    limitations: [
      "Configuração mais complexa",
      "Requer política de sincronização de dados",
    ],
    networkDependencies: ["Opcional: *.amazonaws.com ou *.blob.core.windows.net"],
    setupGuideUrl: "docs/DOCKER_MIGRATION.md",
  },
];

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class EnterpriseReadinessService {
  // ── 121: Hardening corporativo ────────────────────────────────────────────

  /** Executa verificações de hardening para ambiente corporativo restritivo. */
  static async runHardeningChecks(): Promise<HardeningCheck[]> {
    const checks: HardeningCheck[] = [];
    const proxy = readProxyConfig();

    // Verificação de proxy
    checks.push({
      id: "hrd-proxy-001",
      name: "Configuração de Proxy Corporativo",
      category: "proxy",
      description:
        "Verifica se proxy corporativo está configurado nas variáveis de ambiente.",
      status: proxy.enabled ? "ok" : "aviso",
      detail: proxy.enabled
        ? `Proxy configurado: HTTP=${proxy.httpProxy ?? "não definido"}, HTTPS=${proxy.httpsProxy ?? "não definido"}. NO_PROXY: ${proxy.noProxy.join(", ") || "vazio"}`
        : "Nenhum proxy configurado. Se o ambiente corporativo exigir proxy, definir HTTP_PROXY e HTTPS_PROXY.",
      recommendation: proxy.enabled
        ? null
        : "Se necessário, adicionar HTTP_PROXY=http://proxy.corp:3128 e HTTPS_PROXY ao .env.",
    });

    // Verificação de TLS inspection (NODE_EXTRA_CA_CERTS)
    const extraCa = process.env.NODE_EXTRA_CA_CERTS;
    checks.push({
      id: "hrd-tls-001",
      name: "CA Corporativo para Inspeção TLS",
      category: "tls",
      description:
        "Verifica se CA corporativo está configurado para ambientes com inspeção TLS.",
      status: extraCa ? "ok" : "aviso",
      detail: extraCa
        ? `NODE_EXTRA_CA_CERTS configurado: ${extraCa}`
        : "NODE_EXTRA_CA_CERTS não definido. Em ambientes com inspeção TLS, conexões HTTPS externas podem falhar com CERT_UNTRUSTED.",
      recommendation: extraCa
        ? null
        : "Se o ambiente inspecionar TLS, exportar CA corporativo: NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem",
    });

    // Verificação de NODE_ENV
    const nodeEnv = process.env.NODE_ENV ?? "development";
    checks.push({
      id: "hrd-env-001",
      name: "NODE_ENV de Produção",
      category: "firewall",
      description: "Verifica se o ambiente de execução está configurado corretamente.",
      status: nodeEnv === "production" ? "ok" : "aviso",
      detail: `NODE_ENV=${nodeEnv}`,
      recommendation:
        nodeEnv !== "production"
          ? "Em produção, definir NODE_ENV=production para desabilitar diagnósticos e stack traces nas respostas."
          : null,
    });

    // Verificação de JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET ?? "";
    const jwtOk = jwtSecret.length >= 32;
    checks.push({
      id: "hrd-cert-001",
      name: "JWT_SECRET com Entropia Adequada",
      category: "certificados",
      description: "Verifica se JWT_SECRET tem comprimento mínimo seguro (≥32 chars).",
      status: jwtOk ? "ok" : "falha",
      detail: jwtOk
        ? "JWT_SECRET tem comprimento adequado."
        : `JWT_SECRET tem ${jwtSecret.length} caracteres — mínimo recomendado: 32.`,
      recommendation: jwtOk
        ? null
        : "Gerar secret forte: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    });

    // Verificação de modo de rede restrita sem depender de egress externo.
    const deploymentMode = process.env.DEPLOYMENT_MODE;
    const offlineMode = (process.env.OFFLINE_MODE ?? "false").toLowerCase() === "true";
    const externalApis = (process.env.ALLOW_EXTERNAL_APIS ?? "false").toLowerCase() === "true";
    const restrictiveNetworkReady =
      deploymentMode === "on_premise" || offlineMode || !externalApis;
    checks.push({
      id: "hrd-dns-001",
      name: "Compatibilidade com Rede Corporativa Restritiva",
      category: "dns",
      description: "Valida operação em rede restritiva (on-premise/offline ou sem dependência obrigatória de APIs externas).",
      status: restrictiveNetworkReady ? "ok" : "aviso",
      detail: restrictiveNetworkReady
        ? "Modo restritivo declarado (on-premise/offline ou sem APIs externas obrigatórias)."
        : "Nenhum indicativo de modo restritivo. Ambientes corporativos podem exigir OFFLINE_MODE=true ou DEPLOYMENT_MODE=on_premise.",
      recommendation: restrictiveNetworkReady
        ? null
        : "Definir DEPLOYMENT_MODE=on_premise ou OFFLINE_MODE=true para ambientes sem egress externo.",
    });

    // Verificação de postura de antivírus/EDR corporativo.
    const avProfile = process.env.ANTIVIRUS_PROFILE ?? "";
    const avExclusions = process.env.ANTIVIRUS_EXCLUSIONS_OK ?? "";
    const antivirusReady = avProfile.length > 0 || avExclusions.toLowerCase() === "true";
    checks.push({
      id: "hrd-av-001",
      name: "Postura de Antivírus/EDR Corporativo",
      category: "antivirus",
      description: "Valida se há perfil de AV/EDR declarado e exclusões operacionais necessárias para build/runtime.",
      status: antivirusReady ? "ok" : "aviso",
      detail: antivirusReady
        ? `Perfil declarado (${avProfile || "custom"}) com compatibilidade operacional.`
        : "Nenhum perfil de AV/EDR informado. Em ambientes com antivírus agressivo, builds e workers podem sofrer bloqueio.",
      recommendation: antivirusReady
        ? null
        : "Definir ANTIVIRUS_PROFILE e validar exclusões de diretórios temporários/artefatos (ANTIVIRUS_EXCLUSIONS_OK=true).",
    });

    return checks;
  }

  // ── 122: Homologação Enterprise ────────────────────────────────────────────

  /** Retorna checklist de homologação enterprise. */
  static getOnboardingChecklist(area?: OnboardingChecklistItem["area"]): OnboardingChecklistItem[] {
    if (area) {
      return ONBOARDING_CHECKLIST.filter((i) => i.area === area);
    }
    return [...ONBOARDING_CHECKLIST];
  }

  /**
   * Atualiza status de verificação de um item do checklist.
   * Em produção real, isso seria persistido no banco de dados por tenant.
   */
  static markChecklistItem(
    id: string,
    verified: boolean,
    note?: string,
  ): OnboardingChecklistItem {
    const item = ONBOARDING_CHECKLIST.find((i) => i.id === id);
    if (!item) throw new Error(`Item de checklist '${id}' não encontrado.`);
    item.verified = verified;
    item.verificationNote = note ?? null;
    logger.info("[EnterpriseReadiness] Checklist item atualizado", {
      id,
      verified,
    });
    return item;
  }

  /** Resumo de progresso do checklist de homologação. */
  static getOnboardingProgress(): {
    total: number;
    verified: number;
    required: number;
    requiredVerified: number;
    readyForProduction: boolean;
    pendingRequired: OnboardingChecklistItem[];
  } {
    const total = ONBOARDING_CHECKLIST.length;
    const verified = ONBOARDING_CHECKLIST.filter((i) => i.verified).length;
    const required = ONBOARDING_CHECKLIST.filter((i) => i.required);
    const requiredVerified = required.filter((i) => i.verified).length;
    const pendingRequired = required.filter((i) => !i.verified);

    return {
      total,
      verified,
      required: required.length,
      requiredVerified,
      readyForProduction: pendingRequired.length === 0,
      pendingRequired,
    };
  }

  // ── 123: On-Premise / Híbrido ─────────────────────────────────────────────

  /** Retorna modos de implantação disponíveis. */
  static getDeploymentModes(mode?: DeploymentMode["mode"]): DeploymentMode[] {
    if (mode) {
      return DEPLOYMENT_MODES.filter((m) => m.mode === mode);
    }
    return [...DEPLOYMENT_MODES];
  }

  /**
   * Retorna modo de implantação detectado a partir das variáveis de ambiente.
   * Prioridade: DEPLOYMENT_MODE env var → inferência por variáveis cloud.
   */
  static detectDeploymentMode(): {
    detectedMode: DeploymentMode["mode"];
    confidence: "alta" | "media" | "baixa";
    indicators: string[];
  } {
    const explicit = process.env.DEPLOYMENT_MODE as DeploymentMode["mode"] | undefined;
    if (explicit && ["cloud", "on_premise", "hibrido"].includes(explicit)) {
      return { detectedMode: explicit, confidence: "alta", indicators: [`DEPLOYMENT_MODE=${explicit}`] };
    }

    const indicators: string[] = [];
    let cloudScore = 0;

    if (process.env.SUPABASE_URL?.includes("supabase.io")) {
      cloudScore++;
      indicators.push("SUPABASE_URL aponta para supabase.io (cloud)");
    }
    if (process.env.GCS_BUCKET) {
      cloudScore++;
      indicators.push("GCS_BUCKET configurado (Google Cloud Storage)");
    }
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      cloudScore++;
      indicators.push("GOOGLE_CLOUD_PROJECT configurado (GCP)");
    }
    if (process.env.DATABASE_URL?.includes("localhost")) {
      cloudScore--;
      indicators.push("DATABASE_URL aponta para localhost (on-premise)");
    }

    const detectedMode: DeploymentMode["mode"] =
      cloudScore > 1 ? "cloud" : cloudScore === 1 ? "hibrido" : "on_premise";

    return {
      detectedMode,
      confidence: indicators.length > 0 ? "media" : "baixa",
      indicators,
    };
  }
}

export function resetEnterpriseReadinessChecklist(): void {
  for (const item of ONBOARDING_CHECKLIST) {
    const baseline = ONBOARDING_CHECKLIST_BASELINE.find((b) => b.id === item.id);
    if (!baseline) continue;
    item.verified = baseline.verified;
    item.verificationNote = baseline.verificationNote;
  }
}
