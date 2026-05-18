/**
 * server/utils/cacheService.ts
 *
 * Simple cache service with support for in-memory and Redis.
 * Fulfills Audit P2 requirement for production-ready caching.
 */
import { redisService } from '../services/redisService.js';
import { logger } from './logger.js';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class CacheService {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private useRedis = true; // Enabled by default now that redisService is available

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;

    if (this.useRedis) {
      try {
        await redisService.set(`util_cache:${key}`, JSON.stringify(value), ttlSeconds);
      } catch (err) {
        logger.warn('Redis cache set failed, falling back to memory', { key, err });
        this.memoryCache.set(key, { value, expiresAt });
      }
    } else {
      this.memoryCache.set(key, { value, expiresAt });
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis) {
      try {
        const val = await redisService.get(`util_cache:${key}`);
        if (val) return JSON.parse(val);
      } catch (err) {
        logger.warn('Redis cache get failed, falling back to memory', { key, err });
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    if (this.useRedis) {
      await redisService.del(`util_cache:${key}`);
    }
    this.memoryCache.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (this.useRedis) {
      // Note: this clears ALL redis data, use with caution or implement pattern match
      // For utility cache, we might want to only clear its own prefix
      logger.info(
        'CacheService.clear() called - only memory cache cleared to prevent side effects'
      );
    }
    this.memoryCache.clear();
  }
}

export const cacheService = new CacheService();
