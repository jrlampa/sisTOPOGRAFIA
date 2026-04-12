import { logger } from '../utils/logger.js';
import postgres from 'postgres';
import { config } from '../config.js';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobInfo {
    id: string;
    status: JobStatus;
    progress: number;
    result?: {
        url: string;
        filename: string;
        btContextUrl?: string;
    };
    error?: string;
    createdAt: Date;
    updatedAt: Date;
    attempts?: number; // For idempotency tracking
}

// In-memory storage for job statuses (fallback when Postgres is unavailable)
const jobs = new Map<string, JobInfo>();

// Supabase/Postgres integration
const USE_SUPABASE_JOBS = config.useSupabaseJobs;
const DATABASE_URL = config.DATABASE_URL;
const JOBS_TABLE = 'jobs';

type SqlClient = ReturnType<typeof postgres>;

// Track if Postgres persistence is available
let postgresAvailable = false;
let sqlClient: SqlClient | null = null;

// Auto-cleanup old jobs after 1 hour
const CLEANUP_INTERVAL = config.JOB_CLEANUP_INTERVAL_MS;
const MAX_JOB_AGE = config.JOB_MAX_AGE_MS;

let cleanupIntervalId: NodeJS.Timeout | null = null;
let initializationStarted = false;

async function initializePersistence(): Promise<void> {
    if (!USE_SUPABASE_JOBS || !DATABASE_URL || postgresAvailable) {
        return;
    }

    try {
        sqlClient = postgres(DATABASE_URL, {
            ssl: config.NODE_ENV === 'production' ? 'require' : undefined,
            max: 2,
            connect_timeout: 8,
            idle_timeout: 10
        });

        // Removed implicit DDL (create table if not exists). This is now handled by migration files.

        postgresAvailable = true;
        logger.info('JobStatusService: Supabase/Postgres persistence enabled');

        // Load existing jobs from Postgres on startup
        await loadJobsFromPostgres();
    } catch (error) {
        logger.warn('JobStatusService: Supabase/Postgres unavailable, using in-memory fallback', { error });
        postgresAvailable = false;
        if (sqlClient) {
            await sqlClient.end({ timeout: 3 }).catch(() => undefined);
            sqlClient = null;
        }
    }
}

async function loadJobsFromPostgres(): Promise<void> {
    if (!postgresAvailable || !sqlClient) {
        return;
    }

    try {
        const rows = await sqlClient.unsafe(`
            select id, status, progress, result, error, created_at, updated_at, attempts
            from ${JOBS_TABLE}
            where updated_at > (now() - ($1::bigint * interval '1 millisecond'))
        `, [MAX_JOB_AGE]);

        rows.forEach((row: any) => {
            jobs.set(String(row.id), {
                id: String(row.id),
                status: row.status as JobStatus,
                progress: Number(row.progress || 0),
                result: row.result ?? undefined,
                error: row.error ?? undefined,
                createdAt: row.created_at ? new Date(row.created_at) : new Date(),
                updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
                attempts: Number(row.attempts || 0)
            });
        });

        logger.info('Loaded jobs from Supabase/Postgres', { count: rows.length });
    } catch (error) {
        logger.error('Failed to load jobs from Supabase/Postgres', { error });
    }
}

async function persistJob(job: JobInfo): Promise<void> {
    if (!postgresAvailable || !sqlClient) {
        return;
    }

    try {
        await sqlClient.unsafe(`
            insert into ${JOBS_TABLE} (id, status, progress, result, error, created_at, updated_at, attempts)
            values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
            on conflict (id)
            do update set
                status = excluded.status,
                progress = excluded.progress,
                result = excluded.result,
                error = excluded.error,
                updated_at = excluded.updated_at,
                attempts = excluded.attempts
        `, [
            job.id,
            job.status,
            job.progress,
            job.result ? JSON.stringify(job.result) : null,
            job.error || null,
            job.createdAt,
            job.updatedAt,
            job.attempts || 0
        ]);
    } catch (error) {
        logger.error('Failed to persist job to Supabase/Postgres', { jobId: job.id, error });
    }
}

