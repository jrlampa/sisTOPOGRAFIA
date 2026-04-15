/**
 * JobRepository – Repository Pattern (Item 2).
 *
 * Owns all SQL against the `jobs` table. Business logic (in-memory map,
 * progress callbacks, fallback) stays in jobStatusService.ts.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface JobRow {
  id: string;
  status: JobStatus;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
}

export interface JobResultPayload {
  url: string;
  filename: string;
  btContextUrl?: string;
  artifactSha256?: string;
}

export interface IJobRepository {
  upsert(id: string, status: JobStatus, progress: number): Promise<void>;
  complete(id: string, result: JobResultPayload): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  findById(id: string): Promise<JobRow | null>;
  findRecent(limit: number): Promise<JobRow[]>;
  deleteOld(
    completedMaxAgeMs: number,
    absoluteMaxAgeMs: number,
  ): Promise<number>;
}

// ── Implementation ────────────────────────────────────────────────────────────

export class PostgresJobRepository implements IJobRepository {
  async upsert(id: string, status: JobStatus, progress: number): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    try {
      await sql.unsafe(
        `INSERT INTO jobs (id, status, progress, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE
           SET status = EXCLUDED.status,
               progress = EXCLUDED.progress,
               updated_at = NOW()`,
        [id, status, progress],
      );
    } catch (err) {
      logger.warn("[JobRepository] upsert failed", { id, err });
    }
  }

  async complete(id: string, result: JobResultPayload): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    try {
      await sql.unsafe(
        `UPDATE jobs
         SET status = 'completed',
             progress = 100,
             result = $2::jsonb,
             artifact_sha256 = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [id, JSON.stringify(result), result.artifactSha256 ?? null],
      );
    } catch (err) {
      logger.warn("[JobRepository] complete failed", { id, err });
    }
  }

  async fail(id: string, error: string): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    try {
      await sql.unsafe(
        `UPDATE jobs
         SET status = 'failed', error = $2, updated_at = NOW()
         WHERE id = $1`,
        [id, error],
      );
    } catch (err) {
      logger.warn("[JobRepository] fail failed", { id, err });
    }
  }

  async findById(id: string): Promise<JobRow | null> {
    const sql = getDbClient();
    if (!sql) return null;
    const rows = await sql.unsafe(
      `SELECT id, status, progress, result, error, created_at, updated_at, attempts
       FROM jobs WHERE id = $1 LIMIT 1`,
      [id],
    );
    const r = (rows as any[])[0];
    if (!r) return null;
    return _mapRow(r);
  }

  async findRecent(limit: number): Promise<JobRow[]> {
    const sql = getDbClient();
    if (!sql) return [];
    const rows = await sql.unsafe(
      `SELECT id, status, progress, result, error, created_at, updated_at, attempts
       FROM jobs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return (rows as any[]).map(_mapRow);
  }

  async deleteOld(
    completedMaxAgeMs: number,
    absoluteMaxAgeMs: number,
  ): Promise<number> {
    const sql = getDbClient();
    if (!sql) return 0;
    const result = await sql.unsafe(
      `WITH deleted AS (
         DELETE FROM jobs
         WHERE (status IN ('completed','failed') AND updated_at < NOW() - ($1::numeric * interval '1 millisecond'))
            OR created_at < NOW() - ($2::numeric * interval '1 millisecond')
         RETURNING id
       ) SELECT COUNT(*) AS cnt FROM deleted`,
      [completedMaxAgeMs, absoluteMaxAgeMs],
    );
    return Number((result as any[])[0]?.cnt ?? 0);
  }
}

function _mapRow(r: any): JobRow {
  return {
    id: r.id,
    status: r.status as JobStatus,
    progress: Number(r.progress ?? 0),
    result: r.result ?? null,
    error: r.error ?? null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    attempts: Number(r.attempts ?? 0),
  };
}

// Default singleton
export const jobRepository: IJobRepository = new PostgresJobRepository();
