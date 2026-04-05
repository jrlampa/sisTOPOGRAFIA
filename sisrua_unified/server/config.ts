/**
 * Centralized server configuration.
 *
 * All process.env reads and magic-number defaults live here.
 * Validated with Zod at startup — misconfiguration causes an early, descriptive crash
 * rather than a silent wrong-value bug discovered at runtime.
 */
import { z } from 'zod';

const EnvSchema = z.object({
    // ── Server ───────────────────────────────────────────────────────────────
    PORT: z.coerce.number().min(1).max(65535).default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose', 'silly']).default('info'),
    BODY_LIMIT: z.string().default('1mb'),
    APP_VERSION: z.string().default('1.2.0'),

    // ── Ollama ────────────────────────────────────────────────────────────────
    OLLAMA_MODEL: z.string().default('llama3.2'),
    OLLAMA_HOST: z.string().default('http://localhost:11434'),
    /** How long (ms) to wait after spawning the Ollama process before proceeding */
    OLLAMA_STARTUP_WAIT_MS: z.coerce.number().default(3_000),
    /** Timeout (ms) for the Ollama health-check HTTP request */
    OLLAMA_CHECK_TIMEOUT_MS: z.coerce.number().default(2_000),

    // ── Python engine ─────────────────────────────────────────────────────────
    PYTHON_COMMAND: z.string().optional(),
    DOCKER_ENV: z.string().optional(),

    // ── DXF file management ───────────────────────────────────────────────────
    DXF_DIRECTORY: z.string().default('./public/dxf'),
    /** Time-to-live for generated DXF files before automatic deletion (ms) */
    DXF_FILE_TTL_MS: z.coerce.number().default(10 * 60 * 1_000),    // 10 min
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
    GCP_PROJECT: z.string().optional(),

    // ── Observability ─────────────────────────────────────────────────────────
    METRICS_ENABLED: z.coerce.boolean().default(true),
    /** Prefix for all Prometheus metric names */
    METRICS_PREFIX: z.string().default('sisrua'),
});

type RawConfig = z.infer<typeof EnvSchema>;

function loadConfig() {
    const result = EnvSchema.safeParse(process.env);

    if (!result.success) {
        throw new Error(
            `[sisrua] Server configuration error:\n${result.error.message}`
        );
    }

    const raw: RawConfig = result.data;

    // Derived values — computed once at startup, never recalculated.
    const useFirestore: boolean =
        raw.USE_FIRESTORE !== undefined
            ? raw.USE_FIRESTORE === 'true'
            : raw.NODE_ENV === 'production';

    const isDocker: boolean = raw.DOCKER_ENV === 'true';

    return { ...raw, useFirestore, isDocker } as const;
}

export const config = loadConfig();
export type Config = typeof config;
