describe('cacheService proactive cleanup', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.useRealTimers();
  });

  it('purges expired entries periodically and updates cache size metric', async () => {
    jest.useFakeTimers();

    const recordCacheOperation = jest.fn();
    const recordCacheSize = jest.fn();

    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      JEST_WORKER_ID: undefined,
    } as NodeJS.ProcessEnv;

    jest.doMock('../config', () => ({
      config: {
        CACHE_TTL_MS: 1000,
      },
    }));

    jest.doMock('../services/metricsService', () => ({
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
    jest.advanceTimersByTime(61000);

    expect(recordCacheOperation).toHaveBeenCalledWith('delete');
    expect(recordCacheSize).toHaveBeenLastCalledWith(0);
    expect(getCachedFilename('cleanup-key')).toBeNull();

    stopCacheCleanup();
  });
});
