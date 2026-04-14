import { jest } from '@jest/globals';

const unsafeMock = jest.fn();
const endMock = jest.fn().mockResolvedValue(undefined);

jest.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

jest.mock('../pythonBridge', () => ({
  generateDxf: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../services/jobStatusService', () => ({
  createJob: jest.fn(),
  completeJob: jest.fn().mockResolvedValue(undefined),
  failJob: jest.fn().mockResolvedValue(undefined),
  updateJobStatus: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../services/dxfCleanupService', () => ({
  scheduleDxfDeletion: jest.fn()
}));

jest.mock('postgres', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    unsafe: unsafeMock,
    end: endMock
  }))
}));

describe('cloudTasksService (Postgres queue)', () => {
  const originalEnv = process.env;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/testdb?sslmode=require';

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      USE_SUPABASE_JOBS: 'true'
    };

    unsafeMock.mockReset();
    endMock.mockClear();

    // 1) idempotency check — no existing task
    unsafeMock
      .mockResolvedValueOnce([])
      // 2) insert queued row
      .mockResolvedValueOnce([]);

    jest.resetModules();
  });

  afterEach(async () => {
    process.env = originalEnv;
    const mod = await import('../services/cloudTasksService');
    mod.stopTaskWorker();
    jest.clearAllMocks();
  });

  it('queues DXF task into Postgres and returns task id', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');

    const result = await createDxfTask({
      lat: 1,
      lon: 2,
      radius: 3,
      mode: 'circle',
      polygon: '[]',
      layers: {},
      projection: 'local',
      contourRenderMode: 'spline',
      outputFile: '/tmp/file.dxf',
      filename: 'file.dxf',
      cacheKey: 'cache-key',
      downloadUrl: 'https://example.com/downloads/file.dxf'
    });

    expect(result.taskId).toBe('test-uuid');
    expect(result.taskName).toBe('pg-task-test-uuid');
    expect(result.alreadyCompleted).toBe(false);
    expect(unsafeMock).toHaveBeenCalledTimes(2);
  });
});
