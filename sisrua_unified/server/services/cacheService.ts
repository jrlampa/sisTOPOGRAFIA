import crypto from 'crypto';
import { config } from '../config.js';
import { metricsService } from './metricsService.js';
import { redisService, getRedisClient } from './redisService.js';
import { logger } from '../utils/logger.js';

type CacheEntry = {
    filename: string;
    expiresAt: number;
    tags?: string[];
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
    const hash = crypto.createHash('sha256').update(serializedPayload).digest('hex');
    return `dxf_cache:${hash}`;
};

const getCachedFilename = async (key: string): Promise<string | null> => {
    try {
        const rawEntry = await redisService.get(key);
        if (!rawEntry) {
            metricsService.recordCacheOperation('miss');
            return null;
        }

        const entry: CacheEntry = JSON.parse(rawEntry);
        
        if (entry.expiresAt <= Date.now()) {
            await redisService.del(key);
            metricsService.recordCacheOperation('miss');
            metricsService.recordCacheOperation('delete');
            return null;
        }

        metricsService.recordCacheOperation('hit');
        return entry.filename;
    } catch (err) {
        logger.warn('Failed to get from cache', { key, err });
        return null;
    }
};

const setCachedFilename = async (key: string, filename: string, ttlMs: number = DEFAULT_TTL_MS): Promise<void> => {
    try {
        const entry: CacheEntry = {
            filename,
            expiresAt: Date.now() + ttlMs
        };
        
        await redisService.set(key, JSON.stringify(entry), Math.ceil(ttlMs / 1000));
        metricsService.recordCacheOperation('set');
        
        // Roadmap #112: Local metric update (best effort for current instance context)
        const currentKeys = await redisService.getKeys('dxf_cache:*');
        metricsService.recordCacheSize(currentKeys.length);
    } catch (err) {
        logger.warn('Failed to set cache', { key, err });
    }
};

const deleteCachedFilename = async (key: string): Promise<void> => {
    try {
        await redisService.del(key);
        metricsService.recordCacheOperation('delete');
    } catch (err) {
        logger.warn('Failed to delete from cache', { key, err });
    }
};

const stopCacheCleanup = (): void => {
    // No-op for Redis, as it handles its own expiration
};

const clearCache = async (): Promise<void> => {
    try {
        await redisService.clear();
    } catch (err) {
        logger.warn('Failed to clear cache', { err });
    }
};

const invalidateCacheByPattern = async (pattern: string | RegExp): Promise<number> => {
    const client = getRedisClient();
    if (!client) return 0;

    let cursor = '0';
    let totalRemoved = 0;
    const regex = typeof pattern === 'string' 
        ? new RegExp(pattern.replace(/\*/g, '.*')) 
        : pattern;

    try {
        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'dxf_cache:*', 'COUNT', 100);
            cursor = nextCursor;

            const toDelete = keys.filter((key: string) => regex.test(key));
            if (toDelete.length > 0) {
                await client.del(...toDelete);
                totalRemoved += toDelete.length;
            }
        } while (cursor !== '0');

        if (totalRemoved > 0) {
            metricsService.recordCacheOperation('delete');
            logger.info('Cache invalidado por padrão', { pattern: String(pattern), removed: totalRemoved });
        }
        return totalRemoved;
    } catch (err) {
        logger.error('Falha ao invalidar cache por padrão', { pattern: String(pattern), err });
        return 0;
    }
};

const invalidateCacheByTag = async (tag: string): Promise<number> => {
    const client = getRedisClient();
    if (!client) return 0;

    const tagKey = `cache_tag:${tag}`;
    try {
        const keys = await client.smembers(tagKey);
        if (keys.length === 0) return 0;

        await client.del(...keys);
        await client.del(tagKey);
        
        metricsService.recordCacheOperation('delete');
        logger.info('Cache invalidado por tag', { tag, removed: keys.length });
        return keys.length;
    } catch (err) {
        logger.error('Falha ao invalidar cache por tag', { tag, err });
        return 0;
    }
};

const tagCacheEntry = async (key: string, tags: string[]): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;

    try {
        const rawEntry = await redisService.get(key);
        if (!rawEntry) return;
        
        const entry: CacheEntry = JSON.parse(rawEntry);
        const existing = entry.tags ?? [];
        entry.tags = Array.from(new Set([...existing, ...tags]));
        
        const remainingTtl = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        if (remainingTtl > 0) {
            await redisService.set(key, JSON.stringify(entry), remainingTtl);
            
            // Registrar chaves em sets de tags para invalidação rápida
            for (const tag of tags) {
                await client.sadd(`cache_tag:${tag}`, key);
                await client.expire(`cache_tag:${tag}`, remainingTtl);
            }
        }
    } catch (err) {
        logger.warn('Failed to tag cache entry', { key, err });
    }
};

const onRoleChange = async (userId: string): Promise<void> => {
    await invalidateCacheByTag(`user:${userId}`);
};

export {
    createCacheKey,
    getCachedFilename,
    setCachedFilename,
    deleteCachedFilename,
    stopCacheCleanup,
    clearCache,
    invalidateCacheByPattern,
    invalidateCacheByTag,
    tagCacheEntry,
    onRoleChange
};
