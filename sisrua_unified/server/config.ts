/**
 * Centralized server configuration.
 *
 * All process.env reads and magic-number defaults live here.
 * Validated with Zod at startup — misconfiguration causes an early, descriptive crash
 * rather than a silent wrong-value bug discovered at runtime.
 */
import { z } from "zod";
import fs from "node:fs";

/**
 * Helper to read a secret from an environment variable or a file (Docker Secrets support).
 * If NAME_FILE exists, it reads from that file. Otherwise, it uses NAME.
 */
function readSecret(name: string): string | undefined {
  const filePath = process.env[`${name}_FILE`];
  if (filePath && fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch (err) {
      console.error(`[sisrua] Failed to read secret from ${filePath}:`, err);
    }
  }
  return process.env[name];
}

const EnvSchema = z.object({
  // ── Server ───────────────────────────────────────────────────────────────
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "debug", "verbose", "silly"])
    .default("info"),
  BODY_LIMIT: z.string().default("1mb"),
  APP_VERSION: z.string().default("1.2.0"),

  // ── AI & Engineering ──────────────────────────────────────────────────────
  GROQ_API_KEY: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // ── Ollama ────────────────────────────────────────────────────────────────
  OLLAMA_MODEL: z.string().default("llama3.2"),
  OLLAMA_HOST: z.string().default("http://localhost:11434"),
  /** Enforce zero-cost AI policy by restricting Ollama host to local endpoints unless explicitly allowed. */
  OLLAMA_ENFORCE_ZERO_COST: z.string().optional(),
  /** Comma-separated fallback models for compatibility when primary model is unavailable. */
  OLLAMA_FALLBACK_MODELS: z.string().optional(),
  /** Optional comma-separated remote host allowlist when zero-cost policy needs explicit exceptions. */
  OLLAMA_ALLOWED_REMOTE_HOSTS: z.string().optional(),
  /** Minimum Ollama runtime version required for enterprise governance checks. */
  OLLAMA_MIN_VERSION: z.string().default("0.0.0"),
  /** UTC maintenance window in HH:MM-HH:MM format used to authorize controlled updates. */
  OLLAMA_UPDATE_MAINTENANCE_WINDOW_UTC: z.string().default("02:00-04:00"),
  /** Enable/disable periodic governance checks for Ollama runtime updates. */
  OLLAMA_UPDATE_CHECK_ENABLED: z.string().optional(),
  /** How long (ms) to wait after spawning the Ollama process before proceeding */
  OLLAMA_STARTUP_WAIT_MS: z.coerce.number().default(3_000),
  /** Timeout (ms) for the Ollama health-check HTTP request */
  OLLAMA_CHECK_TIMEOUT_MS: z.coerce.number().default(2_000),

  // ── Python engine ─────────────────────────────────────────────────────────
  PYTHON_COMMAND: z.string().optional(),
  /** Maximum runtime for python DXF generation process before force-failing (ms). */
  PYTHON_PROCESS_TIMEOUT_MS: z.coerce.number().positive().default(600_000),
  /** Number of DXF queue workers running in parallel. */
  DXF_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  DOCKER_ENV: z.string().optional(),

  // ── DXF file management ───────────────────────────────────────────────────
  DXF_DIRECTORY: z.string().default("./public/dxf"),
  /** Time-to-live for generated DXF files before automatic deletion (ms) */
  DXF_FILE_TTL_MS: z.coerce.number().default(10 * 60 * 1_000), // 10 min
  /** Hard upper-bound: no DXF file survives longer than this (ms) */
  DXF_MAX_AGE_MS: z.coerce.number().default(2 * 60 * 60 * 1_000), // 2 h
  /** Interval for the scheduled DXF cleanup sweep (ms) */
  DXF_CLEANUP_INTERVAL_MS: z.coerce.number().default(2 * 60 * 1_000), // 2 min

  // ── In-memory DXF cache ───────────────────────────────────────────────────
  /** Default TTL for DXF cache entries (ms) */
  CACHE_TTL_MS: z.coerce.number().default(24 * 60 * 60 * 1_000), // 24 h

  // ── Rate limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_GENERAL_WINDOW_MS: z.coerce.number().default(15 * 60 * 1_000), // 15 min
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().default(100),
  RATE_LIMIT_DXF_WINDOW_MS: z.coerce.number().default(60 * 60 * 1_000), // 1 h
  RATE_LIMIT_DXF_MAX: z.coerce.number().default(10),

  // ── Job status service ────────────────────────────────────────────────────
  /** How often to scan and evict old in-memory jobs (ms) */
  JOB_CLEANUP_INTERVAL_MS: z.coerce.number().default(60 * 60 * 1_000), // 1 h
  /** Maximum age of a job before it is evicted from memory (ms) */
  JOB_MAX_AGE_MS: z.coerce.number().default(60 * 60 * 1_000), // 1 h

  // ── Firestore / GCP ───────────────────────────────────────────────────────
  /** Explicit opt-in/out. Defaults to true in production, false elsewhere. */
  USE_FIRESTORE: z.string().optional(),
  /** Explicit opt-in/out for Cloud Tasks integration. */
  USE_CLOUD_TASKS: z.string().optional(),
  GCP_PROJECT: z.string().optional(),

  // ── Supabase / Postgres jobs persistence ─────────────────────────────────
  /** Connection URL used for Supabase/Postgres persistence when enabled. */
  DATABASE_URL: z.string().optional(),
  /** Alias accepted for compatibility with Supabase-focused env files. */
  SUPABASE_DB_URL: z.string().optional(),
  /** Explicit opt-in/out for Supabase jobs persistence. Defaults to true when DATABASE_URL exists. */
  USE_SUPABASE_JOBS: z.string().optional(),
  /** Explicit opt-in/out for DB cleanup jobs in maintenance service. */
  MAINTENANCE_DB_CLEANUP_ENABLED: z.string().optional(),

  // ── Constants catalog (DB-backed lookup tables) ────────────────────────────
  /** Enable reading CQT lookup tables (cabos/trafos/disjuntores) from DB. Defaults to false. */
  USE_DB_CONSTANTS_CQT: z.string().optional(),
  /** Enable reading clandestino lookup tables (area→kVA, clients→factor) from DB. Defaults to false. */
  USE_DB_CONSTANTS_CLANDESTINO: z.string().optional(),
  /** Enable reading operational config constants (cleanup TTLs, pilot config) from DB. Defaults to false. */
  USE_DB_CONSTANTS_CONFIG: z.string().optional(),
  /** Optional token to protect manual constants refresh endpoint. */
  CONSTANTS_REFRESH_TOKEN: z.string().optional(),

  // ── BT Radial Calculation feature flag ───────────────────────────────────
  /** Enable the new radial BT calculation engine. Defaults to false. */
  BT_RADIAL_ENABLED: z.string().optional(),

  // ── Canonical Topology (Poste-Driven migration) ────────────────────────
  /**
   * Habilita leitura prioritária das tabelas canonical_poles/canonical_edges
   * em vez dos payloads legados de dxf_tasks.
   * Defaults to false (legado).
   */
  CANONICAL_TOPOLOGY_READ: z.string().optional(),

  // ── CORS ──────────────────────────────────────────────────────────────────
  /**
   * Origens permitidas em produção (CSV). Ex: https://app.sisrua.com.br
   * Obrigatório em produção; opcional em desenvolvimento.
   * NÃO use '*' — bloqueado por política de segurança (OWASP A05).
   */
  CORS_ORIGIN: z.string().optional(),
  /** Public backend URL used to build download links (e.g. https://api.example.com). */
  APP_PUBLIC_URL: z.string().url().optional(),
  /** Express trust proxy setting. Accepts boolean, number (hop count), or CSV/IP/netmask string. */
  TRUST_PROXY: z.string().optional(),

  // ── Observability ─────────────────────────────────────────────────────────
  METRICS_ENABLED: z.coerce.boolean().default(true),
  /** Prefix for all Prometheus metric names */
  METRICS_PREFIX: z.string().default("sisrua"),
  /**
   * Optional Bearer token to protect the /metrics endpoint.
   * When set, all requests to /metrics must include:
   *   Authorization: Bearer <METRICS_TOKEN>
   * When absent, the endpoint is served without authentication (suitable
   * for internal-network Prometheus scrapers that are NOT publicly exposed).
   */
  METRICS_TOKEN: z.string().optional(),
  /**
   * Token Bearer para proteger os endpoints de /api/admin.
   * Regra unificada dos endpoints críticos: se token estiver configurado,
   * todas as requisições devem enviar Authorization: Bearer <ADMIN_TOKEN>.
   * Se ausente, o acesso fica permissivo (sem variação por ambiente).
   */
  ADMIN_TOKEN: z.string().optional(),
});

