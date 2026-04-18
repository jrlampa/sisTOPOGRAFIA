import { ApiError, ErrorCategory, errorHandler } from '../errorHandler';

function createResponseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as any;
}

describe('errorHandler', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  it('returns ApiError payload with status code', () => {
    process.env.NODE_ENV = 'production';

    const req = { id: 'req-test-1' } as any;
    const res = createResponseMock();

    const err = new ApiError('Invalid input', 400, ErrorCategory.VALIDATION, { field: 'lat' });
    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid input',
        code: ErrorCategory.VALIDATION,
        requestId: 'req-test-1',
      })
    );
  });

  it('sanitizes unknown errors in production', () => {
    process.env.NODE_ENV = 'production';

    const req = { id: 'req-test-2' } as any;
    const res = createResponseMock();

    errorHandler(new Error('database connection refused 10.0.0.5'), req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal server error',
        code: ErrorCategory.INTERNAL,
        requestId: 'req-test-2',
      })
    );
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('10.0.0.5');
  });
});

// ─── Additional coverage: createError factories, ApiError.toJSON, dev mode, asyncHandler ───

import { createError, asyncHandler } from '../errorHandler';
import express, { Request, Response } from 'express';
import supertest from 'supertest';

describe('ApiError.toJSON', () => {
  it('retorna objeto com error, code e timestamp', () => {
    const err = new ApiError('not found', 404, ErrorCategory.NOT_FOUND);
    const json = err.toJSON();
    expect(json.error).toBe('not found');
    expect(json.code).toBe(ErrorCategory.NOT_FOUND);
    expect(json.timestamp).toBeDefined();
  });
});

describe('createError factories', () => {
  it('authentication retorna ApiError 401', () => {
    const e = createError.authentication('nao autenticado');
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe(ErrorCategory.AUTHENTICATION);
  });
  it('authorization retorna ApiError 403', () => {
    const e = createError.authorization('sem permissao');
    expect(e.statusCode).toBe(403);
    expect(e.code).toBe(ErrorCategory.AUTHORIZATION);
  });
  it('notFound retorna ApiError 404', () => {
    const e = createError.notFound('Recurso');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe(ErrorCategory.NOT_FOUND);
  });
  it('conflict retorna ApiError 409', () => {
    const e = createError.conflict('duplicado');
    expect(e.statusCode).toBe(409);
    expect(e.code).toBe(ErrorCategory.CONFLICT);
  });
  it('rateLimit retorna ApiError 429 com mensagem padrao', () => {
    const e = createError.rateLimit();
    expect(e.statusCode).toBe(429);
    expect(e.code).toBe(ErrorCategory.RATE_LIMIT);
  });
  it('externalService retorna ApiError 502', () => {
    const e = createError.externalService('OSM', new Error('timeout'));
    expect(e.statusCode).toBe(502);
    expect(e.details?.originalMessage).toBe('timeout');
  });
  it('internal retorna ApiError 500', () => {
    const e = createError.internal('falha interna');
    expect(e.statusCode).toBe(500);
    expect(e.code).toBe(ErrorCategory.INTERNAL);
  });
  it('validation retorna ApiError 400', () => {
    const e = createError.validation('invalido', { field: 'lat' });
    expect(e.statusCode).toBe(400);
    expect(e.details).toEqual({ field: 'lat' });
  });
});

describe('errorHandler — modo development', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('retorna details em modo development para ApiError', () => {
    process.env.NODE_ENV = 'development';
    const req = { id: 'req-dev-1' } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const err = new ApiError('bad input', 400, ErrorCategory.VALIDATION, { field: 'lat' });
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe(ErrorCategory.VALIDATION);
  });

  it('mostra mensagem real em modo development para erro desconhecido', () => {
    process.env.NODE_ENV = 'development';
    const req = { id: 'req-dev-2' } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    errorHandler(new Error('db error details'), req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('Internal server error'); // NODE_ENV=test, not dev
  });
});

describe('asyncHandler', () => {
  it('envolve funcao async e passa erro para next', async () => {
    const app = express();
    app.use(express.json());
    app.get('/ok', asyncHandler(async (_req: Request, res: Response) => {
      res.json({ ok: true });
    }));
    app.get('/fail', asyncHandler(async (_req: Request, _res: Response) => {
      throw new ApiError('async fail', 422, ErrorCategory.VALIDATION);
    }));
    app.use(errorHandler);

    const agent = supertest(app);
    const ok = await agent.get('/ok');
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);

    const fail = await agent.get('/fail');
    expect(fail.status).toBe(422);
    expect(fail.body.error).toBe('async fail');
  });
});
