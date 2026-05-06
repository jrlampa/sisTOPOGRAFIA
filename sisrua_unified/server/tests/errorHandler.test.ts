import { vi } from "vitest";
import { ApiError, ErrorCategory, ErrorCode, errorHandler, createError, asyncHandler } from '../errorHandler.js';
import express, { Request, Response, NextFunction } from 'express';
import supertest from 'supertest';
import { config } from '../config.js';

vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '../utils/logger.js';

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    locals: {},
  } as any;
}

describe('errorHandler', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = { locals: {} };
    mockRes = createResponseMock();
    mockRes.locals.requestId = 'req-test-1';
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('retorna payload ApiError com status e ErrorCode correto', () => {
    const err = new ApiError('Invalid input', 400, ErrorCategory.VALIDATION, ErrorCode.INPUT_INVALID);
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid input',
        code: ErrorCode.INPUT_INVALID,
        category: ErrorCategory.VALIDATION,
      })
    );
  });

  it('sanitiza erros desconhecidos em produção', () => {
    const originalEnv = config.NODE_ENV;
    (config as any).NODE_ENV = 'production';

    const err = new Error('database connection refused 10.0.0.5');
    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal server error',
        code: ErrorCode.INTERNAL_SERVER_ERROR,
      })
    );
    // Não deve vazar detalhes sensíveis
    expect(JSON.stringify(mockRes.json.mock.calls[0][0])).not.toContain('10.0.0.5');

    (config as any).NODE_ENV = originalEnv;
  });
});

describe('createError factories', () => {
  it('authentication retorna ErrorCode.UNAUTHORIZED', () => {
    const e = createError.authentication('nao autenticado');
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('authorization retorna ErrorCode.FORBIDDEN', () => {
    const e = createError.authorization('sem permissao');
    expect(e.statusCode).toBe(403);
    expect(e.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('notFound retorna ErrorCode.RESOURCE_NOT_FOUND', () => {
    const e = createError.notFound('Recurso');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
  });

  it('rateLimit retorna ErrorCode.CAPACITY_EXCEEDED', () => {
    const e = createError.rateLimit();
    expect(e.statusCode).toBe(429);
    expect(e.code).toBe(ErrorCode.CAPACITY_EXCEEDED);
  });
});

describe('asyncHandler integration', () => {
  it('captura erros em rotas async e repassa ao middleware global', async () => {
    const app = express();
    app.get('/fail', asyncHandler(async () => {
      throw createError.validation('fail validation');
    }));
    app.use(errorHandler);

    const res = await supertest(app).get('/fail');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.INPUT_INVALID);
  });
});

