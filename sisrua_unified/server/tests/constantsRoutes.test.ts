import express from 'express';
import request from 'supertest';

const mockConfig = {
  useDbConstantsClandestino: true,
  useDbConstantsCqt: false,
  useDbConstantsConfig: true,
  CONSTANTS_REFRESH_TOKEN: 'test-refresh-token',
  NODE_ENV: 'test'
};

const getSyncMock = jest.fn();
const statsMock = jest.fn();
const warmUpMock = jest.fn();
const recordRefreshEventMock = jest.fn();
const getLastRefreshEventMock = jest.fn();
const getRefreshEventsMock = jest.fn();
const getRefreshStatsMock = jest.fn();
const saveSnapshotMock = jest.fn();
const listSnapshotsMock = jest.fn();
const restoreSnapshotMock = jest.fn();
const getDxfCleanupPolicySnapshotMock = jest.fn();
const getRateLimitPolicySnapshotMock = jest.fn();
const refreshRateLimitersFromCatalogMock = jest.fn();

jest.mock('../config', () => ({
  config: mockConfig
}));

jest.mock('../services/constantsService', () => ({
  constantsService: {
    getSync: getSyncMock,
    stats: statsMock,
    warmUp: warmUpMock,
    recordRefreshEvent: recordRefreshEventMock,
    getLastRefreshEvent: getLastRefreshEventMock,
    getRefreshEvents: getRefreshEventsMock,
    getRefreshStats: getRefreshStatsMock,
    saveSnapshot: saveSnapshotMock,
    listSnapshots: listSnapshotsMock,
    restoreSnapshot: restoreSnapshotMock
  }
}));

jest.mock('../services/dxfCleanupService', () => ({
  getDxfCleanupPolicySnapshot: getDxfCleanupPolicySnapshotMock
}));

jest.mock('../middleware/rateLimiter', () => ({
  getRateLimitPolicySnapshot: getRateLimitPolicySnapshotMock,
  refreshRateLimitersFromCatalog: refreshRateLimitersFromCatalogMock
}));

