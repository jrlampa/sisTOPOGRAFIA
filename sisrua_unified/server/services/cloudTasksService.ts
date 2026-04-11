import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { generateDxf } from '../pythonBridge.js';
import { completeJob, createJob, failJob, updateJobStatus } from './jobStatusService.js';
import { setCachedFilename } from './cacheService.js';
import { scheduleDxfDeletion } from './dxfCleanupService.js';
import { config } from '../config.js';

export interface DxfTaskPayload {
  taskId: string;
  lat: number;
  lon: number;
  radius: number;
  mode: string;
  polygon: string;
  layers: Record<string, unknown>;
  projection: string;
  contourRenderMode: 'spline' | 'polyline';
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
  status: 'queued' | 'processing' | 'completed' | 'failed';
  payload: DxfTaskPayload;
  attempts: number;
};

const MAX_ATTEMPTS = 3;
const WORKER_INTERVAL_MS = 2_000;

let sqlClient: ReturnType<typeof postgres> | null = null;
let postgresAvailable = false;
let queueInitialized = false;
let workerStarted = false;
let workerInterval: NodeJS.Timeout | null = null;
let workerBusy = false;

function persistBtContextSidecar(outputFile: string, btContext: Record<string, unknown> | null | undefined): string | null {
  if (!btContext || Object.keys(btContext).length === 0) {
    return null;
  }

  const ext = path.extname(outputFile);
  const base = ext ? outputFile.slice(0, -ext.length) : outputFile;
  const sidecarPath = `${base}_bt_context.json`;
  const payload = {
    generatedAt: new Date().toISOString(),
    btContext
  };

  fs.writeFileSync(sidecarPath, JSON.stringify(payload, null, 2), 'utf-8');
  return sidecarPath;
}

async function initializeQueuePersistence(): Promise<void> {
  if (queueInitialized) {
    return;
  }
  queueInitialized = true;

  if (!config.DATABASE_URL) {
    logger.warn('Queue persistence disabled: DATABASE_URL not configured');
    return;
  }

  try {
    sqlClient = postgres(config.DATABASE_URL, {
      ssl: config.NODE_ENV === 'production' ? 'require' : undefined,
      max: 2,
      connect_timeout: 8,
      idle_timeout: 10
    });

    // Removed implicit DDL (create table if not exists). This is now handled by migration files.

    postgresAvailable = true;
    logger.info('DXF queue persistence enabled (Supabase/Postgres)');
  } catch (error) {
    postgresAvailable = false;
    logger.warn('DXF queue persistence unavailable, using local async fallback', { error });
    if (sqlClient) {
      await sqlClient.end({ timeout: 3 }).catch(() => undefined);
      sqlClient = null;
    }
  }
}

async function markTaskState(taskId: string, status: QueueRow['status'], error?: string): Promise<void> {
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
    [taskId, status, error ?? null]
  );
}

async function processPayload(payload: DxfTaskPayload): Promise<void> {
  await updateJobStatus(payload.taskId, 'processing', 15);

  await generateDxf({
    lat: payload.lat,
    lon: payload.lon,
    radius: payload.radius,
    mode: payload.mode,
    polygon: payload.polygon,
    layers: payload.layers as Record<string, boolean>,
    projection: payload.projection,
    contourRenderMode: payload.contourRenderMode,
    btContext: payload.btContext ?? null,
    outputFile: payload.outputFile
  });

  const btContextSidecarPath = persistBtContextSidecar(payload.outputFile, payload.btContext);
  const btContextUrl = btContextSidecarPath
    ? payload.downloadUrl.replace(/\.dxf$/i, '_bt_context.json')
    : undefined;

  // Re-enable cache population for the async pipeline.
  setCachedFilename(payload.cacheKey, payload.filename);

  scheduleDxfDeletion(payload.outputFile);

  await completeJob(payload.taskId, {
    url: payload.downloadUrl,
    filename: payload.filename,
    btContextUrl
  });
}

