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
import { metricsService } from './metricsService.js';

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
let workerStopping = false;

const REQUIRED_DXF_TASKS_COLUMNS = [
  'task_id',
  'status',
  'payload',
  'attempts',
  'error',
  'created_at',
  'updated_at',
  'started_at',
  'finished_at'
] as const;

async function validateDxfTasksSchema(sql: ReturnType<typeof postgres>): Promise<void> {
  const rows = await sql<[{ column_name: string }][]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dxf_tasks'
  `;

  const existing = new Set(rows.map((row) => row.column_name));
  const missing = REQUIRED_DXF_TASKS_COLUMNS.filter((column) => !existing.has(column));

  if (missing.length > 0) {
    throw new Error(
      `Missing required columns in public.dxf_tasks: ${missing.join(', ')}. ` +
      'Apply database migrations before enabling Supabase/Postgres queue persistence.'
    );
  }
}

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
      ssl: 'require',
      max: 2,
      connect_timeout: 8,
      idle_timeout: 10
    });

    await validateDxfTasksSchema(sqlClient);

    postgresAvailable = true;
    logger.info('DXF queue persistence enabled (Supabase/Postgres, schema validated)');
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

  await sqlClient`
      update dxf_tasks
      set status = ${status},
          error = ${error ?? null},
          updated_at = now(),
          finished_at = case when ${status} in ('completed','failed') then now() else finished_at end
      where task_id = ${taskId}
    `;
}

async function updateQueueMetrics(): Promise<void> {
  if (!postgresAvailable || !sqlClient) {
    metricsService.recordDxfQueueState({ pendingTasks: 0, processingTasks: 0, workerBusy });
    return;
  }

  const rows = await sqlClient<[{ pending_tasks: number; processing_tasks: number }]>`
    select
      count(*) filter (where status = 'queued')::int as pending_tasks,
      count(*) filter (where status = 'processing')::int as processing_tasks
    from dxf_tasks
  `;

  const snapshot = rows[0] ?? { pending_tasks: 0, processing_tasks: 0 };
  metricsService.recordDxfQueueState({
    pendingTasks: snapshot.pending_tasks,
    processingTasks: snapshot.processing_tasks,
    workerBusy,
  });
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

  const rows = await sqlClient<QueueRow[]>`
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
    `;

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

async function processNextTask(): Promise<void> {
  if (!postgresAvailable || !sqlClient || workerBusy || workerStopping) {
    return;
  }

  workerBusy = true;
  await updateQueueMetrics();
  try {
    const task = await pickNextTask();
    if (!task) {
      return;
    }

    try {
      await processPayload(task.payload);
      await markTaskState(task.task_id, 'completed');
      metricsService.recordDxfRequest('generated');
      logger.info('DXF task processed', { taskId: task.task_id, cacheKey: task.payload.cacheKey });
      await updateQueueMetrics();
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(task.task_id, message);
      metricsService.recordDxfRequest('failed');

      const nextState: QueueRow['status'] = task.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
      if (nextState === 'queued') {
        await sqlClient`
            update dxf_tasks
            set status = 'queued', error = ${message}, updated_at = now()
            where task_id = ${task.task_id}
          `;
      } else {
        await markTaskState(task.task_id, 'failed', message);
      }

      logger.error('DXF task processing failed', {
        taskId: task.task_id,
        attempts: task.attempts,
        error: message,
        nextState
      });
      await updateQueueMetrics();
    }
  } finally {
    workerBusy = false;
    await updateQueueMetrics();
  }
}

function startWorkerIfNeeded(): void {
  if (workerStarted || process.env.NODE_ENV === 'test') {
    return;
  }

  workerStarted = true;
  workerStopping = false;
  workerInterval = setInterval(() => {
    processNextTask().catch((error) => {
      logger.error('DXF queue worker cycle failed', { error });
    });
  }, WORKER_INTERVAL_MS);

  void updateQueueMetrics();

  logger.info('DXF queue worker started', { intervalMs: WORKER_INTERVAL_MS });
}

export async function stopTaskWorker(): Promise<void> {
  workerStopping = true;
  await updateQueueMetrics();

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  workerStarted = false;

  const shutdownStart = Date.now();
  const maxDrainMs = 8_000;
  while (workerBusy && Date.now() - shutdownStart < maxDrainMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (workerBusy) {
    logger.warn('Stopping task worker before current task drain completed', { maxDrainMs });
  }

  if (sqlClient) {
    await sqlClient.end({ timeout: 3 }).catch(() => undefined);
    sqlClient = null;
  }

  postgresAvailable = false;
  queueInitialized = false;
  metricsService.recordDxfQueueState({ pendingTasks: 0, processingTasks: 0, workerBusy: false });
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
    await sqlClient`
        insert into dxf_tasks (task_id, status, payload, attempts, updated_at)
        values (${taskId}, 'queued', ${sqlClient.json(fullPayload)}::jsonb, 0, now())
      `;

    await updateQueueMetrics();

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
      metricsService.recordDxfRequest('failed');
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

  const rows = await sqlClient<Array<{ status: string; error: string | null }>>`
    select status, error from dxf_tasks where task_id = ${taskId} limit 1
  `;

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
