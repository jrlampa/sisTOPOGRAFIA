import postgres from "postgres";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "../utils/logger.js";
import { generateDxf } from "../pythonBridge.js";
import {
  completeJob,
  createJob,
  failJob,
  updateJobStatus,
} from "./jobStatusService.js";
import { setCachedFilename } from "./cacheService.js";
import { scheduleDxfDeletion } from "./dxfCleanupService.js";
import { config } from "../config.js";

export interface DxfTaskPayload {
  taskId: string;
  lat: number;
  lon: number;
  radius: number;
  mode: string;
  polygon: string;
  layers: Record<string, unknown>;
  projection: string;
  contourRenderMode: "spline" | "polyline";
  btContext?: Record<string, unknown> | null;
  outputFile: string;
  filename: string;
  cacheKey: string;
  downloadUrl: string;
}

export interface TaskCreationResult {
  taskId: string;
  taskName: string;
  alreadyCompleted?: boolean;
}

type QueueRow = {
  task_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  payload: DxfTaskPayload;
  attempts: number;
};

const MAX_ATTEMPTS = 3;
const WORKER_INTERVAL_MS = 2_000;
const WORKER_CONCURRENCY = config.DXF_WORKER_CONCURRENCY;

let sqlClient: ReturnType<typeof postgres> | null = null;
let postgresAvailable = false;
let queueInitialized = false;
let workerStarted = false;
let workerInterval: NodeJS.Timeout | null = null;
let activeWorkers = 0;

const TOPOLOGY_ONLY_WARNING =
  "Sem dados no servidor, DXF gerado com topologia.";

function extractTopologyOnlyWarning(
  pythonOutput: string,
): string | undefined {
  const normalizedOutput = pythonOutput.toLowerCase();
  const hasNoOsmIndicator =
    normalizedOutput.includes("nenhuma feição osm encontrada") ||
    normalizedOutput.includes("nenhuma feicao osm encontrada") ||
    normalizedOutput.includes("dxf será gerado apenas com a topologia bt") ||
    normalizedOutput.includes("dxf sera gerado apenas com a topologia bt");

  return hasNoOsmIndicator ? TOPOLOGY_ONLY_WARNING : undefined;
}

function persistBtContextSidecar(
  outputFile: string,
  btContext: Record<string, unknown> | null | undefined,
  artifactSha256?: string,
): string | null {
  if (!btContext || Object.keys(btContext).length === 0) {
    return null;
  }

  const ext = path.extname(outputFile);
  const base = ext ? outputFile.slice(0, -ext.length) : outputFile;
  const sidecarPath = `${base}_bt_context.json`;
  const payload = {
    generatedAt: new Date().toISOString(),
    artifactSha256: artifactSha256 ?? null, // Roadmap #72: hash de proveniência
    btContext,
  };

  fs.writeFileSync(sidecarPath, JSON.stringify(payload, null, 2), "utf-8");
  return sidecarPath;
}

/**
 * Computa SHA-256 do arquivo gerado para rastreabilidade de artefato.
 * Roadmap Item 72: Assinatura de hash SHA-256 por artefato.
 */
function computeArtifactSha256(filePath: string): string | null {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
  } catch (err) {
    logger.warn("Falha ao computar SHA-256 do artefato", { filePath, err });
    return null;
  }
}

async function initializeQueuePersistence(): Promise<void> {
  if (queueInitialized) {
    return;
  }
  queueInitialized = true;

  if (!config.DATABASE_URL) {
    logger.warn("Queue persistence disabled: DATABASE_URL not configured");
    return;
  }

  try {
    sqlClient = postgres(config.DATABASE_URL, {
      ssl: config.NODE_ENV === "production" ? "require" : undefined,
      max: Math.max(2, WORKER_CONCURRENCY + 1),
      connect_timeout: 8,
      idle_timeout: 10,
    });

    // Removed implicit DDL (create table if not exists). This is now handled by migration files.

    postgresAvailable = true;
    logger.info("DXF queue persistence enabled (Supabase/Postgres)");
  } catch (error) {
    postgresAvailable = false;
    logger.warn(
      "DXF queue persistence unavailable, using local async fallback",
      { error },
    );
    if (sqlClient) {
      await sqlClient.end({ timeout: 3 }).catch(() => undefined);
      sqlClient = null;
    }
  }
}

