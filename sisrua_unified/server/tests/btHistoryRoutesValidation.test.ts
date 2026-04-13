import express from 'express';
import request from 'supertest';

const listMock = jest.fn();
const createMock = jest.fn();
const ingestMock = jest.fn();
const clearMock = jest.fn();

jest.mock('../services/btExportHistoryService', () => ({
  btExportHistoryService: {
    list: (...args: unknown[]) => listMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    ingestFromContext: (...args: unknown[]) => ingestMock(...args),
    clear: (...args: unknown[]) => clearMock(...args),
  }
}));

// Allow all permissions so these tests exercise payload validation, not auth.
jest.mock('../middleware/permissionHandler', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('btHistoryRoutes btContextUrl validation', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('rejects invalid btContextUrl on POST /', async () => {
    const { default: router } = await import('../routes/btHistoryRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/bt-history', router);

    const response = await request(app)
      .post('/api/bt-history')
      .send({
        exportedAt: new Date().toISOString(),
        projectType: 'ramais',
        btContextUrl: 'javascript:alert(1)',
        criticalPoleId: 'P1',
        criticalAccumulatedClients: 1,
        criticalAccumulatedDemandKva: 2,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Payload inválido');
    expect(response.body.details).toBeDefined();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('accepts safe local download URL on POST /ingest', async () => {
    ingestMock.mockResolvedValueOnce({ entry: { id: 1 } });

    const { default: router } = await import('../routes/btHistoryRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/bt-history', router);

    const response = await request(app)
      .post('/api/bt-history/ingest')
      .send({
        projectType: 'ramais',
        btContextUrl: '/downloads/job_123_bt_context.json',
        btContext: { poles: [] },
      });

    expect(response.status).toBe(201);
    expect(ingestMock).toHaveBeenCalled();
  });
});
