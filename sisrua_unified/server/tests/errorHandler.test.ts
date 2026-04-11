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
