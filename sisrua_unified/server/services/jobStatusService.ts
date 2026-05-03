import { logger } from "../utils/logger.js";
import { createHash } from "crypto";
import postgres from "postgres";
import { config } from "../config.js";
import { jobRepository } from "../repositories/jobRepository.js";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobInfo {
  id: string;
  tenantId: string; // Mandatory for multi-tenancy enforcement
  status: JobStatus;
  progress: number;
  result?: {
    url: string;
    filename: string;
    btContextUrl?: string;
    artifactSha256?: string;
    warning?: string;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  attempts?: number; 
  idempotencyKey?: string; 
}

// In-memory storage for job statuses (fallback when Postgres is unavailable)
const jobs = new Map<string, JobInfo>();
// Secondary index: idempotencyKey -> jobId for O(1) deduplication lookup
const jobsByIdempotencyKey = new Map<string, string>();

// Safety limit to prevent memory buffer overflow and DB connection exhaustion under stress
export const MAX_SYSTEM_CAPACITY = 2000;

// Supabase/Postgres integration
const USE_SUPABASE_JOBS = config.useSupabaseJobs;
const DATABASE_URL = config.DATABASE_URL;
const JOBS_TABLE = "jobs";

type SqlClient = ReturnType<typeof postgres>;

// Track if Postgres persistence is available
let postgresAvailable = false;
let sqlClient: SqlClient | null = null;

// Auto-cleanup old jobs after 1 hour
const CLEANUP_INTERVAL = config.JOB_CLEANUP_INTERVAL_MS;
const MAX_JOB_AGE = config.JOB_MAX_AGE_MS;

let cleanupIntervalId: NodeJS.Timeout | null = null;
let initializationStarted = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initializes the Postgres connection pool and loads recent jobs.
 * This is called automatically by the first job operation.
 */
export async function initializePersistence(): Promise<void> {
  if (!USE_SUPABASE_JOBS || !DATABASE_URL || postgresAvailable) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      sqlClient = postgres(DATABASE_URL, {
        ssl: config.NODE_ENV === "production" ? "require" : undefined,
        max: 5, 
        connect_timeout: 10,
        idle_timeout: 15,
      });

      postgresAvailable = true;
      logger.info("JobStatusService: Supabase/Postgres persistence enabled");

      // Load existing jobs from Postgres on startup
      await loadJobsFromPostgres();
      
      // Start cleanup interval after successful initialization
      startCleanupInterval();
    } catch (error) {
      logger.warn(
        "JobStatusService: Supabase/Postgres unavailable, using in-memory fallback",
        { error },
      );
      postgresAvailable = false;
      if (sqlClient) {
        await sqlClient.end({ timeout: 3 }).catch(() => undefined);
        sqlClient = null;
      }
      startCleanupInterval();
    }
  })();

  return initializationPromise;
}

async function loadJobsFromPostgres(): Promise<void> {
  if (!postgresAvailable || !sqlClient) {
    return;
  }

  try {
    const rows = await sqlClient.unsafe(
      `
            select id, tenant_id, status, progress, result, error, created_at, updated_at, attempts, idempotency_key
            from ${JOBS_TABLE}
            where updated_at > (now() - ($1::bigint * interval '1 millisecond'))
        `,
      [MAX_JOB_AGE],
    );

    rows.forEach((row: any) => {
      const job: JobInfo = {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        status: row.status as JobStatus,
        progress: Number(row.progress || 0),
        result: row.result ?? undefined,
        error: row.error ?? undefined,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        attempts: Number(row.attempts || 0),
        idempotencyKey: row.idempotency_key ?? undefined,
      };
      jobs.set(job.id, job);
      if (job.idempotencyKey) {
        jobsByIdempotencyKey.set(job.idempotencyKey, job.id);
      }
    });

    logger.info("Loaded jobs from Supabase/Postgres", { count: rows.length });
  } catch (error) {
    logger.error("Failed to load jobs from Supabase/Postgres", { error });
  }
}

function mapRowToJobInfo(row: any): JobInfo {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    status: row.status as JobStatus,
    progress: Number(row.progress || 0),
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    attempts: Number(row.attempts || 0),
    idempotencyKey: row.idempotency_key ?? undefined,
  };
}

async function fetchJobFromPostgres(id: string): Promise<JobInfo | null> {
  if (!postgresAvailable || !sqlClient) {
    return null;
  }

  try {
    const rows = await sqlClient.unsafe(
      `
            select id, tenant_id, status, progress, result, error, created_at, updated_at, attempts, idempotency_key
            from ${JOBS_TABLE}
            where id = $1
            limit 1
        `,
      [id],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const job = mapRowToJobInfo(rows[0]);
    jobs.set(job.id, job);
    if (job.idempotencyKey) {
      jobsByIdempotencyKey.set(job.idempotencyKey, job.id);
    }
    return job;
  } catch (error) {
    logger.error("Failed to fetch job from Supabase/Postgres", {
      jobId: id,
      error,
    });
    return null;
  }
}

function startCleanupInterval() {
  if (cleanupIntervalId) {
    return; // Already running
  }

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
      if (now - job.createdAt.getTime() > MAX_JOB_AGE) {
        if (job.idempotencyKey) {
          jobsByIdempotencyKey.delete(job.idempotencyKey);
        }
        jobs.delete(id);
        logger.info("Cleaned up old job", { jobId: id });
      }
    }
  }, CLEANUP_INTERVAL);
}

export function stopCleanupInterval() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info("Job cleanup interval stopped");
  }

  if (sqlClient) {
    sqlClient.end({ timeout: 3 }).catch(() => undefined);
    sqlClient = null;
    postgresAvailable = false;
  }
}

