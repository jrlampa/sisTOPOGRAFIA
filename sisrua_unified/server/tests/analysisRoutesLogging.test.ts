import express from 'express';
import request from 'supertest';

const isAvailableMock = jest.fn();
const analyzeAreaMock = jest.fn();
const loggerErrorMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();

jest.mock('../services/ollamaService', () => ({
  OllamaService: {
    isAvailable: (...args: unknown[]) => isAvailableMock(...args),
    analyzeArea: (...args: unknown[]) => analyzeAreaMock(...args),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => loggerErrorMock(...args),
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
}));

describe('analysisRoutes logging hardening', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('logs only request metadata with truncated preview on analysis errors', async () => {
    isAvailableMock.mockResolvedValue(true);
    analyzeAreaMock.mockRejectedValueOnce(new Error('internal error'));

    const { default: analysisRoutes } = await import('../routes/analysisRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/analysis', analysisRoutes);

    const largeValue = 'x'.repeat(1500);
    const response = await request(app)
      .post('/api/analysis')
      .send({
        locationName: 'Area Teste',
        stats: {
          buildings: 10,
          privatePayload: largeValue,
          apiToken: 'super-secret-token',
        },
      });

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);

    const logPayload = loggerErrorMock.mock.calls[0][1] as {
      body?: unknown;
      request?: {
        hasBody: boolean;
        bodyType: string;
        topLevelKeyCount: number;
        topLevelKeys: string[];
        serializedSize: number;
        bodyPreview: string;
        bodyPreviewTruncated: boolean;
      };
    };

    expect(logPayload.body).toBeUndefined();
    expect(logPayload.request).toBeDefined();
    expect(logPayload.request?.hasBody).toBe(true);
    expect(logPayload.request?.bodyType).toBe('object');
    expect(logPayload.request?.topLevelKeys).toEqual(expect.arrayContaining(['stats', 'locationName']));
    expect(logPayload.request?.serializedSize).toBeGreaterThan(200);
    expect(logPayload.request?.bodyPreview.length).toBeLessThanOrEqual(200);
    expect(logPayload.request?.bodyPreviewTruncated).toBe(true);
    expect(logPayload.request?.bodyPreview).not.toContain('x'.repeat(500));
  });
});
