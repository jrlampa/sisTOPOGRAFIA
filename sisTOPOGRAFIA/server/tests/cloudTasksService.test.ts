import { jest } from '@jest/globals';

// Mock logger before importing the service
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const createTaskMock = jest.fn();
const queuePathMock = jest.fn();

jest.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

const generateDxfMock = jest.fn();
jest.mock('../pythonBridge', () => ({
  generateDxf: generateDxfMock
}));

jest.mock('../services/dxfCleanupService', () => ({
  scheduleDxfDeletion: jest.fn()
}));

jest.mock('../services/jobStatusService', () => ({
  createJob: jest.fn(),
  updateJobStatus: jest.fn(),
  completeJob: jest.fn(),
  failJob: jest.fn()
}));

jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn(() => ({
    createTask: createTaskMock,
    queuePath: queuePathMock
  }))
}));

const BASE_PAYLOAD = {
  lat: 1,
  lon: 2,
  radius: 3,
  mode: 'circle',
  polygon: '[]',
  layers: {},
  projection: 'local',
  outputFile: '/tmp/file.dxf',
  filename: 'file.dxf',
  cacheKey: 'cache-key',
  downloadUrl: 'https://example.com/downloads/file.dxf'
};

describe('cloudTasksService — Production mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    createTaskMock.mockResolvedValue([{ name: 'tasks/123' }]);
    queuePathMock.mockReturnValue('projects/test/locations/loc/queues/queue');
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      GCP_PROJECT: 'test-project',
      CLOUD_TASKS_LOCATION: 'loc',
      CLOUD_TASKS_QUEUE: 'queue',
      CLOUD_RUN_BASE_URL: 'https://example.com',
      CLOUD_RUN_SERVICE_ACCOUNT: 'svc@example.com'
    };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('inclui service account ao criar Cloud Task', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');

    await createDxfTask(BASE_PAYLOAD);

    expect(createTaskMock).toHaveBeenCalledTimes(1);
    const taskArg = createTaskMock.mock.calls[0][0].task;
    expect(taskArg.httpRequest?.oidcToken?.serviceAccountEmail).toBe('svc@example.com');
  });

  it('retorna taskId e taskName no sucesso', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');

    const result = await createDxfTask(BASE_PAYLOAD);

    expect(result.taskId).toBe('test-uuid');
    expect(result.taskName).toBe('tasks/123');
    expect(result.alreadyCompleted).toBeUndefined();
  });

  it('codifica payload como base64 no body da task', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');

    await createDxfTask(BASE_PAYLOAD);

    const taskArg = createTaskMock.mock.calls[0][0].task;
    const body = taskArg.httpRequest?.body;
    const decoded = JSON.parse(Buffer.from(body, 'base64').toString());
    expect(decoded.lat).toBe(BASE_PAYLOAD.lat);
    expect(decoded.lon).toBe(BASE_PAYLOAD.lon);
    expect(decoded.cacheKey).toBe(BASE_PAYLOAD.cacheKey);
  });

  it('trata erro PERMISSION_DENIED com mensagem descritiva', async () => {
    const permError: any = new Error('PERMISSION_DENIED: Missing permission');
    permError.code = 7;
    createTaskMock.mockRejectedValueOnce(permError);

    const { createDxfTask } = await import('../services/cloudTasksService');

    await expect(createDxfTask(BASE_PAYLOAD)).rejects.toThrow(/Permission denied/i);
  });

  it('trata erro NOT_FOUND com mensagem descritiva', async () => {
    const notFoundError: any = new Error('NOT_FOUND: queue does not exist');
    notFoundError.code = 5;
    createTaskMock.mockRejectedValueOnce(notFoundError);

    const { createDxfTask } = await import('../services/cloudTasksService');

    await expect(createDxfTask(BASE_PAYLOAD)).rejects.toThrow(/not found/i);
  });

  it('trata erro genérico com mensagem padrão', async () => {
    const genericError = new Error('Network timeout');
    createTaskMock.mockRejectedValueOnce(genericError);

    const { createDxfTask } = await import('../services/cloudTasksService');

    await expect(createDxfTask(BASE_PAYLOAD)).rejects.toThrow(/Failed to create Cloud Task/i);
  });
});

describe('cloudTasksService — Development mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    generateDxfMock.mockResolvedValue(undefined);
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      GCP_PROJECT: ''  // No project → IS_DEVELOPMENT = true
    };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('gera DXF diretamente no modo desenvolvimento', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');

    const result = await createDxfTask(BASE_PAYLOAD);

    expect(result.taskId).toBe('test-uuid');
    expect(result.alreadyCompleted).toBe(true);
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it('marca job como completo no modo desenvolvimento', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');
    const { completeJob } = await import('../services/jobStatusService');

    await createDxfTask(BASE_PAYLOAD);

    expect(completeJob).toHaveBeenCalledWith('test-uuid', {
      url: BASE_PAYLOAD.downloadUrl,
      filename: BASE_PAYLOAD.filename
    });
  });

  it('chama scheduleDxfDeletion no modo desenvolvimento', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');
    const { scheduleDxfDeletion } = await import('../services/dxfCleanupService');

    await createDxfTask(BASE_PAYLOAD);

    expect(scheduleDxfDeletion).toHaveBeenCalledWith(BASE_PAYLOAD.outputFile);
  });

  it('falha graciosamente quando generateDxf lança erro no modo dev', async () => {
    generateDxfMock.mockRejectedValueOnce(new Error('Python bridge failed'));

    const { createDxfTask } = await import('../services/cloudTasksService');

    await expect(createDxfTask(BASE_PAYLOAD)).rejects.toThrow(/DXF generation failed/i);
  });

  it('chama failJob quando generateDxf falha no modo dev', async () => {
    generateDxfMock.mockRejectedValueOnce(new Error('Engine error'));

    const { createDxfTask } = await import('../services/cloudTasksService');
    const { failJob } = await import('../services/jobStatusService');

    await expect(createDxfTask(BASE_PAYLOAD)).rejects.toThrow();
    expect(failJob).toHaveBeenCalledWith('test-uuid', 'Engine error');
  });
});

describe('cloudTasksService — getTaskStatus', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retorna status unknown com taskId correto', async () => {
    const { getTaskStatus } = await import('../services/cloudTasksService');

    const result = await getTaskStatus('my-task-id');

    expect(result.taskId).toBe('my-task-id');
    expect(result.status).toBe('unknown');
  });
});
