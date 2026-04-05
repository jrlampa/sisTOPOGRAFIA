import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

// Cleanup policy:
// 1) Prefer fast cleanup (default 10 min)
// 2) Hard safety limit: never keep DXF files for more than 2 hours
const DXF_FILE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_DXF_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes

interface ScheduledFile {
    filePath: string;
    deleteAt: number;
}

// Track files scheduled for deletion
const scheduledDeletions = new Map<string, ScheduledFile>();
let cleanupIntervalId: NodeJS.Timeout | null = null;
let midnightTimeoutId: NodeJS.Timeout | null = null;
let midnightIntervalId: NodeJS.Timeout | null = null;
let cleanupInitialized = false;
let configuredDxfDirectory: string | null = null;

function getDxfDirectory(): string {
    if (configuredDxfDirectory) {
        return configuredDxfDirectory;
    }
    return process.env.DXF_DIRECTORY || './public/dxf';
}

function companionFilesFor(dxfPath: string): string[] {
    const ext = path.extname(dxfPath).toLowerCase();
    if (ext !== '.dxf') {
        return [dxfPath];
    }
    const base = dxfPath.slice(0, -4);
    return [
        dxfPath,
        `${base}_metadata.csv`,
        `${base}_elevation_metadata.csv`,
        `${base}_bt_context.json`
    ];
}

function deleteFileSet(filePath: string, reason: string): void {
    for (const target of companionFilesFor(filePath)) {
        try {
            if (fs.existsSync(target)) {
                fs.unlinkSync(target);
                logger.info('DXF cleanup deleted file', { filePath: target, reason });
            }
        } catch (error: any) {
            logger.error('DXF cleanup failed to delete file', {
                filePath: target,
                reason,
                error: error.message
            });
        }
    }
}

function sweepStaleDxfFromDisk(): void {
    const now = Date.now();
    const dir = getDxfDirectory();

    try {
        if (!fs.existsSync(dir)) {
            return;
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) {
                continue;
            }

            const fullPath = path.join(dir, entry.name);
            const stat = fs.statSync(fullPath);
            const fileAgeMs = now - stat.mtimeMs;
            const lower = entry.name.toLowerCase();
            const isDxfOrSidecar = lower.endsWith('.dxf') || lower.endsWith('_metadata.csv') || lower.endsWith('_elevation_metadata.csv') || lower.endsWith('_bt_context.json');

            if (!isDxfOrSidecar) {
                continue;
            }

            if (fileAgeMs >= MAX_DXF_AGE_MS) {
                deleteFileSet(fullPath, 'max_age_2h');
                scheduledDeletions.delete(fullPath);
            }
        }
    } catch (error: any) {
        logger.error('DXF cleanup disk sweep failed', { dir, error: error.message });
    }
}

/**
 * Schedule a DXF file for deletion after 10 minutes
 */
export function scheduleDxfDeletion(filePath: string): void {
    const now = Date.now();
    const deleteAt = Math.min(now + DXF_FILE_TTL_MS, now + MAX_DXF_AGE_MS);
    
    scheduledDeletions.set(filePath, {
        filePath,
        deleteAt
    });
    
    logger.info('DXF file scheduled for deletion', {
        filePath,
        deleteAt: new Date(deleteAt).toISOString(),
        ttlMinutes: 10
    });
}

/**
 * Remove a DXF immediately after successful download.
 */
export function markDxfDownloaded(filePath: string): void {
    scheduledDeletions.delete(filePath);
    deleteFileSet(filePath, 'downloaded');
}

/**
 * Perform cleanup of expired DXF files
 */
function performCleanup(): void {
    const now = Date.now();
    const filesToDelete: string[] = [];
    
    for (const [filePath, scheduled] of scheduledDeletions.entries()) {
        if (now >= scheduled.deleteAt) {
            filesToDelete.push(filePath);
        }
    }
    
    for (const filePath of filesToDelete) {
        deleteFileSet(filePath, 'scheduled_expired');
        scheduledDeletions.delete(filePath);
    }

    // Safety sweep to enforce hard 2h maximum retention even after restarts.
    sweepStaleDxfFromDisk();
    
    if (filesToDelete.length > 0) {
        logger.info('DXF cleanup cycle completed', {
            deletedCount: filesToDelete.length,
            remainingScheduled: scheduledDeletions.size
        });
    }
}

/**
 * Start the periodic cleanup interval
 */
function startCleanupInterval(): void {
    if (cleanupIntervalId) {
        return; // Already running
    }
    
    cleanupIntervalId = setInterval(() => {
        performCleanup();
    }, CLEANUP_CHECK_INTERVAL);
    
    logger.info('DXF cleanup service started', {
        checkIntervalMs: CLEANUP_CHECK_INTERVAL,
        fileTTLMs: DXF_FILE_TTL_MS,
        maxFileAgeMs: MAX_DXF_AGE_MS
    });
}

function runMidnightCleanup(): void {
    logger.info('DXF midnight cleanup started');
    performCleanup();
}

function scheduleMidnightCleanup(): void {
    if (midnightTimeoutId || midnightIntervalId) {
        return;
    }

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(now.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    const firstDelay = Math.max(1000, nextMidnight.getTime() - now.getTime());

    midnightTimeoutId = setTimeout(() => {
        runMidnightCleanup();
        midnightIntervalId = setInterval(runMidnightCleanup, 24 * 60 * 60 * 1000);
        if (midnightIntervalId && typeof midnightIntervalId.unref === 'function') {
            midnightIntervalId.unref();
        }
        midnightTimeoutId = null;
    }, firstDelay);

    if (midnightTimeoutId && typeof midnightTimeoutId.unref === 'function') {
        midnightTimeoutId.unref();
    }
}

export function initializeDxfCleanup(dxfDirectory?: string): void {
    if (cleanupInitialized) {
        return;
    }

    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
        cleanupInitialized = true;
        return;
    }

    configuredDxfDirectory = dxfDirectory || getDxfDirectory();
    cleanupInitialized = true;
    startCleanupInterval();
    scheduleMidnightCleanup();
    performCleanup();
}

/**
 * Stop the cleanup interval (for graceful shutdown)
 */
export function stopDxfCleanup(): void {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        logger.info('DXF cleanup service stopped');
    }

    if (midnightTimeoutId) {
        clearTimeout(midnightTimeoutId);
        midnightTimeoutId = null;
    }

    if (midnightIntervalId) {
        clearInterval(midnightIntervalId);
        midnightIntervalId = null;
    }
}

/**
 * Manually trigger cleanup (useful for testing)
 */
export function triggerCleanupNow(): void {
    performCleanup();
}
