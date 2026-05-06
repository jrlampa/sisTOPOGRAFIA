import { vi } from "vitest";
import express from 'express';
import request from 'supertest';

const getSyncMock = vi.fn();

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

vi.mock('../services/constantsService', () => ({
  constantsService: {
    getSync: (...args: unknown[]) => getSyncMock(...args),
  }
}));

vi.mock('../config', () => ({
  config: {
    useDbConstantsConfig: true,
    RATE_LIMIT_GENERAL_WINDOW_MS: 60_000,
    RATE_LIMIT_GENERAL_MAX: 100,
    RATE_LIMIT_DXF_WINDOW_MS: 60_000,
    RATE_LIMIT_DXF_MAX: 10,
  },
}));

describe('downloadsRateLimiter', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('blocks requests after configured downloads limit', async () => {
    getSyncMock.mockImplementation((namespace: string, key: string) => {
      if (namespace !== 'config') return undefined;
      if (key === 'RATE_LIMIT_DOWNLOADS_MAX') return 1;
      if (key === 'RATE_LIMIT_DOWNLOADS_WINDOW_MS') return 60_000;
      return undefined;
    });

    const { downloadsRateLimiter } = await import('../middleware/rateLimiter');
    const app = express();
    app.use('/downloads', downloadsRateLimiter, (_req, res) => res.json({ ok: true }));

    const first = await request(app).get('/downloads/file1.dxf');
    const second = await request(app).get('/downloads/file1.dxf');

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: 'Too many download requests, please try again later.' });
  });
});

