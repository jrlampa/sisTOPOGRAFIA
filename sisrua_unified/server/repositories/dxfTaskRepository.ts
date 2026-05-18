/**
 * DxfTaskRepository – Repository Pattern (Item 2).
 *
 * Owns all SQL against the `dxf_tasks` table. Includes concurrency-safe
 * dequeue using SELECT … FOR UPDATE SKIP LOCKED.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";
import type { DbDxfTaskRow, DbJson } from "../../shared/dbTypes.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DxfTaskStatus = "queued" | "processing" | "completed" | "failed";

export interface DxfTaskPayload {
  lat: number;
  lon: number;
  radius: number;
  outputFile?: string;
  layers?: Record<string, boolean>;
  mode?: string;
  polygon?: string;
  projection?: string;
  contourRenderMode?: string;
  btContext?: Record<string, unknown> | null;
  mtContext?: Record<string, unknown> | null;
}

export interface DxfTaskRow {
  taskId: string;
  status: DxfTaskStatus;
  payload: DxfTaskPayload;
  attempts: number;
  idempotencyKey: string | null;
  error: string | null;
  artifactSha256: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface IDxfTaskRepository {
  enqueue(
    taskId: string,
    payload: DxfTaskPayload,
    idempotencyKey?: string,
  ): Promise<boolean>;
  dequeue(): Promise<DxfTaskRow | null>;
  setProcessing(taskId: string): Promise<void>;
  setCompleted(taskId: string, artifactSha256?: string): Promise<void>;
  setFailed(taskId: string, error: string): Promise<void>;
  findByIdempotencyKey(key: string): Promise<DxfTaskRow | null>;
  findById(taskId: string): Promise<DxfTaskRow | null>;
}

// ── Implementation ────────────────────────────────────────────────────────────

export class PostgresDxfTaskRepository implements IDxfTaskRepository {
  /** Returns true if a new row was inserted (false = duplicate via idempotency_key). */
  async enqueue(
    taskId: string,
    payload: DxfTaskPayload,
    idempotencyKey?: string,
  ): Promise<boolean> {
    const sql = getDbClient();
    if (!sql) return false;
    try {
      const result = await sql.unsafe(
        `INSERT INTO dxf_tasks (task_id, status, payload, idempotency_key)
         VALUES ($1, 'queued', $2::jsonb, $3)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL AND status NOT IN ('failed', 'cancelled') DO NOTHING
         RETURNING task_id`,
        [taskId, JSON.stringify(payload), idempotencyKey ?? null],
      );
      return (result as unknown[]).length > 0;
    } catch (err) {
      logger.warn("[DxfTaskRepository] enqueue failed", { taskId, err });
      return false;
    }
  }

  /** Concurrency-safe dequeue – only one worker claims each task. */
  async dequeue(): Promise<DxfTaskRow | null> {
    const sql = getDbClient();
    if (!sql) return null;
    const rows = await sql.unsafe(
      `WITH claimed AS (
         SELECT task_id FROM dxf_tasks
         WHERE status = 'queued'
         ORDER BY created_at
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE dxf_tasks t
       SET status = 'processing', started_at = NOW(), attempts = attempts + 1, updated_at = NOW()
       FROM claimed
       WHERE t.task_id = claimed.task_id
       RETURNING t.*`,
    );
    const r = (rows as unknown as RawDxfTaskRow[])[0];
    return r ? _mapRow(r as RawDxfTaskRow) : null;
  }

  async setProcessing(taskId: string): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    await sql.unsafe(
      `UPDATE dxf_tasks SET status = 'processing', started_at = NOW(), updated_at = NOW()
       WHERE task_id = $1`,
      [taskId],
    );
  }

  async setCompleted(taskId: string, artifactSha256?: string): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    await sql.unsafe(
      `UPDATE dxf_tasks
       SET status = 'completed', artifact_sha256 = $2, finished_at = NOW(), updated_at = NOW()
       WHERE task_id = $1`,
      [taskId, artifactSha256 ?? null],
    );
  }

  async setFailed(taskId: string, error: string): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    await sql.unsafe(
      `UPDATE dxf_tasks
       SET status = 'failed', error = $2, finished_at = NOW(), updated_at = NOW()
       WHERE task_id = $1`,
      [taskId, error],
    );
  }

  async findByIdempotencyKey(key: string): Promise<DxfTaskRow | null> {
    const sql = getDbClient();
    if (!sql) return null;
    const rows = await sql.unsafe(
      `SELECT * FROM dxf_tasks WHERE idempotency_key = $1 LIMIT 1`,
      [key],
    );
    const r = (rows as unknown as RawDxfTaskRow[])[0];
    return r ? _mapRow(r as RawDxfTaskRow) : null;
  }

  async findById(taskId: string): Promise<DxfTaskRow | null> {
    const sql = getDbClient();
    if (!sql) return null;
    const rows = await sql.unsafe(
      `SELECT * FROM dxf_tasks WHERE task_id = $1 LIMIT 1`,
      [taskId],
    );
    const r = (rows as unknown as RawDxfTaskRow[])[0];
    return r ? _mapRow(r as RawDxfTaskRow) : null;
  }
}

type RawDxfTaskRow = DbDxfTaskRow & { payload: DbJson | string };

function _mapRow(r: RawDxfTaskRow): DxfTaskRow {
  return {
    taskId: r.task_id,
    status: r.status as DxfTaskStatus,
    payload:
      (typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload) as
        DxfTaskPayload,
    attempts: Number(r.attempts ?? 0),
    idempotencyKey: r.idempotency_key ?? null,
    error: r.error ?? null,
    artifactSha256: r.artifact_sha256 ?? null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    startedAt: r.started_at ? new Date(r.started_at) : null,
    finishedAt: r.finished_at ? new Date(r.finished_at) : null,
  };
}

export const dxfTaskRepository: IDxfTaskRepository =
  new PostgresDxfTaskRepository();
