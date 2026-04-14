/**
 * Centralized error handling utilities
 * Categorizes errors for better debugging and client feedback
 */
import { config } from './config.js';

export enum ErrorCategory {
  VALIDATION = 'ValidationError',
  AUTHENTICATION = 'AuthenticationError',
  AUTHORIZATION = 'AuthorizationError',
  NOT_FOUND = 'NotFoundError',
  CONFLICT = 'ConflictError',
  RATE_LIMIT = 'RateLimitError',
  EXTERNAL_SERVICE = 'ExternalServiceError',
  INTERNAL = 'InternalError',
}

export interface ApiErrorResponse {
  error: string;
  code: ErrorCategory;
  details?: Record<string, any>;
  requestId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCategory;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCategory,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  public toJSON(): ApiErrorResponse {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Factory functions for creating categorized errors
 */
export const createError = {
  validation: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 400, ErrorCategory.VALIDATION, details),

  authentication: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 401, ErrorCategory.AUTHENTICATION, details),

  authorization: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 403, ErrorCategory.AUTHORIZATION, details),

  notFound: (resource: string, details?: Record<string, any>) =>
    new ApiError(`${resource} not found`, 404, ErrorCategory.NOT_FOUND, details),

  conflict: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 409, ErrorCategory.CONFLICT, details),

  rateLimit: (message = 'Too many requests', details?: Record<string, any>) =>
    new ApiError(message, 429, ErrorCategory.RATE_LIMIT, details),

  externalService: (service: string, originalError?: Error) =>
    new ApiError(
      `Failed to reach external service: ${service}`,
      502,
      ErrorCategory.EXTERNAL_SERVICE,
      { originalMessage: originalError?.message }
    ),

  internal: (message: string, originalError?: Error) =>
    new ApiError(
      message || 'Internal server error',
      500,
      ErrorCategory.INTERNAL,
      { originalMessage: originalError?.message }
    ),
};

/**
 * Express error handler middleware
 * Call this as the last middleware in your Express app
 * @param err Error object
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function errorHandler(err: any, req: any, res: any, _next: any) {
  const requestId = req.id || `req-${Date.now()}`;

  // Handle our custom ApiError
  if (err instanceof ApiError) {
    const response: ApiErrorResponse = {
      error: err.message,
      code: err.code,
      details: config.NODE_ENV === 'development' ? err.details : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    };

    // Log error in development
    if (config.NODE_ENV === 'development') {
      console.error(`[${err.code}] ${err.message}`, {
        statusCode: err.statusCode,
        details: err.details,
        stack: err.stack,
      });
    } else {
      // In production, log only important errors and never include stack
      console.error(`[${err.code}] ${err.message}`, {
        statusCode: err.statusCode,
        requestId,
      });
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle unknown errors
  const unknownError: ApiErrorResponse = {
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
    code: ErrorCategory.INTERNAL,
    requestId,
    timestamp: new Date().toISOString(),
  };

  if (config.NODE_ENV === 'development') {
    console.error('[InternalError] Unknown error', {
      error: err,
      stack: err.stack,
    });
  } else {
    console.error('[InternalError]', {
      requestId,
      errorType: err.constructor.name,
    });
  }

  return res.status(500).json(unknownError);
}

/**
 * Wraps async route handlers to catch errors and pass to errorHandler
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(fn: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}
