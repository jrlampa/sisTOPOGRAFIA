import { logger } from "../utils/logger.js";
import { createHash } from "crypto";
import postgres from "postgres";
import { config } from "../config.js";
import { jobRepository } from "../repositories/jobRepository.js";
import { redisService } from "./redisService.js";

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

export const MAX_SYSTEM_CAPACITY = 2000;

const USE_SUPABASE_JOBS = config.useSupabaseJobs;
const DATABASE_URL = config.DATABASE_URL;
const JOBS_TABLE = "jobs";

type SqlClient = ReturnType<typeof postgres>;

let postgresAvailable = false;
let sqlClient: SqlClient | null = null;

const MAX_JOB_AGE = config.JOB_MAX_AGE_MS;

let initializationStarted = false;
let initializationPromise: Promise<void> | null = null;

export function resetServiceState(): void {
  initializationStarted = false;
  initializationPromise = null;
  postgresAvailable = false;
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
    } catch (error) {
      logger.warn("JobStatusService: Postgres unavailable", { error });
      postgresAvailable = false;
      if (sqlClient) {
        await sqlClient.end({ timeout: 1 }).catch(() => undefined);
        sqlClient = null;
      }
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
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
      await saveJobToRedis(job);
      return job;
    }
    return null;
  } catch (error) {
    logger.error("Failed to fetch job from Postgres", { jobId: id, error });
    return null;
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

async function getJobFromRedis(id: string): Promise<JobInfo | null> {
  const data = await redisService.get(`job:${id}`);
  if (!data) return null;
  try {
    const job = JSON.parse(data);
    job.createdAt = new Date(job.createdAt);
    job.updatedAt = new Date(job.updatedAt);
    return job;
  } catch (err) {
    return null;
  }
}

async function saveJobToRedis(job: JobInfo): Promise<void> {
  await redisService.set(`job:${job.id}`, JSON.stringify(job), Math.ceil(MAX_JOB_AGE / 1000));
  if (job.idempotencyKey) {
    await redisService.set(`job_idemp:${job.idempotencyKey}`, job.id, Math.ceil(MAX_JOB_AGE / 1000));
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

export async function createJob(
  id: string,
  tenantId: string,
  idempotencyKey?: string,
): Promise<JobInfo> {
  await ensureInitialized();

  // Capacity check: prevent system overload (Chaos Audit Item C9)
  try {
    const keys = await redisService.getJobKeys();
    if (keys.length >= MAX_SYSTEM_CAPACITY) {
      const error = new Error(`System capacity reached: ${MAX_SYSTEM_CAPACITY} active jobs limit.`);
      (error as any).code = "ERR_CAPACITY";
      throw error;
    }
  } catch (err: any) {
    if (err.code === "ERR_CAPACITY") throw err;
    // Log other redis errors but continue (best effort)
    logger.warn("JobStatusService: Capacity check failed", { error: err.message });
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
  
  await saveJobToRedis(job);
  jobRepository.upsert(id, tenantId, "queued", 0).catch(() => undefined);
  return job;
}

export async function getJob(id: string): Promise<JobInfo | null> {
  return getJobFromRedis(id);
}

export async function getJobWithPersistence(
  id: string,
  tenantId?: string,
): Promise<JobInfo | null> {
  await ensureInitialized();
  const inRedis = await getJobFromRedis(id);
  if (inRedis && (!tenantId || inRedis.tenantId === tenantId))
    return inRedis;
  return fetchJobFromPostgres(id, tenantId);
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  progress?: number,
): Promise<void> {
  const job = await getJobFromRedis(id);
  if (job) {
    job.status = status;
    if (progress !== undefined) job.progress = progress;
    job.updatedAt = new Date();
    await saveJobToRedis(job);
    await jobRepository.upsert(id, job.tenantId, status, job.progress);
  }
}

export async function completeJob(id: string, result: any): Promise<void> {
  const job = await getJobFromRedis(id);
  if (job) {
    job.status = "completed";
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date();
    await saveJobToRedis(job);
    await jobRepository.complete(id, job.tenantId, result);
  }
}

export async function failJob(id: string, error: string): Promise<void> {
  const job = await getJobFromRedis(id);
  if (job) {
    job.status = "failed";
    job.error = error;
    job.updatedAt = new Date();
    job.attempts = (job.attempts || 0) + 1;
    await saveJobToRedis(job);
    await jobRepository.fail(id, job.tenantId, error);
  }
}

export async function shouldProcessJob(id: string): Promise<boolean> {
  const job = await getJobFromRedis(id);
  if (!job) return true;
  if (job.status === "completed" || job.status === "processing") return false;
  if (job.status === "failed" && (job.attempts || 0) >= 3) return false;
  return true;
}

export function computeIdempotencyKey(params: Record<string, unknown>): string {
  const canonical = JSON.stringify(params, Object.keys(params).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function stopCleanupInterval(): void {
  // No-op for current architecture, maintained for test compatibility
  logger.info("JobStatusService: stopCleanupInterval called (no-op)");
}

export async function findOrCreateJob(
  id: string,
  tenantId: string,
  idempotencyKey: string,
): Promise<JobInfo> {
  const existingId = await redisService.get(`job_idemp:${idempotencyKey}`);
  if (existingId) {
    const existing = await getJobFromRedis(existingId);
    if (
      existing &&
      existing.status !== "completed" &&
      existing.status !== "failed"
    )
      return existing;
    await redisService.del(`job_idemp:${idempotencyKey}`);
  }
  return createJob(id, tenantId, idempotencyKey);
}