async function markTaskState(
  taskId: string,
  status: QueueRow["status"],
  error?: string,
): Promise<void> {
  if (!postgresAvailable || !sqlClient) {
    return;
  }

  await sqlClient.unsafe(
    `
      update dxf_tasks
      set status = $2,
          error = $3,
          updated_at = now(),
          finished_at = case when $2 in ('completed','failed') then now() else finished_at end
      where task_id = $1
    `,
    [taskId, status, error ?? null],
  );
}

async function processPayload(incomingPayload: any): Promise<void> {
  // Defensive: Handle case where payload might be a string (depending on PG driver config)
  const payload: DxfTaskPayload =
    typeof incomingPayload === "string"
      ? JSON.parse(incomingPayload)
      : incomingPayload;

  logger.info("[CloudTasksService] Processing payload", {
    taskId: payload.taskId,
    lat: payload.lat,
    lon: payload.lon,
    radius: payload.radius,
  });
  await updateJobStatus(payload.taskId, "processing", 15);

  const pythonOutput = await generateDxf({
    lat: payload.lat,
    lon: payload.lon,
    radius: payload.radius,
    mode: payload.mode,
    polygon: payload.polygon,
    layers: payload.layers as Record<string, boolean>,
    projection: payload.projection,
    contourRenderMode: payload.contourRenderMode,
    btContext: payload.btContext ?? null,
    outputFile: payload.outputFile,
  });
  const warning = extractTopologyOnlyWarning(pythonOutput);

  // Roadmap #72: SHA-256 do artefato DXF gerado para proveniência e integridade
  const artifactSha256 = computeArtifactSha256(payload.outputFile);
  if (artifactSha256) {
    logger.info("SHA-256 do artefato DXF computado", {
      taskId: payload.taskId,
      sha256: artifactSha256,
    });
    if (postgresAvailable && sqlClient) {
      await sqlClient
        .unsafe(
          `UPDATE dxf_tasks SET artifact_sha256 = $2 WHERE task_id = $1`,
          [payload.taskId, artifactSha256],
        )
        .catch((err) =>
          logger.warn("Falha ao persistir artifact_sha256", { err }),
        );
    }
  }

  const btContextSidecarPath = persistBtContextSidecar(
    payload.outputFile,
    payload.btContext,
    artifactSha256 ?? undefined,
  );
  const btContextUrl = btContextSidecarPath
    ? payload.downloadUrl.replace(/\.dxf$/i, "_bt_context.json")
    : undefined;

  // Re-enable cache population for the async pipeline.
  setCachedFilename(payload.cacheKey, payload.filename);

  scheduleDxfDeletion(payload.outputFile);

  await completeJob(payload.taskId, {
    url: payload.downloadUrl,
    filename: payload.filename,
    btContextUrl,
    ...(artifactSha256 ? { artifactSha256 } : {}),
    ...(warning ? { warning } : {}),
  });
}

async function pickNextTask(): Promise<QueueRow | null> {
  if (!postgresAvailable || !sqlClient) {
    return null;
  }

  const rows = (await sqlClient.unsafe(
    `
      with next_task as (
        select task_id
        from dxf_tasks
        where status = 'queued'
        order by created_at asc
        for update skip locked
        limit 1
      )
      update dxf_tasks t
      set status = 'processing',
          updated_at = now(),
          started_at = now(),
          attempts = attempts + 1
      from next_task
      where t.task_id = next_task.task_id
      returning t.task_id, t.status, t.payload, t.attempts
    `,
  )) as QueueRow[];

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

async function processNextTask(): Promise<void> {
  if (!postgresAvailable || !sqlClient) {
    return;
  }

  activeWorkers += 1;
  try {
    const task = await pickNextTask();
    if (!task) {
      return;
    }

    try {
      await processPayload(task.payload);
      await markTaskState(task.task_id, "completed");
      logger.info("DXF task processed", {
        taskId: task.task_id,
        cacheKey: task.payload.cacheKey,
      });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(task.task_id, message);

      const nextState: QueueRow["status"] =
        task.attempts >= MAX_ATTEMPTS ? "failed" : "queued";
      if (nextState === "queued") {
        await sqlClient.unsafe(
          `
            update dxf_tasks
            set status = 'queued', error = $2, updated_at = now()
            where task_id = $1
          `,
          [task.task_id, message],
        );
      } else {
        await markTaskState(task.task_id, "failed", message);
      }

      logger.error("DXF task processing failed", {
        taskId: task.task_id,
        attempts: task.attempts,
        error: message,
        nextState,
      });
    }
  } finally {
    activeWorkers = Math.max(0, activeWorkers - 1);
  }
}

function runWorkerCycle(): void {
  if (!postgresAvailable || !sqlClient) {
    return;
  }

  const availableSlots = Math.max(0, WORKER_CONCURRENCY - activeWorkers);
  for (let slot = 0; slot < availableSlots; slot += 1) {
    processNextTask().catch((error) => {
      logger.error("DXF queue worker cycle failed", { error });
    });
  }
}

function startWorkerIfNeeded(): void {
  if (workerStarted || process.env.NODE_ENV === "test") {
    return;
  }

  workerStarted = true;
  workerInterval = setInterval(() => {
    runWorkerCycle();
  }, WORKER_INTERVAL_MS);

  runWorkerCycle();

  logger.info("DXF queue worker started", {
    intervalMs: WORKER_INTERVAL_MS,
    concurrency: WORKER_CONCURRENCY,
  });
}

export function stopTaskWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  workerStarted = false;

  if (sqlClient) {
    sqlClient.end({ timeout: 3 }).catch(() => undefined);
    sqlClient = null;
  }

  activeWorkers = 0;
  postgresAvailable = false;
  queueInitialized = false;
}

