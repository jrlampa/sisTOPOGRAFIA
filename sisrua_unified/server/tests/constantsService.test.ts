import { vi } from "vitest";

const sqlQueryMock = vi.fn();
const postgresFactoryMock = vi.fn(() => {
  const sql = sqlQueryMock as typeof sqlQueryMock & { array: (value: string[]) => string[]; json: (value: unknown) => unknown };
  sql.array = (value: string[]) => value;
  sql.json = (value: unknown) => value;
  return sql;
});

vi.mock('postgres', () => ({
  __esModule: true,
  default: postgresFactoryMock
}));

describe('constantsService', () => {
  const originalEnv = process.env;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/testdb?sslmode=require';

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl
    };

    sqlQueryMock.mockReset();
    postgresFactoryMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('warms the cache from constants_catalog and serves sync reads', async () => {
    sqlQueryMock.mockResolvedValueOnce([
      {
        namespace: 'cqt',
        key: 'CABOS_BASELINE',
        value: [{ name: '70 Al - MX', ampacity: 202 }],
        version_hash: '1.0.0'
      },
      {
        namespace: 'clandestino',
        key: 'AREA_TO_KVA',
        value: { '20': 1.62 },
        version_hash: '1.0.0'
      }
    ]);

    const { constantsService } = await import('../services/constantsService');

    await constantsService.warmUp(['cqt', 'clandestino']);

    expect(postgresFactoryMock).toHaveBeenCalledTimes(1);
    expect(constantsService.getSync('cqt', 'CABOS_BASELINE')).toEqual([{ name: '70 Al - MX', ampacity: 202 }]);
    expect(constantsService.getSync('clandestino', 'AREA_TO_KVA')).toEqual({ '20': 1.62 });
    expect(constantsService.stats()).toEqual({ cqt: 1, clandestino: 1 });
  });

  it('removes stale namespace entries on subsequent warmups', async () => {
    sqlQueryMock
      .mockResolvedValueOnce([
        {
          namespace: 'config',
          key: 'RATE_LIMIT_GENERAL_MAX',
          value: 100,
          version_hash: '1.0.0'
        },
        {
          namespace: 'config',
          key: 'RATE_LIMIT_DXF_MAX',
          value: 10,
          version_hash: '1.0.0'
        }
      ])
      .mockResolvedValueOnce([
        {
          namespace: 'config',
          key: 'RATE_LIMIT_GENERAL_MAX',
          value: 120,
          version_hash: '1.0.1'
        }
      ]);

    const { constantsService } = await import('../services/constantsService');

    await constantsService.warmUp(['config']);
    expect(constantsService.stats()).toEqual({ config: 2 });

    await constantsService.warmUp(['config']);

    expect(constantsService.getSync('config', 'RATE_LIMIT_GENERAL_MAX')).toEqual(120);
    expect(constantsService.getSync('config', 'RATE_LIMIT_DXF_MAX')).toBeUndefined();
    expect(constantsService.stats()).toEqual({ config: 1 });
  });

  it('skips warmup when DATABASE_URL is not configured', async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();

    const { constantsService } = await import('../services/constantsService');

    await constantsService.warmUp(['cqt']);

    expect(postgresFactoryMock).not.toHaveBeenCalled();
    expect(constantsService.getSync('cqt', 'CABOS_BASELINE')).toBeUndefined();
  });

  it('records and reads refresh events', async () => {
    sqlQueryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          namespaces: ['config', 'cqt'],
          success: true,
          http_status: 200,
          actor: 'ops-user',
          duration_ms: 88,
          error_message: null,
          created_at: '2026-04-07T10:00:00.000Z'
        }
      ]);

    const { constantsService } = await import('../services/constantsService');

    await constantsService.recordRefreshEvent({
      namespaces: ['config', 'cqt'],
      success: true,
      httpStatus: 200,
      actor: 'ops-user',
      durationMs: 88
    });

    const event = await constantsService.getLastRefreshEvent();

    expect(event).toEqual({
      namespaces: ['config', 'cqt'],
      success: true,
      httpStatus: 200,
      actor: 'ops-user',
      durationMs: 88,
      createdAt: '2026-04-07T10:00:00.000Z'
    });
  });

  it('lists refresh events with normalized payload', async () => {
    sqlQueryMock.mockResolvedValueOnce([
      {
        namespaces: ['config'],
        success: false,
        http_status: 401,
        actor: 'unknown',
        duration_ms: 5,
        error_message: 'unauthorized',
        created_at: '2026-04-07T11:00:00.000Z'
      }
    ]);

    const { constantsService } = await import('../services/constantsService');

    const events = await constantsService.getRefreshEvents({ limit: 10 });

    expect(events.events).toEqual([
      {
        namespaces: ['config'],
        success: false,
        httpStatus: 401,
        actor: 'unknown',
        durationMs: 5,
        errorMessage: 'unauthorized',
        createdAt: '2026-04-07T11:00:00.000Z'
      }
    ]);
  });

  it('returns aggregated refresh statistics from three parallel queries', async () => {
    // Promise.all fires three sql calls in parallel; mock returns them in order.
    sqlQueryMock
      .mockResolvedValueOnce([
        {
          total_count: '20',
          success_count: '17',
          failure_count: '3',
          avg_duration_ms: '65',
          max_duration_ms: 300,
          min_success_duration_ms: 22,
          last_success_at: '2026-04-07T12:00:00.000Z',
          first_refresh_at: '2026-04-01T08:00:00.000Z'
        }
      ])
      .mockResolvedValueOnce([
        { ns: 'config', refresh_count: '15' },
        { ns: 'clandestino', refresh_count: '8' }
      ])
      .mockResolvedValueOnce([
        {
          actor: 'ops',
          refresh_count: '12',
          success_count: '11',
          last_seen_at: '2026-04-07T12:00:00.000Z'
        }
      ]);

    const { constantsService } = await import('../services/constantsService');

    const stats = await constantsService.getRefreshStats();

    expect(stats.totalRefreshes).toBe(20);
    expect(stats.successCount).toBe(17);
    expect(stats.failureCount).toBe(3);
    expect(stats.successRate).toBe(85);
    expect(stats.avgDurationMs).toBe(65);
    expect(stats.maxDurationMs).toBe(300);
    expect(stats.namespaceFrequency).toEqual({ config: 15, clandestino: 8 });
    expect(stats.topActors).toEqual([
      { actor: 'ops', refreshCount: 12, successCount: 11, lastSeenAt: '2026-04-07T12:00:00.000Z' }
    ]);
  });

    it('saves a snapshot of in-memory cache for a namespace', async () => {
      // Warm the cache so there are entries to snapshot.
      sqlQueryMock.mockResolvedValueOnce([
        {
          namespace: 'config',
          key: 'RATE_LIMIT_GENERAL_MAX',
          value: 100,
          version_hash: '1.0.0'
        }
      ]);
      // Mock the INSERT … RETURNING snapshot row.
      sqlQueryMock.mockResolvedValueOnce([
        {
          id: '42',
          namespace: 'config',
          actor: 'ci',
          label: null,
          data: { RATE_LIMIT_GENERAL_MAX: 100 },
          entry_count: 1,
          created_at: '2026-04-07T14:00:00.000Z'
        }
      ]);

      const { constantsService } = await import('../services/constantsService');

      await constantsService.warmUp(['config']);
      const snapshots = await constantsService.saveSnapshot(['config'], 'ci');

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe(42);
      expect(snapshots[0].namespace).toBe('config');
      expect(snapshots[0].entryCount).toBe(1);
    });

    it('lists snapshots ordered newest-first without data payload', async () => {
      sqlQueryMock.mockResolvedValueOnce([
        {
          id: '10',
          namespace: 'clandestino',
          actor: 'ops',
          label: 'pre-deploy',
          entry_count: 3,
          created_at: '2026-04-07T15:00:00.000Z'
        }
      ]);

      const { constantsService } = await import('../services/constantsService');

      const list = await constantsService.listSnapshots({ limit: 5 });

      expect(list.snapshots).toHaveLength(1);
      expect(list.snapshots[0].id).toBe(10);
      expect(list.snapshots[0].label).toBe('pre-deploy');
      expect(list.snapshots[0].entryCount).toBe(3);
      // Listing must NOT expose the data payload.
      expect((list.snapshots[0] as Record<string, unknown>)['data']).toBeUndefined();
    });

    it('restores in-memory cache from a stored snapshot', async () => {
      sqlQueryMock.mockResolvedValueOnce([
        {
          id: '15',
          namespace: 'config',
          actor: 'ops',
          label: null,
          data: { RATE_LIMIT_GENERAL_MAX: 80 },
          entry_count: 1,
          created_at: '2026-04-07T16:00:00.000Z'
        }
      ]);

      const { constantsService } = await import('../services/constantsService');

      const result = await constantsService.restoreSnapshot(15);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(15);
      expect(constantsService.getSync('config', 'RATE_LIMIT_GENERAL_MAX')).toBe(80);
      expect(constantsService.stats()).toEqual({ config: 1 });
    });