export function resetServiceState() {
  stopCleanupInterval();
  jobs.clear();
  jobsByIdempotencyKey.clear();
  initializationStarted = false;
  initializationPromise = null;
}

function ensureInitialized(): void {
  if (initializationStarted) {
    return;
  }

  if (process.env.NODE_ENV === "test") {
    initializationStarted = true;
    return;
  }

  initializationStarted = true;
  // Non-blocking background initialization
  initializePersistence().catch((err) => {
    logger.error("Failed to initialize Supabase/Postgres for job status", {
      error: err,
    });
  });
}

/**
 * Creates a new job. Synchronous for in-memory safety, 
 * persists to Postgres in the background.
 */
export function createJob(id: string, tenantId: string, idempotencyKey?: string): JobInfo {
  ensureInitialized();

  if (jobs.size >= MAX_SYSTEM_CAPACITY) {
    logger.error("System Overloaded: Maximum job capacity reached", {
      currentJobs: jobs.size,
      max_capacity: MAX_SYSTEM_CAPACITY,
    });
    const err = new Error(
      "CapacityError: O sistema atingiu a capacidade máxima. Tente novamente mais tarde.",
    );
    (err as any).code = "ERR_CAPACITY";
    throw err;
  }

  const job: JobInfo = {
    id,
    tenantId,
    status: "queued",
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    attempts: 0,
    idempotencyKey,
  };
  jobs.set(id, job);
  if (idempotencyKey) {
    jobsByIdempotencyKey.set(idempotencyKey, id);
  }

  // Background persistence via repository
  jobRepository.upsert(id, tenantId, "queued", 0).catch((err) =>
    logger.error("Failed to persist new job", { jobId: id, tenantId, error: err }),
  );

  logger.info("Job created", { jobId: id, tenantId, idempotencyKey });
  return job;
}

export function getJob(id: string): JobInfo | null {
  ensureInitialized();
  return jobs.get(id) || null;
}

/**
 * Gets a job with cross-instance resilience.
 * First checks local memory, then read-through from Postgres when enabled.
 */
export async function getJobWithPersistence(
  id: string,
  tenantId?: string,
): Promise<JobInfo | null> {
  ensureInitialized();

  const inMemory = jobs.get(id);
  if (inMemory && (!tenantId || inMemory.tenantId === tenantId)) {
    return inMemory;
  }

  return fetchJobFromPostgres(id);
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  progress?: number,
): Promise<void> {
  ensureInitialized();

  const job = jobs.get(id);
  if (job) {
    job.status = status;
    if (progress !== undefined) {
      job.progress = progress;
    }
    job.updatedAt = new Date();
    jobs.set(id, job);

    // Persist to DB via repository
    await jobRepository.upsert(id, job.tenantId, status, job.progress);

    logger.info("Job status updated", { jobId: id, status, progress });
  }
}

export async function completeJob(
  id: string,
  result: {
    url: string;
    filename: string;
    btContextUrl?: string;
    artifactSha256?: string;
    warning?: string;
  },
): Promise<void> {
  ensureInitialized();

  const job = jobs.get(id);
  if (job) {
    job.status = "completed";
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date();
    jobs.set(id, job);

    // Persist to DB via repository
    await jobRepository.complete(id, job.tenantId, result);

    logger.info("Job completed", { jobId: id, filename: result.filename });
  }
}

export async function failJob(id: string, error: string): Promise<void> {
  ensureInitialized();

  const job = jobs.get(id);
  if (job) {
    job.status = "failed";
    job.error = error;
    job.updatedAt = new Date();
    job.attempts = (job.attempts || 0) + 1;
    jobs.set(id, job);

    // Persist to DB via repository
    await jobRepository.fail(id, job.tenantId, error);

    logger.error("Job failed", { jobId: id, error, attempts: job.attempts });
  }
}

// Idempotency check - returns true if job should be processed
export function shouldProcessJob(id: string): boolean {
  ensureInitialized();

  const job = jobs.get(id);
  if (!job) {
    return true; // New job
  }

  // Don't reprocess completed or already processing jobs
  if (job.status === "completed" || job.status === "processing") {
    logger.info("Job already processed or in progress, skipping", {
      jobId: id,
      status: job.status,
    });
    return false;
  }

  // Retry failed jobs up to 3 times
  if (job.status === "failed" && (job.attempts || 0) >= 3) {
    logger.warn("Job exceeded max attempts", {
      jobId: id,
      attempts: job.attempts,
    });
    return false;
  }

  return true;
}

const TERMINAL_STATES: JobStatus[] = ["completed", "failed"];

/**
 * Compute a SHA-256 idempotency key from arbitrary job parameters.
 * The input object is deterministically serialised (keys sorted) before hashing.
 */
export function computeIdempotencyKey(params: Record<string, unknown>): string {
  const canonical = JSON.stringify(params, Object.keys(params).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Find an existing active job by idempotency key or create a new one.
 *
 * - If a job with the same key exists and is **not** in a terminal state
 *   (`completed` | `failed`), the existing job is returned (deduplication).
 * - Otherwise a new job is created with the given *id*.
 */
export function findOrCreateJob(id: string, tenantId: string, idempotencyKey: string): JobInfo {
  ensureInitialized();

  const existingId = jobsByIdempotencyKey.get(idempotencyKey);
  if (existingId) {
    const existing = jobs.get(existingId);
    if (existing && !TERMINAL_STATES.includes(existing.status)) {
      logger.info("Returning existing job (idempotency deduplication)", {
        jobId: existingId,
        idempotencyKey,
        status: existing.status,
      });
      return existing;
    }
    // Terminal state — allow a fresh job to be created below
    jobsByIdempotencyKey.delete(idempotencyKey);
  }

  return createJob(id, tenantId, idempotencyKey);
}
