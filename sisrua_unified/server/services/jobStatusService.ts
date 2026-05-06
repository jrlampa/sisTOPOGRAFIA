import { logger } from "../utils/logger.js";
import { createHash } from "crypto";
import postgres from "postgres";
import { config } from "../config.js";
import { jobRepository } from "../repositories/jobRepository.js";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobInfo {
  id: string;
  tenantId: string;
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

let jobs = new Map<string, JobInfo>();
let jobsByIdempotencyKey = new Map<string, string>();

export const MAX_SYSTEM_CAPACITY = 2000;

const USE_SUPABASE_JOBS = config.useSupabaseJobs;
const DATABASE_URL = config.DATABASE_URL;
const JOBS_TABLE = "jobs";

type SqlClient = ReturnType<typeof postgres>;

let postgresAvailable = false;
let sqlClient: SqlClient | null = null;

const CLEANUP_INTERVAL = config.JOB_CLEANUP_INTERVAL_MS;
const MAX_JOB_AGE = config.JOB_MAX_AGE_MS;

let cleanupIntervalId: NodeJS.Timeout | null = null;
let initializationStarted = false;
let initializationPromise: Promise<void> | null = null;

export function resetServiceState(): void {
  jobs = new Map();
  jobsByIdempotencyKey = new Map();
  initializationStarted = false;
  initializationPromise = null;
  postgresAvailable = false;
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  if (sqlClient) {
    sqlClient.end({ timeout: 1 }).catch(() => undefined);
    sqlClient = null;
  }
}

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

      await sqlClient`SELECT 1`;
      postgresAvailable = true;
      logger.info("JobStatusService: Postgres persistence enabled");
      await loadJobsFromPostgres();
      startCleanupInterval();
    } catch (error) {
      logger.warn("JobStatusService: Postgres unavailable", { error });
      postgresAvailable = false;
      if (sqlClient) {
        await sqlClient.end({ timeout: 1 }).catch(() => undefined);
        sqlClient = null;
      }
      startCleanupInterval();
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

async function loadJobsFromPostgres(): Promise<void> {
  if (!postgresAvailable || !sqlClient) return;

  try {
    const rows = await sqlClient.unsafe(
      `SELECT id, tenant_id, status, progress, result, error, created_at, updated_at, attempts, idempotency_key
       FROM ${JOBS_TABLE}
       WHERE updated_at > (now() - ($1::bigint * interval '1 millisecond'))`,
      [MAX_JOB_AGE],
    );

    rows.forEach((row: any) => {
      const job = mapRowToJobInfo(row);
      if (job.id && job.id !== "unknown") {
        jobs.set(job.id, job);
        if (job.idempotencyKey) {
          jobsByIdempotencyKey.set(job.idempotencyKey, job.id);
        }
      }
    });
  } catch (error) {
    logger.error("Failed to load jobs from Postgres", { error });
  }
}

function mapRowToJobInfo(row: any): JobInfo {
  const id = row.id || row.id_job || "unknown";
  const tenantId = row.tenant_id || row.tenantId || "unknown";

  return {
    id: String(id),
    tenantId: String(tenantId),
    status: (row.status as JobStatus) || "queued",
    progress: Number(row.progress || 0),
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    attempts: Number(row.attempts || 0),
    idempotencyKey: row.idempotency_key || row.idempotencyKey || undefined,
  };
}

async function fetchJobFromPostgres(
  id: string,
  tenantId?: string,
): Promise<JobInfo | null> {
  if (!postgresAvailable || !sqlClient) return null;

  try {
    const rows = tenantId
      ? await sqlClient.unsafe(
          `SELECT id, tenant_id, status, progress, result, error, created_at, updated_at, attempts, idempotency_key
           FROM ${JOBS_TABLE} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
          [id, tenantId],
        )
      : await sqlClient.unsafe(
          `SELECT id, tenant_id, status, progress, result, error, created_at, updated_at, attempts, idempotency_key
           FROM ${JOBS_TABLE} WHERE id = $1 LIMIT 1`,
          [id],
        );

    if (!rows || !rows.length) return null;

    const job = mapRowToJobInfo(rows[0]);
    if (job.id && job.id !== "unknown") {
      jobs.set(job.id, job);
      if (job.idempotencyKey) {
        jobsByIdempotencyKey.set(job.idempotencyKey, job.id);
      }
      return job;
    }
    return null;
  } catch (error) {
    logger.error("Failed to fetch job from Postgres", { jobId: id, error });
    return null;
  }
}

function startCleanupInterval() {
  if (cleanupIntervalId) return;
  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
      if (now - job.createdAt.getTime() > MAX_JOB_AGE) {
        if (job.idempotencyKey) jobsByIdempotencyKey.delete(job.idempotencyKey);
        jobs.delete(id);
      }
    }
  }, CLEANUP_INTERVAL);
}

export function stopCleanupInterval() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  if (sqlClient) {
    sqlClient.end({ timeout: 1 }).catch(() => undefined);
    sqlClient = null;
    postgresAvailable = false;
  }
}

async function ensureInitialized(): Promise<void> {
  if (initializationStarted) {
    if (initializationPromise) await initializationPromise;
    return;
  }
  initializationStarted = true;
  await initializePersistence();
}

export function createJob(
  id: string,
  tenantId: string,
  idempotencyKey?: string,
): JobInfo {
  if (!initializationStarted) {
    initializationStarted = true;
    initializePersistence().catch(() => undefined);
  }

  if (jobs.size >= MAX_SYSTEM_CAPACITY) {
    const err = new Error(
      "CapacityError: O sistema atingiu a capacidade máxima.",
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
  if (idempotencyKey) jobsByIdempotencyKey.set(idempotencyKey, id);

  jobRepository.upsert(id, tenantId, "queued", 0).catch(() => undefined);
  return job;
}

export function getJob(id: string): JobInfo | null {
  return jobs.get(id) || null;
}

export async function getJobWithPersistence(
  id: string,
  tenantId?: string,
): Promise<JobInfo | null> {
  await ensureInitialized();
  const inMemory = jobs.get(id);
  if (inMemory && (!tenantId || inMemory.tenantId === tenantId))
    return inMemory;
  return fetchJobFromPostgres(id, tenantId);
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  progress?: number,
): Promise<void> {
  const job = jobs.get(id);
  if (job) {
    job.status = status;
    if (progress !== undefined) job.progress = progress;
    job.updatedAt = new Date();
    jobs.set(id, job);
    await jobRepository.upsert(id, job.tenantId, status, job.progress);
  }
}

export async function completeJob(id: string, result: any): Promise<void> {
  const job = jobs.get(id);
  if (job) {
    job.status = "completed";
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date();
    jobs.set(id, job);
    await jobRepository.complete(id, job.tenantId, result);
  }
}

export async function failJob(id: string, error: string): Promise<void> {
  const job = jobs.get(id);
  if (job) {
    job.status = "failed";
    job.error = error;
    job.updatedAt = new Date();
    job.attempts = (job.attempts || 0) + 1;
    jobs.set(id, job);
    await jobRepository.fail(id, job.tenantId, error);
  }
}

export function shouldProcessJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return true;
  if (job.status === "completed" || job.status === "processing") return false;
  if (job.status === "failed" && (job.attempts || 0) >= 3) return false;
  return true;
}

export function computeIdempotencyKey(params: Record<string, unknown>): string {
  const canonical = JSON.stringify(params, Object.keys(params).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function findOrCreateJob(
  id: string,
  tenantId: string,
  idempotencyKey: string,
): JobInfo {
  const existingId = jobsByIdempotencyKey.get(idempotencyKey);
  if (existingId) {
    const existing = jobs.get(existingId);
    if (
      existing &&
      existing.status !== "completed" &&
      existing.status !== "failed"
    )
      return existing;
    jobsByIdempotencyKey.delete(idempotencyKey);
  }
  return createJob(id, tenantId, idempotencyKey);
}