it('getRefreshEvents sorts by actor, httpStatus, durationMs, success', async () => {
    const twoEvents = [
      { namespaces: ['config'], success: true, http_status: 200, actor: 'bob', duration_ms: 100, error_message: null, created_at: '2026-04-07T10:00:00.000Z' },
      { namespaces: ['cqt'], success: false, http_status: 401, actor: 'alice', duration_ms: 50, error_message: 'unauthorized', created_at: '2026-04-07T09:00:00.000Z' },
    ];
    for (let i = 0; i < 4; i++) sqlQueryMock.mockResolvedValueOnce(twoEvents);
    const { constantsService } = await import('../services/constantsService');
    const r1 = await constantsService.getRefreshEvents({ sortBy: 'actor', sortOrder: 'asc' });
    expect(r1.events[0].actor).toBe('alice');
    const r2 = await constantsService.getRefreshEvents({ sortBy: 'httpStatus', sortOrder: 'asc' });
    expect(r2.events[0].httpStatus).toBe(200);
    const r3 = await constantsService.getRefreshEvents({ sortBy: 'durationMs', sortOrder: 'asc' });
    expect(r3.events[0].durationMs).toBe(50);
    const r4 = await constantsService.getRefreshEvents({ sortBy: 'success', sortOrder: 'desc' });
    expect(r4.events[0].success).toBe(true);
  });

  it('getRefreshEvents filters by namespace, actor, and success', async () => {
    const threeEvents = [
      { namespaces: ['config'], success: true, http_status: 200, actor: 'ops', duration_ms: 10, error_message: null, created_at: '2026-04-07T10:00:00.000Z' },
      { namespaces: ['cqt'], success: false, http_status: 500, actor: 'bot', duration_ms: 20, error_message: 'err', created_at: '2026-04-07T09:00:00.000Z' },
      { namespaces: ['config'], success: true, http_status: 200, actor: 'ops', duration_ms: 30, error_message: null, created_at: '2026-04-07T08:00:00.000Z' },
    ];
    for (let i = 0; i < 3; i++) sqlQueryMock.mockResolvedValueOnce(threeEvents);
    const { constantsService } = await import('../services/constantsService');
    const r1 = await constantsService.getRefreshEvents({ filters: { namespace: 'config' } });
    expect(r1.events).toHaveLength(2);
    const r2 = await constantsService.getRefreshEvents({ filters: { actor: 'ops' } });
    expect(r2.events).toHaveLength(2);
    const r3 = await constantsService.getRefreshEvents({ filters: { success: false } });
    expect(r3.events).toHaveLength(1);
  });

  it('getRefreshEvents returns empty on SQL error', async () => {
    sqlQueryMock.mockRejectedValueOnce(new Error('DB error'));
    const { constantsService } = await import('../services/constantsService');
    const result = await constantsService.getRefreshEvents({ limit: 5 });
    expect(result.events).toHaveLength(0);
  });

  it('listSnapshots sorts by namespace, actor, entryCount', async () => {
    const twoSnaps = [
      { id: '1', namespace: 'zzz', actor: 'bob', label: null, entry_count: 10, created_at: '2026-04-07T10:00:00.000Z' },
      { id: '2', namespace: 'aaa', actor: 'alice', label: null, entry_count: 5, created_at: '2026-04-07T09:00:00.000Z' },
    ];
    for (let i = 0; i < 3; i++) sqlQueryMock.mockResolvedValueOnce(twoSnaps);
    const { constantsService } = await import('../services/constantsService');
    const r1 = await constantsService.listSnapshots({ sortBy: 'namespace', sortOrder: 'asc' });
    expect(r1.snapshots[0].namespace).toBe('aaa');
    const r2 = await constantsService.listSnapshots({ sortBy: 'actor', sortOrder: 'asc' });
    expect(r2.snapshots[0].actor).toBe('alice');
    const r3 = await constantsService.listSnapshots({ sortBy: 'entryCount', sortOrder: 'asc' });
    expect(r3.snapshots[0].entryCount).toBe(5);
  });

  it('listSnapshots returns empty on SQL error', async () => {
    sqlQueryMock.mockRejectedValueOnce(new Error('DB error'));
    const { constantsService } = await import('../services/constantsService');
    const result = await constantsService.listSnapshots({ limit: 5 });
    expect(result.snapshots).toHaveLength(0);
  });
});

