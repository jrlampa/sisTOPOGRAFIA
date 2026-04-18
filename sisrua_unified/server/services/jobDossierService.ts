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

type FailedTaskClass =
  | "missing_input"
  | "python_runtime"
  | "not_reprocessable"
  | "other";

interface FailedTaskRow {
  task_id: string;
  status: string;
  attempts: number | null;
  error: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface FailedTaskSanitationEntry {
  taskId: string;
  error?: string;
  classification: FailedTaskClass;
  source: string;
  requestId?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  action: "cancel" | "requeue" | "skip";
}

export interface FailedTaskSanitationPreview {
  analyzed: number;
  byClassification: Record<FailedTaskClass, number>;
  bySource: Record<string, number>;
  entries: FailedTaskSanitationEntry[];
}

export interface FailedTaskSanitationResult extends FailedTaskSanitationPreview {
  cancelled: number;
  requeued: number;
  skipped: number;
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

function extractPayloadValue(
  payload: Record<string, unknown> | null,
  key: string,
): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  return payload[key];
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function isCoreInputValid(payload: Record<string, unknown> | null): boolean {
  const lat = toFiniteNumber(extractPayloadValue(payload, "lat"));
  const lon = toFiniteNumber(extractPayloadValue(payload, "lon"));
  const radius = toFiniteNumber(extractPayloadValue(payload, "radius"));

  return (
    lat !== undefined &&
    lon !== undefined &&
    radius !== undefined &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    radius >= 10 &&
    radius <= 5000
  );
}

function normalizeError(error: string | null | undefined): string {
  return (error ?? "").toLowerCase();
}

function classifyFailedTask(row: FailedTaskRow): FailedTaskClass {
  const errorText = normalizeError(row.error);
  const hasInvalidCoreInput = !isCoreInputValid(row.payload);

  if (
    hasInvalidCoreInput ||
    errorText.includes("missing required parameters") ||
    errorText.includes("invalid dxf input fields") ||
    errorText.includes("invalid queued payload fields") ||
    errorText.includes("lat=undefined") ||
    errorText.includes("lon=undefined") ||
    errorText.includes("radius=undefined")
  ) {
    return "missing_input";
  }

  if (
    errorText.includes("python script") ||
    errorText.includes("failed to spawn python") ||
    errorText.includes("python worker") ||
    errorText.includes("module not found") ||
    errorText.includes("no module named")
  ) {
    return isCoreInputValid(row.payload)
      ? "python_runtime"
      : "not_reprocessable";
  }

  return "other";
}

function extractSource(
  payload: Record<string, unknown> | null,
): { source: string; requestId?: string } {
  const requestMeta =
    payload && typeof payload.requestMeta === "object"
      ? (payload.requestMeta as Record<string, unknown>)
      : null;

  const sourceCandidate =
    (typeof requestMeta?.source === "string" && requestMeta.source) ||
    (typeof requestMeta?.endpoint === "string" && requestMeta.endpoint) ||
    "unknown_source";

  const requestId =
    typeof requestMeta?.requestId === "string" && requestMeta.requestId
      ? requestMeta.requestId
      : undefined;

  return {
    source: sourceCandidate,
    ...(requestId ? { requestId } : {}),
  };
}

function buildSanitationEntry(row: FailedTaskRow): FailedTaskSanitationEntry {
  const classification = classifyFailedTask(row);
  const payload = row.payload;
  const source = extractSource(payload);

  const lat = toFiniteNumber(extractPayloadValue(payload, "lat"));
  const lon = toFiniteNumber(extractPayloadValue(payload, "lon"));
  const radius = toFiniteNumber(extractPayloadValue(payload, "radius"));

  const action: FailedTaskSanitationEntry["action"] =
    classification === "missing_input"
      ? "cancel"
      : classification === "python_runtime"
        ? "requeue"
        : "skip";

  return {
    taskId: row.task_id,
    ...(row.error ? { error: row.error } : {}),
    classification,
    source: source.source,
    ...(source.requestId ? { requestId: source.requestId } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lon !== undefined ? { lon } : {}),
    ...(radius !== undefined ? { radius } : {}),
    action,
  };
}

async function fetchFailedTasks(limit: number): Promise<FailedTaskRow[]> {
  if (!sqlClient) {
    return [];
  }

  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), 500);
  const rows = (await sqlClient.unsafe(
    `SELECT task_id, status, attempts, error, payload, created_at, updated_at
       FROM dxf_tasks
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT $1`,
    [safeLimit],
  )) as FailedTaskRow[];

  return rows;
}

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

export async function previewFailedTaskSanitation(
  limit = 200,
): Promise<FailedTaskSanitationPreview> {
  await initConnection();
  if (!available || !sqlClient) {
    return {
      analyzed: 0,
      byClassification: {
        missing_input: 0,
        python_runtime: 0,
        not_reprocessable: 0,
        other: 0,
      },
      bySource: {},
      entries: [],
    };
  }

  const rows = await fetchFailedTasks(limit);
  const entries = rows.map(buildSanitationEntry);

  const byClassification: Record<FailedTaskClass, number> = {
    missing_input: 0,
    python_runtime: 0,
    not_reprocessable: 0,
    other: 0,
  };
  const bySource: Record<string, number> = {};

  for (const entry of entries) {
    byClassification[entry.classification] += 1;
    bySource[entry.source] = (bySource[entry.source] ?? 0) + 1;
  }

  return {
    analyzed: entries.length,
    byClassification,
    bySource,
    entries,
  };
}

export async function sanitizeAndReprocessFailedTasks(
  limit = 200,
): Promise<FailedTaskSanitationResult> {
  await initConnection();
  if (!available || !sqlClient) {
    return {
      analyzed: 0,
      byClassification: {
        missing_input: 0,
        python_runtime: 0,
        not_reprocessable: 0,
        other: 0,
      },
      bySource: {},
      entries: [],
      cancelled: 0,
      requeued: 0,
      skipped: 0,
    };
  }

  const preview = await previewFailedTaskSanitation(limit);
  let cancelled = 0;
  let requeued = 0;
  let skipped = 0;

  for (const entry of preview.entries) {
    if (entry.action === "cancel") {
      const updated = (await sqlClient.unsafe(
        `UPDATE dxf_tasks
            SET status = 'cancelled',
                error = COALESCE(error, 'Sanitized by admin: missing_input') || ' | sanitized=missing_input',
                finished_at = NOW(),
                updated_at = NOW()
          WHERE task_id = $1
            AND status = 'failed'
          RETURNING task_id`,
        [entry.taskId],
      )) as Array<{ task_id: string }>;

      if (updated.length > 0) {
        cancelled += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    if (entry.action === "requeue") {
      const updated = (await sqlClient.unsafe(
        `UPDATE dxf_tasks
            SET status = 'queued',
                attempts = 0,
                error = NULL,
                started_at = NULL,
                finished_at = NULL,
                updated_at = NOW()
          WHERE task_id = $1
            AND status = 'failed'
          RETURNING task_id`,
        [entry.taskId],
      )) as Array<{ task_id: string }>;

      if (updated.length > 0) {
        requeued += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    skipped += 1;
  }

  logger.info("JobDossierService: failed-task sanitation executed", {
    analyzed: preview.analyzed,
    cancelled,
    requeued,
    skipped,
  });

  return {
    ...preview,
    cancelled,
    requeued,
    skipped,
  };
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
