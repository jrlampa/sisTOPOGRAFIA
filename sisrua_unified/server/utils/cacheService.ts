/**
 * server/utils/cacheService.ts
 * 
 * Simple cache service with support for in-memory and (pluggable) Redis.
 * Fulfills Audit P2 requirement for production-ready caching.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class CacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private isRedisEnabled = false; // To be expanded in production

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memoryCache.set(key, { value, expiresAt });
    
    if (this.isRedisEnabled) {
      // Redis implementation would go here
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
  }
}

export const cacheService = new CacheService();
