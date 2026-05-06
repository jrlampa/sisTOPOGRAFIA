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

// Allow all RBAC checks to pass through so this test focuses on DXF directory consistency.
vi.mock('../middleware/permissionHandler', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('DXF directory consistency', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses the same resolved DXF directory for queue output when DXF_DIRECTORY is customized', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DXF_DIRECTORY: './tmp/custom-dxf-output',
    };

    createCacheKeyMock.mockReturnValue('cache-key');
    getCachedFilenameMock.mockReturnValue(undefined);
    createDxfTaskMock.mockResolvedValueOnce({ taskId: 'job-1', alreadyCompleted: false });

    const { default: dxfRoutes } = await import('../routes/dxfRoutes');
    const { resolveDxfDirectory } = await import('../utils/dxfDirectory');

    const app = express();
    app.use(express.json());
    app.use('/api/dxf', dxfRoutes);

    const response = await request(app)
      .post('/api/dxf')
      .send({ lat: -23.55, lon: -46.63, radius: 300, mode: 'circle' });

    expect(response.status).toBe(202);
    expect(createDxfTaskMock).toHaveBeenCalledTimes(1);

    const payload = createDxfTaskMock.mock.calls[0][0] as { outputFile: string; filename: string };
    const expectedDir = resolveDxfDirectory();

    expect(payload.outputFile.startsWith(expectedDir)).toBe(true);
    expect(payload.outputFile.endsWith(payload.filename)).toBe(true);
    expect((payload as any).requestMeta).toEqual(
      expect.objectContaining({
        endpoint: 'POST /api/dxf/',
        source: 'POST /api/dxf/',
      }),
    );
  });
});