/**
 * Creates a queued DXF task.
 * Uses Supabase/Postgres persistence when available.
 * Falls back to local async processing when DB is unavailable.
 */
export async function createDxfTask(
  payload: Omit<DxfTaskPayload, "taskId">,
): Promise<TaskCreationResult> {
  await initializeQueuePersistence();
  startWorkerIfNeeded();

  // Item 71: Idempotency check — return existing non-failed task for same cacheKey
  if (postgresAvailable && sqlClient) {
    const existing = (await sqlClient.unsafe(
      `SELECT task_id, status FROM dxf_tasks
       WHERE idempotency_key = $1 AND status NOT IN ('failed')
       LIMIT 1`,
      [payload.cacheKey],
    )) as Array<{ task_id: string; status: string }>;

    if (existing.length > 0) {
      const existingTaskId = existing[0].task_id;
      logger.info("DXF task idempotency hit — returning existing task", {
        existingTaskId,
        status: existing[0].status,
        cacheKey: payload.cacheKey,
      });
      return {
        taskId: existingTaskId,
        taskName: `pg-task-${existingTaskId}`,
        alreadyCompleted: existing[0].status === "completed",
      };
    }
  }

  const taskId = uuidv4();
  const fullPayload: DxfTaskPayload = { taskId, ...payload };

  // Create the job as close as possible to queueing to avoid state races.
  createJob(taskId);

  if (postgresAvailable && sqlClient) {
    await sqlClient.unsafe(
      `INSERT INTO dxf_tasks (task_id, status, payload, attempts, idempotency_key, updated_at)
       VALUES ($1, 'queued', $2, 0, $3, now())
       ON CONFLICT (idempotency_key) WHERE status NOT IN ('failed', 'cancelled') DO NOTHING`,
      // postgres.js handles JSONB serialization of the payload object at runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [taskId, fullPayload as any, payload.cacheKey],
    );

    logger.info("DXF task queued in Supabase/Postgres", {
      taskId,
      cacheKey: payload.cacheKey,
    });

    return {
      taskId,
      taskName: `pg-task-${taskId}`,
      alreadyCompleted: false,
    };
  }

  // Local fallback keeps the API alive without hard dependency on Cloud Tasks/GCP.
  setTimeout(() => {
    processPayload(fullPayload).catch(async (error: any) => {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(taskId, message);
      logger.error("Local fallback DXF task failed", {
        taskId,
        error: message,
      });
    });
  }, 0);

  logger.warn("DXF task queued with local async fallback", {
    taskId,
    cacheKey: payload.cacheKey,
  });

  return {
    taskId,
    taskName: `local-task-${taskId}`,
    alreadyCompleted: false,
  };
}

export async function getTaskStatus(
  taskId: string,
): Promise<{ taskId: string; status: string; message?: string }> {
  if (!postgresAvailable || !sqlClient) {
    return {
      taskId,
      status: "unknown",
      message: "Queue persistence unavailable",
    };
  }

  const rows = (await sqlClient.unsafe(
    `select status, error from dxf_tasks where task_id = $1 limit 1`,
    [taskId],
  )) as Array<{ status: string; error: string | null }>;

  if (rows.length === 0) {
    return {
      taskId,
      status: "not_found",
      message: "Task not found",
    };
  }

  return {
    taskId,
    status: rows[0].status,
    ...(rows[0].error ? { message: rows[0].error } : {}),
  };
}
