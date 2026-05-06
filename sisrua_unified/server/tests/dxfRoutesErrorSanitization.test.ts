import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

const createDxfTaskMock = vi.fn();
const createCacheKeyMock = vi.fn();
const getCachedFilenameMock = vi.fn();
const deleteCachedFilenameMock = vi.fn();
const attachCqtSnapshotToBtContextMock = vi.fn((value) => value);
const recordDxfRequestMock = vi.fn();

vi.mock('../services/cloudTasksService', () => ({
  createDxfTask: (...args: unknown[]) => createDxfTaskMock(...args),
}));

vi.mock('../services/cacheService', () => ({
  createCacheKey: (...args: unknown[]) => createCacheKeyMock(...args),
  getCachedFilename: (...args: unknown[]) => getCachedFilenameMock(...args),
  deleteCachedFilename: (...args: unknown[]) => deleteCachedFilenameMock(...args),
}));

vi.mock('../services/cqtContextService', () => ({
  attachCqtSnapshotToBtContext: (...args: unknown[]) => attachCqtSnapshotToBtContextMock(...args),
}));

vi.mock('../services/metricsService', () => ({
  metricsService: {
    recordDxfRequest: (...args: unknown[]) => recordDxfRequestMock(...args),
  },
}));

// Allow all permissions so this test exercises error-sanitization logic, not auth.
vi.mock('../middleware/permissionHandler', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('dxfRoutes error sanitization', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns generic 500 without leaking internal exception details', async () => {
    createCacheKeyMock.mockReturnValue('cache-key');
    getCachedFilenameMock.mockReturnValue(undefined);
    createDxfTaskMock.mockRejectedValueOnce(new Error('secret stack info: ECONNREFUSED 10.1.2.3'));

    const { default: dxfRoutes } = await import('../routes/dxfRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/dxf', dxfRoutes);

    const response = await request(app)
      .post('/api/dxf')
      .send({ lat: -23.55, lon: -46.63, radius: 300, mode: 'circle' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Generation failed' });
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(response.body)).not.toContain('10.1.2.3');
  });
});

