import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

const configMock = {
  NODE_ENV: 'production',
  useSupabaseJobs: true,
  useFirestore: false,
  CONSTANTS_REFRESH_TOKEN: 'admin-token',
};

vi.mock('../config', () => ({
  config: configMock,
}));

describe('storageRoutes authorization', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 401 in production without admin token', async () => {
    const { default: storageRoutes } = await import('../routes/storageRoutes');
    const app = express();
    app.use('/api/storage', storageRoutes);

    const response = await request(app).get('/api/storage/health');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized storage health request' });
  });

  it('returns 200 in production with correct admin token', async () => {
    const { default: storageRoutes } = await import('../routes/storageRoutes');
    const app = express();
    app.use('/api/storage', storageRoutes);

    const response = await request(app)
      .get('/api/storage/health')
      .set('x-constants-refresh-token', 'admin-token');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('online');
  });
});

