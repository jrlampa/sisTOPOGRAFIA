import express from 'express';
import request from 'supertest';

const getJobMock = jest.fn();

jest.mock('../services/jobStatusService', () => ({
  getJob: getJobMock,
}));

describe('jobRoutes error sanitization', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns generic 500 without details leakage on job lookup failure', async () => {
    getJobMock.mockImplementationOnce(() => {
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