async function pickNextTask(): Promise<QueueRow | null> {
  if (!postgresAvailable || !sqlClient) {
    return null;
  }

  const rows = await sqlClient.unsafe(
    `
      with next_task as (
        select task_id
        from dxf_tasks
        where status = 'queued'
        order by created_at asc
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
    `
  ) as QueueRow[];

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

async function processNextTask(): Promise<void> {
  if (!postgresAvailable || !sqlClient || workerBusy) {
    return;
  }

  workerBusy = true;
  try {
    const task = await pickNextTask();
    if (!task) {
      return;
    }

    try {
      await processPayload(task.payload);
      await markTaskState(task.task_id, 'completed');
      logger.info('DXF task processed', { taskId: task.task_id, cacheKey: task.payload.cacheKey });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(task.task_id, message);

      const nextState: QueueRow['status'] = task.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
      if (nextState === 'queued') {
        await sqlClient.unsafe(
          `
            update dxf_tasks
            set status = 'queued', error = $2, updated_at = now()
            where task_id = $1
          `,
          [task.task_id, message]
        );
      } else {
        await markTaskState(task.task_id, 'failed', message);
      }

      logger.error('DXF task processing failed', {
        taskId: task.task_id,
        attempts: task.attempts,
        error: message,
        nextState
      });
    }
  } finally {
    workerBusy = false;
  }
}

function startWorkerIfNeeded(): void {
  if (workerStarted || process.env.NODE_ENV === 'test') {
    return;
  }

  workerStarted = true;
  workerInterval = setInterval(() => {
    processNextTask().catch((error) => {
      logger.error('DXF queue worker cycle failed', { error });
    });
  }, WORKER_INTERVAL_MS);

  logger.info('DXF queue worker started', { intervalMs: WORKER_INTERVAL_MS });
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

  postgresAvailable = false;
  queueInitialized = false;
}

/**
 * Creates a queued DXF task.
 * Uses Supabase/Postgres persistence when available.
 * Falls back to local async processing when DB is unavailable.
 */
export async function createDxfTask(payload: Omit<DxfTaskPayload, 'taskId'>): Promise<TaskCreationResult> {
  const taskId = uuidv4();
  const fullPayload: DxfTaskPayload = {
    taskId,
    ...payload
  };

  // Create the job as close as possible to queueing to avoid state races.
  createJob(taskId);

  await initializeQueuePersistence();
  startWorkerIfNeeded();

  if (postgresAvailable && sqlClient) {
    await sqlClient.unsafe(
      `
        insert into dxf_tasks (task_id, status, payload, attempts, updated_at)
        values ($1, 'queued', $2::jsonb, 0, now())
      `,
      [taskId, JSON.stringify(fullPayload)]
    );

    logger.info('DXF task queued in Supabase/Postgres', {
      taskId,
      cacheKey: payload.cacheKey
    });

    return {
      taskId,
      taskName: `pg-task-${taskId}`,
      alreadyCompleted: false
    };
  }

  // Local fallback keeps the API alive without hard dependency on Cloud Tasks/GCP.
  setTimeout(() => {
    processPayload(fullPayload).catch(async (error: any) => {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(taskId, message);
      logger.error('Local fallback DXF task failed', { taskId, error: message });
    });
  }, 0);

  logger.warn('DXF task queued with local async fallback', { taskId, cacheKey: payload.cacheKey });

  return {
    taskId,
    taskName: `local-task-${taskId}`,
    alreadyCompleted: false
  };
}

export async function getTaskStatus(taskId: string): Promise<{ taskId: string; status: string; message?: string }> {
  if (!postgresAvailable || !sqlClient) {
    return {
      taskId,
      status: 'unknown',
      message: 'Queue persistence unavailable'
    };
  }

  const rows = await sqlClient.unsafe(
    `select status, error from dxf_tasks where task_id = $1 limit 1`,
    [taskId]
  ) as Array<{ status: string; error: string | null }>;

  if (rows.length === 0) {
    return {
      taskId,
      status: 'not_found',
      message: 'Task not found'
    };
  }

  return {
    taskId,
    status: rows[0].status,
    ...(rows[0].error ? { message: rows[0].error } : {})
  };
}
