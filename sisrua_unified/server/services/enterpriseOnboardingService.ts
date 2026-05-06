/**
 * enterpriseOnboardingService.ts — Pacote de Homologação Enterprise (122 [T1])
 *
 * Responsabilidades:
 * - Gerar checklist de portas, domínios e requisitos de rede para onboarding corporativo.
 * - Validar requisitos mínimos de ambiente (Node.js, memória, disco).
 * - Gerar pacote de documentação técnica de onboarding exportável.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type OnboardingItemStatus = "required" | "recommended" | "optional";

export interface NetworkRequirement {
  id: string;
  type: "port" | "domain" | "protocol";
  value: string;
  direction: "inbound" | "outbound" | "both";
  status: OnboardingItemStatus;
  purpose: string;
}

export interface EnvironmentRequirement {
  id: string;
  category: "runtime" | "hardware" | "os" | "database" | "network";
  name: string;
  minimum: string;
  recommended: string;
  status: OnboardingItemStatus;
  notes?: string;
}

export interface OnboardingCheckResult {
  id: string;
  name: string;
  passed: boolean;
  actual: string;
  required: string;
  notes?: string;
}

export interface EnterpriseOnboardingPackage {
  generatedAt: string;
  version: string;
  networkRequirements: NetworkRequirement[];
  environmentRequirements: EnvironmentRequirement[];
  validationResults: OnboardingCheckResult[];
  overallReady: boolean;
  readinessScore: number;
  criticalBlockers: string[];
}

// ─── Requisitos de rede (portas e domínios) ───────────────────────────────────

const NETWORK_REQUIREMENTS: NetworkRequirement[] = [
  // Portas inbound
  {
    id: "net-in-3000",
    type: "port",
    value: "3000/TCP",
    direction: "inbound",
    status: "required",
    purpose: "Servidor de aplicação Node.js (HTTP/HTTPS via proxy reverso)",
  },
  {
    id: "net-in-443",
    type: "port",
    value: "443/TCP",
    direction: "inbound",
    status: "required",
    purpose: "HTTPS (via proxy reverso como Nginx ou load balancer)",
  },
  {
    id: "net-in-80",
    type: "port",
    value: "80/TCP",
    direction: "inbound",
    status: "recommended",
    purpose: "HTTP → redirect para HTTPS",
  },
  // Portas outbound
  {
    id: "net-out-5432",
    type: "port",
    value: "5432/TCP",
    direction: "outbound",
    status: "required",
    purpose: "PostgreSQL / Supabase (banco de dados principal)",
  },
  {
    id: "net-out-11434",
    type: "port",
    value: "11434/TCP",
    direction: "outbound",
    status: "optional",
    purpose: "Ollama LLM local (IA zero-custo — apenas se feature IA ativada)",
  },
  {
    id: "net-out-443-supabase",
    type: "domain",
    value: "*.supabase.co",
    direction: "outbound",
    status: "required",
    purpose: "Supabase Auth, Storage e Realtime",
  },
  {
    id: "net-out-overpass",
    type: "domain",
    value: "overpass-api.de",
    direction: "outbound",
    status: "required",
    purpose: "OpenStreetMap Overpass API (dados geoespaciais gratuitos)",
  },
  {
    id: "net-out-nominatim",
    type: "domain",
    value: "nominatim.openstreetmap.org",
    direction: "outbound",
    status: "recommended",
    purpose: "Geocodificação reversa OSM",
  },
  {
    id: "net-out-tile",
    type: "domain",
    value: "*.tile.openstreetmap.org",
    direction: "outbound",
    status: "required",
    purpose: "Tiles do mapa base (OpenStreetMap)",
  },
  {
    id: "net-out-smtp",
    type: "port",
    value: "587/TCP",
    direction: "outbound",
    status: "recommended",
    purpose: "SMTP para notificações e alertas (se configurado)",
  },
];

// ─── Requisitos de ambiente ───────────────────────────────────────────────────

const ENVIRONMENT_REQUIREMENTS: EnvironmentRequirement[] = [
  {
    id: "env-node",
    category: "runtime",
    name: "Node.js",
    minimum: "18.x LTS",
    recommended: "20.x LTS ou 22.x LTS",
    status: "required",
    notes: "Necessário para suporte nativo a TLS 1.2+, ESM e crypto moderno.",
  },
  {
    id: "env-python",
    category: "runtime",
    name: "Python",
    minimum: "3.10",
    recommended: "3.11 ou 3.12",
    status: "required",
    notes: "Motor DXF e cálculos geoespaciais Python.",
  },
  {
    id: "env-ram",
    category: "hardware",
    name: "Memória RAM",
    minimum: "8 GB",
    recommended: "16 GB",
    status: "required",
    notes: "16 GB necessários se Ollama LLM local estiver ativo.",
  },
  {
    id: "env-cpu",
    category: "hardware",
    name: "CPU",
    minimum: "4 vCPUs",
    recommended: "8 vCPUs",
    status: "required",
    notes: "8 vCPUs recomendados para jobs DG e DXF simultâneos.",
  },
  {
    id: "env-disk",
    category: "hardware",
    name: "Disco (SSD)",
    minimum: "20 GB livre",
    recommended: "50 GB livre",
    status: "required",
    notes: "Logs, artefatos DXF, cache de tiles e snapshots.",
  },
  {
    id: "env-pg",
    category: "database",
    name: "PostgreSQL",
    minimum: "14",
    recommended: "15 ou 16",
    status: "required",
    notes: "PostGIS 3.x recomendado para funcionalidades geoespaciais avançadas.",
  },
  {
    id: "env-tls",
    category: "network",
    name: "Suporte TLS",
    minimum: "TLS 1.2",
    recommended: "TLS 1.3",
    status: "required",
    notes: "TLS 1.0/1.1 devem estar desabilitados no proxy reverso.",
  },
];

// ─── Validação do ambiente atual ──────────────────────────────────────────────

function validateCurrentEnvironment(): OnboardingCheckResult[] {
  const results: OnboardingCheckResult[] = [];

  // Node.js version
  const nodeVersion = parseInt(process.version.replace("v", "").split(".")[0] ?? "0");
  results.push({
    id: "check-node",
    name: "Node.js ≥ 18",
    passed: nodeVersion >= 18,
    actual: process.version,
    required: "v18.x ou superior",
    notes: nodeVersion < 18 ? "Atualize o Node.js antes de implantação em produção." : undefined,
  });

  // Memória disponível (heurística via process.memoryUsage)
  const heapTotalMb = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
  results.push({
    id: "check-ram-runtime",
    name: "Heap Node.js",
    passed: heapTotalMb >= 64,
    actual: `${heapTotalMb} MB heap alocado`,
    required: "≥64 MB heap (indicativo de ≥2 GB RAM disponível)",
    notes: heapTotalMb < 64 ? "Possível restrição de memória no container/VM." : undefined,
  });

  // Variáveis de ambiente obrigatórias
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_KEY"];
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  results.push({
    id: "check-env-vars",
    name: "Variáveis de Ambiente Obrigatórias",
    passed: missingEnvVars.length === 0,
    actual: missingEnvVars.length === 0
      ? "Todas configuradas"
      : `Faltando: ${missingEnvVars.join(", ")}`,
    required: requiredEnvVars.join(", "),
    notes: missingEnvVars.length > 0
      ? "Configure as variáveis via .env ou injeção de secrets do orquestrador."
      : undefined,
  });

  // NODE_ENV
  const nodeEnv = process.env.NODE_ENV ?? "undefined";
  results.push({
    id: "check-node-env",
    name: "NODE_ENV",
    passed: nodeEnv === "production" || nodeEnv === "test",
    actual: nodeEnv,
    required: "'production' em deploy; 'test' em CI",
    notes: nodeEnv === "development" ? "NODE_ENV=development não deve ser usado em produção." : undefined,
  });

  return results;
}

// ─── Geração do pacote de onboarding ─────────────────────────────────────────

export function generateEnterpriseOnboardingPackage(): EnterpriseOnboardingPackage {
  const validationResults = validateCurrentEnvironment();

  const criticalBlockers = validationResults
    .filter((r) => !r.passed)
    .map((r) => `[${r.id}] ${r.name}: ${r.actual} (requerido: ${r.required})`);

  const overallReady = criticalBlockers.length === 0;
  const readinessScore = Math.round(
    (validationResults.filter((r) => r.passed).length / validationResults.length) * 100
  );

  const version = process.env.APP_VERSION ?? "unknown";

  return {
    generatedAt: new Date().toISOString(),
    version,
    networkRequirements: NETWORK_REQUIREMENTS,
    environmentRequirements: ENVIRONMENT_REQUIREMENTS,
    validationResults,
    overallReady,
    readinessScore,
    criticalBlockers,
  };
}

export { NETWORK_REQUIREMENTS, ENVIRONMENT_REQUIREMENTS };