describe('constantsRoutes', () => {
  const ADMIN_TOKEN = 'test-refresh-token';

  beforeEach(() => {
    mockConfig.useDbConstantsClandestino = true;
    mockConfig.useDbConstantsCqt = false;
    mockConfig.useDbConstantsConfig = true;
    mockConfig.CONSTANTS_REFRESH_TOKEN = ADMIN_TOKEN;
    mockConfig.NODE_ENV = 'test';
    getSyncMock.mockReset();
    statsMock.mockReset();
    warmUpMock.mockReset();
    recordRefreshEventMock.mockReset();
    getLastRefreshEventMock.mockReset();
    getRefreshEventsMock.mockReset();
    getRefreshStatsMock.mockReset();
    saveSnapshotMock.mockReset();
    listSnapshotsMock.mockReset();
    restoreSnapshotMock.mockReset();
      saveSnapshotMock.mockResolvedValue([]);
    getDxfCleanupPolicySnapshotMock.mockReset();
    getRateLimitPolicySnapshotMock.mockReset();
    refreshRateLimitersFromCatalogMock.mockReset();
  });

  it('returns constants rollout status and active DXF cleanup policy snapshot', async () => {
    statsMock.mockReturnValue({ cqt: 3, clandestino: 2, config: 3 });
    getRateLimitPolicySnapshotMock.mockReturnValue({
      general: { windowMs: 900000, limit: 100 },
      dxf: { windowMs: 3600000, limit: 10 }
    });
    getDxfCleanupPolicySnapshotMock.mockReturnValue({
      fileTtlMs: 600000,
      maxFileAgeMs: 7200000,
      cleanupCheckIntervalMs: 120000
    });
    getLastRefreshEventMock.mockResolvedValue({
      namespaces: ['config'],
      success: true,
      httpStatus: 200,
      actor: '127.0.0.1',
      durationMs: 45,
      createdAt: '2026-04-07T00:00:00.000Z'
    });

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).get('/api/constants/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      flags: {
        cqt: false,
        clandestino: true,
        config: true
      },
      cache: { cqt: 3, clandestino: 2, config: 3 },
      rateLimitPolicy: {
        general: { windowMs: 900000, limit: 100 },
        dxf: { windowMs: 3600000, limit: 10 }
      },
      dxfCleanupPolicy: {
        fileTtlMs: 600000,
        maxFileAgeMs: 7200000,
        cleanupCheckIntervalMs: 120000
      },
      lastRefreshEvent: {
        namespaces: ['config'],
        success: true,
        httpStatus: 200,
        actor: '127.0.0.1',
        durationMs: 45,
        createdAt: '2026-04-07T00:00:00.000Z'
      }
    });
  });

  it('returns refresh events list for authorized operational access', async () => {
    getRefreshEventsMock.mockResolvedValue([
      {
        namespaces: ['config'],
        success: true,
        httpStatus: 200,
        actor: 'ops',
        durationMs: 90,
        createdAt: '2026-04-07T01:00:00.000Z'
      }
    ]);

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app)
      .get('/api/constants/refresh-events?limit=5')
      .set('x-constants-refresh-token', ADMIN_TOKEN);

    expect(response.status).toBe(200);
    expect(getRefreshEventsMock).toHaveBeenCalledWith(5);
    expect(response.body).toEqual({
      events: [
        {
          namespaces: ['config'],
          success: true,
          httpStatus: 200,
          actor: 'ops',
          durationMs: 90,
          createdAt: '2026-04-07T01:00:00.000Z'
        }
      ],
      limit: 5
    });
  });

  it('returns 404 when DB-backed clandestino constants are disabled', async () => {
    mockConfig.useDbConstantsClandestino = false;
    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).get('/api/constants/clandestino');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/disabled/i);
  });

  it('returns 503 when the constants cache is not ready', async () => {
    getSyncMock.mockReturnValue(undefined);
    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).get('/api/constants/clandestino');

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/not ready/i);
  });

  it('returns clandestino lookup payload when the cache is warm', async () => {
    getSyncMock
      .mockReturnValueOnce({ '20': 1.62, '50': 1.88 })
      .mockReturnValueOnce({ '1': 3.88, '10': 9.64 });

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).get('/api/constants/clandestino');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      areaToKva: { '20': 1.62, '50': 1.88 },
      clientToDiversifFactor: { '1': 3.88, '10': 9.64 }
    });
  });

  it('refreshes enabled namespaces and updates policy snapshot', async () => {
    warmUpMock.mockResolvedValue(undefined);
    saveSnapshotMock.mockResolvedValue([{ id: 99 }, { id: 100 }]);
    statsMock.mockReturnValue({ cqt: 3, clandestino: 2, config: 5 });
    getRateLimitPolicySnapshotMock.mockReturnValue({
      general: { windowMs: 120000, limit: 120 },
      dxf: { windowMs: 1800000, limit: 20 }
    });
    getDxfCleanupPolicySnapshotMock.mockReturnValue({
      fileTtlMs: 300000,
      maxFileAgeMs: 3600000,
      cleanupCheckIntervalMs: 45000
    });

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app)
      .post('/api/constants/refresh')
      .set('x-constants-refresh-token', ADMIN_TOKEN);

    expect(response.status).toBe(200);
    expect(warmUpMock).toHaveBeenCalledWith(['clandestino', 'config']);
    expect(refreshRateLimitersFromCatalogMock).toHaveBeenCalledTimes(1);
    expect(saveSnapshotMock).toHaveBeenCalledWith(['clandestino', 'config'], expect.any(String));
    expect(recordRefreshEventMock).toHaveBeenCalledWith(expect.objectContaining({
      namespaces: ['clandestino', 'config'],
      success: true,
      httpStatus: 200
    }));
    expect(response.body).toEqual({
      ok: true,
      refreshedNamespaces: ['clandestino', 'config'],
      snapshotIds: [99, 100],
      cache: { cqt: 3, clandestino: 2, config: 5 },
      rateLimitPolicy: {
        general: { windowMs: 120000, limit: 120 },
        dxf: { windowMs: 1800000, limit: 20 }
      },
      dxfCleanupPolicy: {
        fileTtlMs: 300000,
        maxFileAgeMs: 3600000,
        cleanupCheckIntervalMs: 45000
      }
    });
  });

  it('rejects refresh without token when token protection is configured', async () => {
    mockConfig.CONSTANTS_REFRESH_TOKEN = 'secret-token';

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).post('/api/constants/refresh');

    expect(response.status).toBe(401);
    expect(warmUpMock).not.toHaveBeenCalled();
    expect(recordRefreshEventMock).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      httpStatus: 401,
      errorMessage: 'unauthorized'
    }));
  });

  it('rejects refresh-events without token when token protection is configured', async () => {
    mockConfig.CONSTANTS_REFRESH_TOKEN = 'secret-token';

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).get('/api/constants/refresh-events');

    expect(response.status).toBe(401);
    expect(getRefreshEventsMock).not.toHaveBeenCalled();
  });

  it('allows refresh with valid token when token protection is configured', async () => {
    mockConfig.CONSTANTS_REFRESH_TOKEN = 'secret-token';
    warmUpMock.mockResolvedValue(undefined);
    statsMock.mockReturnValue({ config: 2 });
    getRateLimitPolicySnapshotMock.mockReturnValue({
      general: { windowMs: 900000, limit: 100 },
      dxf: { windowMs: 3600000, limit: 10 }
    });
    getDxfCleanupPolicySnapshotMock.mockReturnValue({
      fileTtlMs: 600000,
      maxFileAgeMs: 7200000,
      cleanupCheckIntervalMs: 120000
    });

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app)
      .post('/api/constants/refresh')
      .set('x-constants-refresh-token', 'secret-token');

    expect(response.status).toBe(200);
    expect(warmUpMock).toHaveBeenCalledWith(['clandestino', 'config']);
  });

  it('returns aggregated refresh statistics for authorized request', async () => {
    getRefreshStatsMock.mockResolvedValue({
      totalRefreshes: 12,
      successCount: 10,
      failureCount: 2,
      successRate: 83,
      avgDurationMs: 72,
      maxDurationMs: 210,
      minSuccessDurationMs: 30,
      lastSuccessAt: '2026-04-07T12:00:00.000Z',
      firstRefreshAt: '2026-04-01T08:00:00.000Z',
      namespaceFrequency: { config: 10, clandestino: 5 },
      topActors: [
        { actor: 'ops', refreshCount: 8, successCount: 7, lastSeenAt: '2026-04-07T12:00:00.000Z' }
      ]
    });

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app)
      .get('/api/constants/refresh-stats')
      .set('x-constants-refresh-token', ADMIN_TOKEN);

    expect(response.status).toBe(200);
    expect(getRefreshStatsMock).toHaveBeenCalledTimes(1);
    expect(response.body.totalRefreshes).toBe(12);
    expect(response.body.successRate).toBe(83);
    expect(response.body.namespaceFrequency).toEqual({ config: 10, clandestino: 5 });
    expect(Array.isArray(response.body.topActors)).toBeTruthy();
  });

  it('rejects refresh-stats without token when token protection is configured', async () => {
    mockConfig.CONSTANTS_REFRESH_TOKEN = 'secret-token';

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).get('/api/constants/refresh-stats');

    expect(response.status).toBe(401);
    expect(getRefreshStatsMock).not.toHaveBeenCalled();
  });

  it('lists catalog snapshots for authorized request', async () => {
    listSnapshotsMock.mockResolvedValue([
      {
        id: 5,
        namespace: 'config',
        actor: 'ops',
        label: null,
        entryCount: 4,
        createdAt: '2026-04-07T13:00:00.000Z'
      }
    ]);

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app)
      .get('/api/constants/snapshots?limit=5')
      .set('x-constants-refresh-token', ADMIN_TOKEN);

    expect(response.status).toBe(200);
    expect(listSnapshotsMock).toHaveBeenCalledWith(5, undefined);
    expect(response.body.snapshots).toHaveLength(1);
    expect(response.body.snapshots[0].id).toBe(5);
    expect(response.body.snapshots[0].namespace).toBe('config');
  });

  it('rejects snapshots list without token when token protection is configured', async () => {
    mockConfig.CONSTANTS_REFRESH_TOKEN = 'secret-token';

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).get('/api/constants/snapshots');

    expect(response.status).toBe(401);
    expect(listSnapshotsMock).not.toHaveBeenCalled();
  });

  it('restores snapshot and returns ok payload', async () => {
    restoreSnapshotMock.mockResolvedValue({
      id: 7,
      namespace: 'clandestino',
      actor: 'ops',
      label: null,
      data: {},
      entryCount: 6,
      createdAt: '2026-04-07T12:30:00.000Z'
    });
    statsMock.mockReturnValue({ clandestino: 6 });

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app)
      .post('/api/constants/snapshots/7/restore')
      .set('x-constants-refresh-token', ADMIN_TOKEN);

    expect(response.status).toBe(200);
    expect(restoreSnapshotMock).toHaveBeenCalledWith(7);
    expect(response.body.ok).toBe(true);
    expect(response.body.restoredSnapshotId).toBe(7);
    expect(response.body.namespace).toBe('clandestino');
    expect(response.body.entryCount).toBe(6);
  });

  it('returns 404 when restoring non-existent snapshot', async () => {
    restoreSnapshotMock.mockResolvedValue(null);

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app)
      .post('/api/constants/snapshots/999/restore')
      .set('x-constants-refresh-token', ADMIN_TOKEN);

    expect(response.status).toBe(404);
  });

  it('rejects restore without token when token protection is configured', async () => {
    mockConfig.CONSTANTS_REFRESH_TOKEN = 'secret-token';

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).post('/api/constants/snapshots/1/restore');

    expect(response.status).toBe(401);
    expect(restoreSnapshotMock).not.toHaveBeenCalled();
  });

  it('rejects admin refresh endpoints when token is not configured in non-production', async () => {
    mockConfig.CONSTANTS_REFRESH_TOKEN = undefined;

    const { default: router } = await import('../routes/constantsRoutes');

    const app = express();
    app.use('/api/constants', router);

    const response = await request(app).post('/api/constants/refresh');

    expect(response.status).toBe(401);
    expect(warmUpMock).not.toHaveBeenCalled();
  });
});