import express from 'express';
import request from 'supertest';

const createDxfTaskMock = jest.fn();
const createCacheKeyMock = jest.fn();
const getCachedFilenameMock = jest.fn();
const deleteCachedFilenameMock = jest.fn();
const attachCqtSnapshotToBtContextMock = jest.fn((value) => value);
const recordDxfRequestMock = jest.fn();

jest.mock('../services/cloudTasksService', () => ({
  createDxfTask: (...args: unknown[]) => createDxfTaskMock(...args),
}));

jest.mock('../services/cacheService', () => ({
  createCacheKey: (...args: unknown[]) => createCacheKeyMock(...args),
  getCachedFilename: (...args: unknown[]) => getCachedFilenameMock(...args),
  deleteCachedFilename: (...args: unknown[]) => deleteCachedFilenameMock(...args),
}));

jest.mock('../services/cqtContextService', () => ({
  attachCqtSnapshotToBtContext: (...args: unknown[]) => attachCqtSnapshotToBtContextMock(...args),
}));

jest.mock('../services/metricsService', () => ({
  metricsService: {
    recordDxfRequest: (...args: unknown[]) => recordDxfRequestMock(...args),
  },
}));

describe('dxfRoutes error sanitization', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