type RawConfig = z.infer<typeof EnvSchema>;

type TrustProxyConfig = boolean | number | string;

function parseTrustProxyValue(
  value: string | undefined,
  nodeEnv: RawConfig["NODE_ENV"],
): TrustProxyConfig {
  if (!value || value.trim().length === 0) {
    // Explicit default by environment:
    // - production: trust first proxy hop (common reverse-proxy setup)
    // - development/test: disabled by default
    return nodeEnv === "production" ? 1 : false;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return value.trim();
}

function normalizeDatabaseUrl(
  primary: string | undefined,
  alias: string | undefined,
): string | undefined {
  const raw = (primary ?? alias)?.trim();
  if (!raw) {
    return undefined;
  }

  // Remove surrounding quotes often introduced by copy/paste in .env files.
  const unquoted = raw.replace(/^['"]|['"]$/g, "").trim();
  return unquoted.length > 0 ? unquoted : undefined;
}

function loadConfig() {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `[sisrua] Server configuration error:\n${result.error.message}`,
    );
  }

  const raw: RawConfig = result.data;

  // Use readSecret for sensitive values
  const groqApiKey = readSecret("GROQ_API_KEY");
  const redisPassword = readSecret("REDIS_PASSWORD");

  const databaseUrl = normalizeDatabaseUrl(
    raw.DATABASE_URL,
    raw.SUPABASE_DB_URL,
  );

  // Derived values — computed once at startup, never recalculated.
  const useSupabaseJobs: boolean =
    raw.USE_SUPABASE_JOBS !== undefined
      ? raw.USE_SUPABASE_JOBS === "true"
      : !!databaseUrl;

  const maintenanceDbCleanupEnabled: boolean =
    raw.MAINTENANCE_DB_CLEANUP_ENABLED !== undefined
      ? raw.MAINTENANCE_DB_CLEANUP_ENABLED === "true"
      : useSupabaseJobs || raw.USE_DB_CONSTANTS_CONFIG === "true";

  const useFirestore: boolean =
    raw.USE_FIRESTORE !== undefined
      ? raw.USE_FIRESTORE === "true"
      : raw.NODE_ENV === "production" && !useSupabaseJobs;
  const useCloudTasks: boolean =
    raw.USE_CLOUD_TASKS !== undefined ? raw.USE_CLOUD_TASKS === "true" : false;

  const isDocker: boolean = raw.DOCKER_ENV === "true";

  const useDbConstantsCqt: boolean = raw.USE_DB_CONSTANTS_CQT === "true";
  const useDbConstantsClandestino: boolean =
    raw.USE_DB_CONSTANTS_CLANDESTINO === "true";
  const useDbConstantsConfig: boolean = raw.USE_DB_CONSTANTS_CONFIG === "true";
  const btRadialEnabled: boolean = raw.BT_RADIAL_ENABLED === "true";
  const canonicalTopologyRead: boolean = raw.CANONICAL_TOPOLOGY_READ === "true";
  const trustProxy = parseTrustProxyValue(raw.TRUST_PROXY, raw.NODE_ENV);
  const ollamaEnforceZeroCost: boolean =
    raw.OLLAMA_ENFORCE_ZERO_COST !== undefined
      ? raw.OLLAMA_ENFORCE_ZERO_COST === "true"
      : true;
  const ollamaFallbackModels: readonly string[] = (
    raw.OLLAMA_FALLBACK_MODELS ?? ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const ollamaAllowedRemoteHosts: readonly string[] = (
    raw.OLLAMA_ALLOWED_REMOTE_HOSTS ?? ""
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const ollamaUpdateCheckEnabled: boolean =
    raw.OLLAMA_UPDATE_CHECK_ENABLED !== undefined
      ? raw.OLLAMA_UPDATE_CHECK_ENABLED === "true"
      : true;

  return {
    ...raw,
    GROQ_API_KEY: groqApiKey,
    REDIS_PASSWORD: redisPassword,
    DATABASE_URL: databaseUrl,
    useFirestore,
    useCloudTasks,
    useSupabaseJobs,
    maintenanceDbCleanupEnabled,
    isDocker,
    useDbConstantsCqt,
    useDbConstantsClandestino,
    useDbConstantsConfig,
    btRadialEnabled,
    canonicalTopologyRead,
    trustProxy,
    ollamaEnforceZeroCost,
    ollamaFallbackModels,
    ollamaAllowedRemoteHosts,
    ollamaUpdateCheckEnabled,
  } as const;
}

export const config = loadConfig();
export type Config = typeof config;
