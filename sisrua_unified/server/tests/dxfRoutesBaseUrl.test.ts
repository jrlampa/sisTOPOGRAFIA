jest.mock('../services/cloudTasksService', () => ({
  createDxfTask: jest.fn()
}));

jest.mock('../services/cacheService', () => ({
  createCacheKey: jest.fn(),
  deleteCachedFilename: jest.fn(),
  getCachedFilename: jest.fn()
}));

jest.mock('../services/cqtContextService', () => ({
  attachCqtSnapshotToBtContext: jest.fn((value) => value)
}));

jest.mock('../services/metricsService', () => ({
  metricsService: {
    recordDxfRequest: jest.fn()
  }
}));

describe('dxfRoutes getBaseUrl', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('uses APP_PUBLIC_URL when configured', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'https://api.example.com/'
    };

    const { getBaseUrl } = await import('../routes/dxfRoutes');
    const req = {
      hostname: 'malicious.example',
      protocol: 'http',
      headers: {
        host: 'malicious.example:8080',
        'x-forwarded-proto': 'http'
      }
    } as any;

    expect(getBaseUrl(req)).toBe('https://api.example.com');
  });

  it('falls back to configured CORS origin when host is not trusted', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.company.com,https://admin.company.com'
    };

    const { getBaseUrl } = await import('../routes/dxfRoutes');
    const req = {
      hostname: 'evil.tld',
      protocol: 'http',
      headers: {
        host: 'evil.tld:9999',
        'x-forwarded-proto': 'javascript'
      }
    } as any;

    expect(getBaseUrl(req)).toBe('https://app.company.com');
  });

  it('builds URL from trusted localhost host/protocol in development', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development'
    };

    const { getBaseUrl } = await import('../routes/dxfRoutes');
    const req = {
      hostname: 'localhost',
      protocol: 'http',
      headers: {
        host: 'localhost:3001',
        'x-forwarded-proto': 'https'
      }
    } as any;

    expect(getBaseUrl(req)).toBe('https://localhost:3001');
  });

  it('falls back to localhost:3002 for Docker development when host is not trusted', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      DOCKER_ENV: 'true'
    };

    const { getBaseUrl } = await import('../routes/dxfRoutes');
    const req = {
      hostname: 'app',
      protocol: 'http',
      headers: {
        host: 'app:3001'
      }
    } as any;

    expect(getBaseUrl(req)).toBe('http://localhost:3002');
  });
});