function startCleanupInterval() {
    if (cleanupIntervalId) {
        return; // Already running
    }
    
    cleanupIntervalId = setInterval(() => {
        const now = Date.now();
        for (const [id, job] of jobs.entries()) {
            if (now - job.createdAt.getTime() > MAX_JOB_AGE) {
                jobs.delete(id);
                logger.info('Cleaned up old job', { jobId: id });
            }
        }
    }, CLEANUP_INTERVAL);
}

export function stopCleanupInterval() {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        logger.info('Job cleanup interval stopped');
    }
    
    if (sqlClient) {
        sqlClient.end({ timeout: 3 }).catch(() => undefined);
        sqlClient = null;
        postgresAvailable = false;
    }
}

function ensureInitialized(): void {
    if (initializationStarted) {
        return;
    }

    if (process.env.NODE_ENV === 'test') {
        initializationStarted = true;
        return;
    }

    initializationStarted = true;
    initializePersistence().then(() => {
        startCleanupInterval();
    }).catch(err => {
        logger.error('Failed to initialize Supabase/Postgres for job status', { error: err });
        startCleanupInterval();
    });
}

export function createJob(id: string): JobInfo {
    ensureInitialized();

    const job: JobInfo = {
        id,
        status: 'queued',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0
    };
    jobs.set(id, job);
    
    // Persist to Firestore if available
    persistJob(job).catch(err => logger.error('Failed to persist new job', { jobId: id, error: err }));
    
    logger.info('Job created', { jobId: id });
    return job;
}

export function getJob(id: string): JobInfo | null {
    ensureInitialized();
    return jobs.get(id) || null;
}

export async function updateJobStatus(id: string, status: JobStatus, progress?: number): Promise<void> {
    ensureInitialized();

    const job = jobs.get(id);
    if (job) {
        job.status = status;
        if (progress !== undefined) {
            job.progress = progress;
        }
        job.updatedAt = new Date();
        jobs.set(id, job);
        
        // Persist to Firestore
        await persistJob(job);
        
        logger.info('Job status updated', { jobId: id, status, progress });
    }
}

export async function completeJob(id: string, result: { url: string; filename: string; btContextUrl?: string }): Promise<void> {
    ensureInitialized();

    const job = jobs.get(id);
    if (job) {
        job.status = 'completed';
        job.progress = 100;
        job.result = result;
        job.updatedAt = new Date();
        jobs.set(id, job);
        
        // Persist to Firestore
        await persistJob(job);
        
        logger.info('Job completed', { jobId: id, filename: result.filename });
    }
}

export async function failJob(id: string, error: string): Promise<void> {
    ensureInitialized();

    const job = jobs.get(id);
    if (job) {
        job.status = 'failed';
        job.error = error;
        job.updatedAt = new Date();
        job.attempts = (job.attempts || 0) + 1;
        jobs.set(id, job);
        
        // Persist to Firestore
        await persistJob(job);
        
        logger.error('Job failed', { jobId: id, error, attempts: job.attempts });
    }
}

// Idempotency check - returns true if job should be processed
export function shouldProcessJob(id: string): boolean {
    ensureInitialized();

    const job = jobs.get(id);
    if (!job) {
        return true; // New job
    }
    
    // Don't reprocess completed or already processing jobs
    if (job.status === 'completed' || job.status === 'processing') {
        logger.info('Job already processed or in progress, skipping', { jobId: id, status: job.status });
        return false;
    }
    
    // Retry failed jobs up to 3 times
    if (job.status === 'failed' && (job.attempts || 0) >= 3) {
        logger.warn('Job exceeded max attempts', { jobId: id, attempts: job.attempts });
        return false;
    }
    
    return true;
}
