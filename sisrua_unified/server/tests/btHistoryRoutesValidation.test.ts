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

describe("btHistoryRoutes — ingest 422 e DELETE", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  async function buildApp() {
    const { default: router } = await import("../routes/btHistoryRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/bt-history", router);
    return app;
  }

  it("POST /ingest retorna 422 quando entry eh null", async () => {
    ingestMock.mockResolvedValueOnce({ entry: null });
    const app = await buildApp();
    const res = await request(app)
      .post("/api/bt-history/ingest")
      .send({
        projectType: "ramais",
        btContextUrl: "/downloads/context.json",
        btContext: { foo: "bar" },
        exportedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
  });

  it("DELETE / retorna 200 com deletedCount", async () => {
    clearMock.mockResolvedValueOnce({ deleted: 3 });
    const app = await buildApp();
    const res = await request(app).delete("/api/bt-history");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deletedCount).toBe(3);
  });

  it("DELETE / retorna 400 para query invalida", async () => {
    const app = await buildApp();
    const res = await request(app)
      .delete("/api/bt-history")
      .query({ projectType: "invalido" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Parâmetros inválidos");
  });
});
