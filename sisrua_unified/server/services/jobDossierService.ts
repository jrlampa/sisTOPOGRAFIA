/**
 * Job Dossier Service
 *
 * Item 3 — Orquestração Confiável de Jobs (Roadmap T1)
 *
 * Provê visibilidade completa e replay controlado do ciclo de vida dos jobs DXF:
 *   - getJobDossier  — dossiê completo de um job (status, tentativas, hash, payload resumido)
 *   - listRecentJobs — listagem paginada dos jobs mais recentes
 *   - replayFailedTask — recolocação controlada de job 'failed' na fila
 *
 * Opera diretamente sobre a tabela `dxf_tasks` (serviço-role, mesma DB do queue).
 */

import postgres from "postgres";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DossierStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

/** Vista auditável de um job — sem dados sensíveis do payload completo. */
export interface JobDossierEntry {
  taskId: string;
  status: DossierStatus;
  attempts: number;
  idempotencyKey?: string;
  artifactSha256?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Resumo dos parâmetros de geração (sem contexto BT completo). */
  request?: {
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    projection: string;
  };
}

export interface ReplayResult {
  taskId: string;
  replayed: boolean;
  message: string;
}

// ─── Connection ───────────────────────────────────────────────────────────────

let sqlClient: ReturnType<typeof postgres> | null = null;
let available = false;
let initDone = false;

async function initConnection(): Promise<void> {
  if (initDone) return;
  initDone = true;

  if (!config.DATABASE_URL) {
    logger.warn(
      "JobDossierService: DATABASE_URL não configurado — modo no-op ativo",
    );
    return;
  }

  try {
    sqlClient = postgres(config.DATABASE_URL, {
      ssl: config.NODE_ENV === "production" ? "require" : undefined,
      max: 2,
      connect_timeout: 8,
      idle_timeout: 10,
    });
    available = true;
    logger.info("JobDossierService: conexão Postgres estabelecida");
  } catch (err) {
    logger.warn("JobDossierService: Postgres indisponível", { err });
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): JobDossierEntry {
  const p = row.payload as Record<string, unknown> | null;
  return {
    taskId: String(row.task_id),
    status: String(row.status) as DossierStatus,
    attempts: Number(row.attempts ?? 0),
    idempotencyKey:
      row.idempotency_key != null ? String(row.idempotency_key) : undefined,
    artifactSha256:
      row.artifact_sha256 != null ? String(row.artifact_sha256) : undefined,
    error: row.error != null ? String(row.error) : undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    startedAt:
      row.started_at != null
        ? (row.started_at as Date).toISOString()
        : undefined,
    finishedAt:
      row.finished_at != null
        ? (row.finished_at as Date).toISOString()
        : undefined,
    request: p
      ? {
          lat: Number(p.lat),
          lon: Number(p.lon),
          radius: Number(p.radius),
          mode: String(p.mode ?? "circle"),
          projection: String(p.projection ?? "local"),
        }
      : undefined,
  };
}

const DOSSIER_SELECT = `
  SELECT task_id, status, attempts, idempotency_key, artifact_sha256,
         error, created_at, updated_at, started_at, finished_at, payload
  FROM dxf_tasks
`;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retorna o dossiê completo de um job pelo task_id.
 * Retorna null se o job não existir ou o banco estiver indisponível.
 */
export async function getJobDossier(
  taskId: string,
): Promise<JobDossierEntry | null> {
  await initConnection();
  if (!available || !sqlClient) return null;

  const rows = (await sqlClient.unsafe(
    `${DOSSIER_SELECT} WHERE task_id = $1 LIMIT 1`,
    [taskId],
  )) as Record<string, unknown>[];

  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/**
 * Lista os jobs mais recentes (máx. 200).
 * Ordena por created_at DESC.
 */
export async function listRecentJobs(
  limit = 50,
): Promise<JobDossierEntry[]> {
  await initConnection();
  if (!available || !sqlClient) return [];

  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), 200);
  const rows = (await sqlClient.unsafe(
    `${DOSSIER_SELECT} ORDER BY created_at DESC LIMIT $1`,
    [safeLimit],
  )) as Record<string, unknown>[];

  return rows.map(mapRow);
}

/**
 * Recoloca um job em estado 'failed' na fila para reprocessamento.
 *
 * Replay controlado:
 *  - Só pode ser feito sobre jobs em status 'failed'.
 *  - Reseta attempts para 0 (nova chance completa de MAX_ATTEMPTS).
 *  - Limpa error, started_at, finished_at.
 *
 * Idempotente: chamar duas vezes sobre um job já recolocado retorna
 * replayed=false com mensagem indicando o status atual.
 */
export async function replayFailedTask(
  taskId: string,
): Promise<ReplayResult> {
  await initConnection();
  if (!available || !sqlClient) {
    return {
      taskId,
      replayed: false,
      message: "Persistência de fila indisponível — replay não executado",
    };
  }

  const updated = (await sqlClient.unsafe(
    `UPDATE dxf_tasks
        SET status      = 'queued',
            attempts    = 0,
            error       = NULL,
            started_at  = NULL,
            finished_at = NULL,
            updated_at  = NOW()
      WHERE task_id = $1
        AND status  = 'failed'
      RETURNING task_id`,
    [taskId],
  )) as Record<string, unknown>[];

  if (updated.length > 0) {
    logger.info("JobDossierService: replay controlado executado", { taskId });
    return {
      taskId,
      replayed: true,
      message: "Tarefa recolocada na fila para reprocessamento",
    };
  }

  // Job não encontrado ou não está em estado 'failed'
  const check = (await sqlClient.unsafe(
    `SELECT status FROM dxf_tasks WHERE task_id = $1 LIMIT 1`,
    [taskId],
  )) as Record<string, unknown>[];

  const message =
    check.length === 0
      ? "Tarefa não encontrada"
      : `Replay inválido — status atual: '${check[0].status}' (esperado: 'failed')`;

  logger.warn("JobDossierService: replay recusado", { taskId, message });
  return { taskId, replayed: false, message };
}

/** Fecha conexão (para testes e graceful shutdown). */
export async function closeJobDossierConnection(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 3 }).catch(() => undefined);
    sqlClient = null;
  }
  available = false;
  initDone = false;
}
