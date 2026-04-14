import crypto from 'crypto';
import { config } from '../config.js';
import { metricsService } from './metricsService.js';

type CacheEntry = {
    filename: string;
    expiresAt: number;
};

type DxfCachePayload = {
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    contourRenderMode?: 'spline' | 'polyline';
    polygon: unknown;
    layers: unknown;
    btContext?: unknown;
};

// Re-exported for backward-compat with tests that import DEFAULT_TTL_MS directly.
export const DEFAULT_TTL_MS = config.CACHE_TTL_MS;
const cacheStore = new Map<string, CacheEntry>();
let cacheCleanupIntervalId: NodeJS.Timeout | null = null;

const CACHE_CLEANUP_INTERVAL_MS = 60_000;

const reportCacheSize = (): void => {
    metricsService.recordCacheSize(cacheStore.size);
};

const purgeExpiredEntries = (): number => {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of cacheStore.entries()) {
        if (entry.expiresAt <= now) {
            cacheStore.delete(key);
            removed += 1;
            metricsService.recordCacheOperation('delete');
        }
    }

    if (removed > 0) {
        reportCacheSize();
    }

    return removed;
};

const ensureCacheCleanupInterval = (): void => {
    if (cacheCleanupIntervalId || process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
        return;
    }

    cacheCleanupIntervalId = setInterval(() => {
        purgeExpiredEntries();
    }, CACHE_CLEANUP_INTERVAL_MS);

    if (typeof cacheCleanupIntervalId.unref === 'function') {
        cacheCleanupIntervalId.unref();
    }
};

const stableSerialize = (value: unknown): string => {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
    );
    const serializedEntries = entries.map(
        ([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`
    );

    return `{${serializedEntries.join(',')}}`;
};

const createCacheKey = (payload: DxfCachePayload): string => {
    const normalizedPayload: DxfCachePayload = {
        lat: payload.lat,
        lon: payload.lon,
        radius: payload.radius,
        mode: payload.mode,
        contourRenderMode: payload.contourRenderMode || 'spline',
        polygon: payload.polygon ?? null,
        layers: payload.layers ?? {},
        btContext: payload.btContext ?? null
    };

    const serializedPayload = stableSerialize(normalizedPayload);
    return crypto.createHash('sha256').update(serializedPayload).digest('hex');
};

const getCachedFilename = (key: string): string | null => {
    ensureCacheCleanupInterval();

    const entry = cacheStore.get(key);
    if (!entry) {
        metricsService.recordCacheOperation('miss');
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        cacheStore.delete(key);
        metricsService.recordCacheOperation('miss');
        metricsService.recordCacheOperation('delete');
        reportCacheSize();
        return null;
    }

    metricsService.recordCacheOperation('hit');
    return entry.filename;
};

const setCachedFilename = (key: string, filename: string, ttlMs: number = DEFAULT_TTL_MS): void => {
    ensureCacheCleanupInterval();

    cacheStore.set(key, {
        filename,
        expiresAt: Date.now() + ttlMs
    });
    metricsService.recordCacheOperation('set');
    reportCacheSize();
};

const deleteCachedFilename = (key: string): void => {
    ensureCacheCleanupInterval();

    cacheStore.delete(key);
    metricsService.recordCacheOperation('delete');
    reportCacheSize();
};

const stopCacheCleanup = (): void => {
    if (cacheCleanupIntervalId) {
        clearInterval(cacheCleanupIntervalId);
        cacheCleanupIntervalId = null;
    }
};

const clearCache = (): void => {
    cacheStore.clear();
    reportCacheSize();
};

export {
    createCacheKey,
    getCachedFilename,
    setCachedFilename,
    deleteCachedFilename,
    stopCacheCleanup,
    clearCache
};
