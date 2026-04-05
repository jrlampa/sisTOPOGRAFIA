import { logger } from '../utils/logger.js';
import { FirestoreService } from './firestoreService.js';
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

// In-memory storage for job statuses (fallback when Firestore is unavailable)
const jobs = new Map<string, JobInfo>();

// Firestore integration
const USE_FIRESTORE = config.useFirestore;
const firestoreService = new FirestoreService();
const JOBS_COLLECTION = 'jobs';

// Track if Firestore is available
let firestoreAvailable = false;

// Auto-cleanup old jobs after 1 hour
const CLEANUP_INTERVAL = config.JOB_CLEANUP_INTERVAL_MS;
const MAX_JOB_AGE = config.JOB_MAX_AGE_MS;

let cleanupIntervalId: NodeJS.Timeout | null = null;
let initializationStarted = false;

async function initializeFirestore(): Promise<void> {
    if (!USE_FIRESTORE || firestoreAvailable) {
        return;
    }
    
    try {
        await firestoreService.start();
        firestoreAvailable = true;
        logger.info('JobStatusService: Firestore persistence enabled');
        
        // Load existing jobs from Firestore on startup
        await loadJobsFromFirestore();
    } catch (error) {
        logger.warn('JobStatusService: Firestore unavailable, using in-memory fallback', { error });
        firestoreAvailable = false;
    }
}

async function loadJobsFromFirestore(): Promise<void> {
    try {
        const { Firestore } = await import('@google-cloud/firestore');
        const db = new Firestore({ projectId: config.GCP_PROJECT });
        
        const snapshot = await db.collection(JOBS_COLLECTION)
            .where('updatedAt', '>', new Date(Date.now() - MAX_JOB_AGE))
            .get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            jobs.set(doc.id, {
                id: doc.id,
                status: data.status,
                progress: data.progress,
                result: data.result,
                error: data.error,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                attempts: data.attempts || 0
            });
        });
        
        logger.info('Loaded jobs from Firestore', { count: snapshot.size });
    } catch (error) {
        logger.error('Failed to load jobs from Firestore', { error });
    }
}

async function persistJob(job: JobInfo): Promise<void> {
    if (!firestoreAvailable) {
        return;
    }
    
    try {
        const { Firestore, FieldValue } = await import('@google-cloud/firestore');
        const db = new Firestore({ projectId: config.GCP_PROJECT });
        
        await db.collection(JOBS_COLLECTION).doc(job.id).set({
            status: job.status,
            progress: job.progress,
            result: job.result || null,
            error: job.error || null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            attempts: job.attempts || 0
        }, { merge: true });
    } catch (error) {
        logger.error('Failed to persist job to Firestore', { jobId: job.id, error });
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
    
    if (firestoreAvailable) {
        firestoreService.stop();
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
    initializeFirestore().then(() => {
        startCleanupInterval();
    }).catch(err => {
        logger.error('Failed to initialize Firestore for job status', { error: err });
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
