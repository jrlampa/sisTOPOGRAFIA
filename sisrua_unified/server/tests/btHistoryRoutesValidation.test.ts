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
    expect(JSON.stringify(response.body.details)).toContain('btContextUrl inválido');
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

  it('applies list contract with pagination, sorting metadata and filters on GET /', async () => {
    listMock.mockResolvedValueOnce({
      entries: [{ criticalPoleId: 'P2' }],
      total: 4,
      limit: 2,
      offset: 1,
    });

    const { default: router } = await import('../routes/btHistoryRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/bt-history', router);

    const response = await request(app)
      .get('/api/bt-history')
      .query({
        limit: '2',
        offset: '1',
        sortBy: 'exportedAt',
        sortOrder: 'asc',
        projectType: 'ramais',
      });

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(
      2,
      1,
      {
        projectType: 'ramais',
        cqtScenario: undefined,
      },
      {
        sortBy: 'exportedAt',
        sortOrder: 'asc',
      },
    );
    expect(response.body.meta).toEqual({
      limit: 2,
      offset: 1,
      total: 4,
      returned: 1,
      hasMore: true,
      sortBy: 'exportedAt',
      sortOrder: 'asc',
      filters: {
        projectType: 'ramais',
        cqtScenario: null,
      },
    });
  });
});
