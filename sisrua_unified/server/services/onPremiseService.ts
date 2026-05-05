/**
 * onPremiseService.ts — Suporte a Implantação On-Premise / Híbrida (123 [T1])
 *
 * Responsabilidades:
 * - Detectar modo de operação: cloud | hybrid | on-premise.
 * - Validar capacidades disponíveis em modo offline.
 * - Fornecer configuração isolada (air-gapped) para implantações sem internet.
 * - Gerar relatório de prontidão para implantação on-premise.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DeploymentMode = "cloud" | "hybrid" | "on-premise";

export interface OfflineCapability {
  feature: string;
  availableOffline: boolean;
  degradedMode: boolean;
  degradedDescription?: string;
  requirement?: string;
}

export interface IsolatedConfig {
  mode: DeploymentMode;
  allowExternalRequests: boolean;
  tileServerUrl: string;
  nominatimUrl: string;
  overpassUrl: string;
  llmEndpoint: string;
  storageBackend: "supabase" | "local" | "minio";
  authProvider: "supabase" | "ldap" | "oidc-local";
}

export interface OnPremiseReadinessReport {
  detectedMode: DeploymentMode;
  detectionReason: string;
  isolatedConfig: IsolatedConfig;
  offlineCapabilities: OfflineCapability[];
  gaps: string[];
  readyForOffline: boolean;
}

// ─── Detecção de modo de operação ─────────────────────────────────────────────

export function detectDeploymentMode(): { mode: DeploymentMode; reason: string } {
  const explicitMode = process.env.DEPLOYMENT_MODE as DeploymentMode | undefined;

  // Modo explícito via variável de ambiente (override manual)
  if (explicitMode && ["cloud", "hybrid", "on-premise"].includes(explicitMode)) {
    return {
      mode: explicitMode,
      reason: `Modo definido explicitamente via DEPLOYMENT_MODE=${explicitMode}`,
    };
  }

  // Heurística: sem SUPABASE_URL remoto → on-premise
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const isLocalSupabase =
    supabaseUrl.includes("localhost") ||
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("0.0.0.0");
  const hasRemoteSupabase = supabaseUrl.includes("supabase.co") || supabaseUrl.includes("supabase.io");

  // Heurística: tile server local configurado
  const tileServer = process.env.TILE_SERVER_URL ?? "";
  const hasLocalTiles = tileServer.length > 0 && !tileServer.includes("openstreetmap.org");

  // Heurística: LLM local via Ollama
  const llmEndpoint = process.env.LLM_ENDPOINT ?? "";
  const hasLocalLlm = llmEndpoint.includes("localhost") || llmEndpoint.includes("127.0.0.1");

  if (isLocalSupabase && hasLocalTiles) {
    return {
      mode: "on-premise",
      reason: "SUPABASE_URL apontando para localhost e TILE_SERVER_URL local detectados.",
    };
  }

  if (hasRemoteSupabase && (hasLocalTiles || hasLocalLlm)) {
    return {
      mode: "hybrid",
      reason: `Supabase cloud detectado com serviços locais: ${[hasLocalTiles && "tiles", hasLocalLlm && "LLM"].filter(Boolean).join(", ")}.`,
    };
  }

  return {
    mode: "cloud",
    reason: "Nenhuma configuração local detectada. Operação cloud padrão.",
  };
}

// ─── Capacidades offline ──────────────────────────────────────────────────────

const OFFLINE_CAPABILITIES: OfflineCapability[] = [
  {
    feature: "Cálculo DG (grafo de ruas)",
    availableOffline: true,
    degradedMode: false,
    requirement: "PostgreSQL com dados OSM pré-carregados via pg_restore",
  },
  {
    feature: "Geração DXF",
    availableOffline: true,
    degradedMode: false,
    requirement: "Python engine local (py_engine/)",
  },
  {
    feature: "Mapa base (tiles)",
    availableOffline: false,
    degradedMode: true,
    degradedDescription: "Mapa base indisponível sem TILE_SERVER_URL local (ex: tileserver-gl).",
    requirement: "Servidor de tiles local como tileserver-gl + MBTiles pré-baixados",
  },
  {
    feature: "Geocodificação reversa (Nominatim)",
    availableOffline: false,
    degradedMode: true,
    degradedDescription: "Endereços não serão resolvidos automaticamente.",
    requirement: "Instância Nominatim local com dados OSM importados",
  },
  {
    feature: "Overpass API (consultas OSM)",
    availableOffline: false,
    degradedMode: true,
    degradedDescription: "Consultas geoespaciais OSM indisponíveis.",
    requirement: "Instância Overpass local com dump OSM regional",
  },
  {
    feature: "Autenticação",
    availableOffline: false,
    degradedMode: true,
    degradedDescription: "Supabase Auth requer internet. Use OIDC local ou LDAP.",
    requirement: "Provedor OIDC/LDAP corporativo ou Keycloak local",
  },
  {
    feature: "IA / LLM (assistente)",
    availableOffline: true,
    degradedMode: false,
    requirement: "Ollama local com modelo llama3.2 ou equivalente",
  },
  {
    feature: "Notificações por e-mail",
    availableOffline: false,
    degradedMode: true,
    degradedDescription: "Exige SMTP acessível a partir do servidor.",
    requirement: "Relay SMTP interno (ex: Postfix, Exchange)",
  },
];

// ─── Configuração isolada ─────────────────────────────────────────────────────

export function getIsolatedConfig(mode: DeploymentMode): IsolatedConfig {
  const tileServer =
    process.env.TILE_SERVER_URL ?? "http://localhost:8080/styles/osm-bright/{z}/{x}/{y}.png";
  const nominatim = process.env.NOMINATIM_URL ?? "http://localhost:8081";
  const overpass = process.env.OVERPASS_URL ?? "http://localhost:12347/api/interpreter";
  const llm = process.env.LLM_ENDPOINT ?? "http://localhost:11434/api/generate";

  const storageBackend: IsolatedConfig["storageBackend"] =
    (process.env.STORAGE_BACKEND as IsolatedConfig["storageBackend"]) ??
    (mode === "cloud" ? "supabase" : "local");

  const authProvider: IsolatedConfig["authProvider"] =
    (process.env.AUTH_PROVIDER as IsolatedConfig["authProvider"]) ??
    (mode === "cloud" ? "supabase" : "oidc-local");

  return {
    mode,
    allowExternalRequests: mode !== "on-premise",
    tileServerUrl: mode === "on-premise" ? tileServer : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    nominatimUrl: mode === "on-premise" ? nominatim : "https://nominatim.openstreetmap.org",
    overpassUrl: mode === "on-premise" ? overpass : "https://overpass-api.de/api/interpreter",
    llmEndpoint: llm,
    storageBackend,
    authProvider,
  };
}

// ─── Relatório de prontidão ───────────────────────────────────────────────────

export function generateOnPremiseReadinessReport(): OnPremiseReadinessReport {
  const { mode, reason } = detectDeploymentMode();
  const isolatedConfig = getIsolatedConfig(mode);

  const gaps: string[] = [];

  if (mode === "on-premise") {
    if (!process.env.TILE_SERVER_URL) {
      gaps.push("TILE_SERVER_URL não configurado — mapa base indisponível offline.");
    }
    if (!process.env.NOMINATIM_URL) {
      gaps.push("NOMINATIM_URL não configurado — geocodificação offline indisponível.");
    }
    if (!process.env.OVERPASS_URL) {
      gaps.push("OVERPASS_URL não configurado — consultas OSM offline indisponíveis.");
    }
    if (isolatedConfig.authProvider === "supabase") {
      gaps.push("AUTH_PROVIDER não configurado para modo offline (use 'ldap' ou 'oidc-local').");
    }
  }

  const readyForOffline =
    mode === "on-premise" ? gaps.length === 0 : mode === "hybrid";

  return {
    detectedMode: mode,
    detectionReason: reason,
    isolatedConfig,
    offlineCapabilities: OFFLINE_CAPABILITIES,
    gaps,
    readyForOffline,
  };
}
