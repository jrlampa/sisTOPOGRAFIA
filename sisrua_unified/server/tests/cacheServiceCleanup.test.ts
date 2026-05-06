import { vi } from "vitest";
describe('cacheService proactive cleanup', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.useRealTimers();
  });

  it('purges expired entries periodically and updates cache size metric', async () => {
    vi.useFakeTimers();

    const recordCacheOperation = vi.fn();
    const recordCacheSize = vi.fn();

    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      JEST_WORKER_ID: undefined,
    } as NodeJS.ProcessEnv;

    vi.doMock('../config', () => ({
      config: {
        CACHE_TTL_MS: 1000,
      },
    }));

    vi.doMock('../services/metricsService', () => ({
      metricsService: {
        recordCacheOperation,
        recordCacheSize,
      },
    }));

    const {
      setCachedFilename,
      getCachedFilename,
      stopCacheCleanup,
    } = await import('../services/cacheService');

    setCachedFilename('cleanup-key', 'cleanup-file.dxf', 1000);
    expect(recordCacheSize).toHaveBeenCalledWith(1);

    // The internal proactive cleanup interval runs every 60 seconds.
    vi.advanceTimersByTime(61000);

    expect(recordCacheOperation).toHaveBeenCalledWith('delete');
    expect(recordCacheSize).toHaveBeenLastCalledWith(0);
    expect(getCachedFilename('cleanup-key')).toBeNull();

    stopCacheCleanup();
  });
});

