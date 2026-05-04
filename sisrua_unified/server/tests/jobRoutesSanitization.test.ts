import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

// Mock permissionHandler to bypass authorization
vi.mock('../middleware/permissionHandler', () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
      res.locals.userId = 'test-user';
      res.locals.userRole = 'admin';
      res.locals.tenantId = 'test-tenant';
      next();
  },
}));

const getJobWithPersistenceMock = vi.fn();

vi.mock('../services/jobStatusService', () => ({
  getJobWithPersistence: getJobWithPersistenceMock,
}));

describe('jobRoutes error sanitization', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns generic 500 without details leakage on job lookup failure', async () => {
    getJobWithPersistenceMock.mockImplementationOnce(() => {
      throw new Error('database host 172.20.0.3 refused connection');
    });

    const { default: jobRoutes } = await import('../routes/jobRoutes');
    const app = express();
    app.use('/api/jobs', jobRoutes);

    const response = await request(app).get('/api/jobs/6f7f5a61-1eb1-4049-b2d2-4a9e2a879f61');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to retrieve job status' });
    expect(JSON.stringify(response.body)).not.toContain('172.20.0.3');
    expect(JSON.stringify(response.body)).not.toContain('refused');
  });
});
