/**
 * JobRepository – Repository Pattern (Item 2).
 *
 * Owns all SQL against the `jobs` table. Business logic (in-memory map,
 * progress callbacks, fallback) stays in jobStatusService.ts.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";
import type { DbJobRow, DbJson } from "../../shared/dbTypes.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobStatus = "queued" | "processing" | "completed" | "failed";

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
  upsert(id: string, tenantId: string, status: JobStatus, progress: number): Promise<void>;
  complete(id: string, tenantId: string, result: JobResultPayload): Promise<void>;
  fail(id: string, tenantId: string, error: string): Promise<void>;
  findById(id: string, tenantId?: string): Promise<JobRow | null>;
  findRecent(limit: number, tenantId?: string): Promise<JobRow[]>;
  deleteOld(
    completedMaxAgeMs: number,
    absoluteMaxAgeMs: number,
  ): Promise<number>;
}

// ── Implementation ────────────────────────────────────────────────────────────

export class PostgresJobRepository implements IJobRepository {
  async upsert(id: string, tenantId: string, status: JobStatus, progress: number): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    try {
      await sql.unsafe(
        `INSERT INTO jobs (id, tenant_id, status, progress, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT ON CONSTRAINT jobs_pkey DO UPDATE
           SET status = EXCLUDED.status,
               progress = EXCLUDED.progress,
               updated_at = NOW()`,
        [id, tenantId, status, progress],
      );
    } catch (err) {
      logger.warn("[JobRepository] upsert failed", { id, tenantId, err });
    }
  }

  async complete(id: string, tenantId: string, result: JobResultPayload): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    try {
      await sql.unsafe(
        `UPDATE jobs
         SET status = 'completed',
             progress = 100,
             result = $3::jsonb,
             artifact_sha256 = $4,
             updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId, JSON.stringify(result), result.artifactSha256 ?? null],
      );
    } catch (err) {
      logger.warn("[JobRepository] complete failed", { id, tenantId, err });
    }
  }

  async fail(id: string, tenantId: string, error: string): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    try {
      await sql.unsafe(
        `UPDATE jobs
         SET status = 'failed', error = $3, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId, error],
      );
    } catch (err) {
      logger.warn("[JobRepository] fail failed", { id, tenantId, err });
    }
  }

  async findById(id: string, tenantId?: string): Promise<JobRow | null> {
    const sql = getDbClient();
    if (!sql) return null;
    
    const rows = tenantId 
      ? await sql.unsafe(
          `SELECT id, status, progress, result, error, created_at, updated_at, attempts
           FROM jobs WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
          [id, tenantId],
        )
      : await sql.unsafe(
          `SELECT id, status, progress, result, error, created_at, updated_at, attempts
           FROM jobs WHERE id = $1 LIMIT 1`,
          [id],
        );

    const r = (rows as any[])[0];
    if (!r) return null;
    return _mapRow(r as RawJobRow);
  }

  async findRecent(limit: number, tenantId?: string): Promise<JobRow[]> {
    const sql = getDbClient();
    if (!sql) return [];
    
    const rows = tenantId
      ? await sql.unsafe(
          `SELECT id, status, progress, result, error, created_at, updated_at, attempts
           FROM jobs WHERE tenant_id = $2 ORDER BY created_at DESC LIMIT $1`,
          [limit, tenantId],
        )
      : await sql.unsafe(
          `SELECT id, status, progress, result, error, created_at, updated_at, attempts
           FROM jobs ORDER BY created_at DESC LIMIT $1`,
          [limit],
        );
        
    return (rows as any[]).map((r) => _mapRow(r as RawJobRow));
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

type RawJobRow = DbJobRow & { result: DbJson | null };

function _mapRow(r: RawJobRow): JobRow {
  return {
    id: r.id,
    status: r.status as JobStatus,
    progress: Number(r.progress ?? 0),
    result: (r.result ?? null) as Record<string, unknown> | null,
    error: r.error ?? null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    attempts: Number(r.attempts ?? 0),
  };
}

// Default singleton
export const jobRepository: IJobRepository = new PostgresJobRepository();
