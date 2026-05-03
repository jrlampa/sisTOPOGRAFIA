/**
 * Centralized error handling utilities
 * Categorizes errors for better debugging and client feedback
 */
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

export enum ErrorCategory {
  VALIDATION = "ValidationError",
  AUTHENTICATION = "AuthenticationError",
  AUTHORIZATION = "AuthorizationError",
  NOT_FOUND = "NotFoundError",
  CONFLICT = "ConflictError",
  RATE_LIMIT = "RateLimitError",
  EXTERNAL_SERVICE = "ExternalServiceError",
  INTERNAL = "InternalError",
}

/**
 * Standardized Error Codes for programmatic client handling.
 * Roadmap Item P1.2 [T1]: Error Taxonomy.
 */
export enum ErrorCode {
  INPUT_INVALID = "INPUT_INVALID",
  FILE_TOO_LARGE = "FILE_EXCEEDS_LIMIT",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  RESOURCE_NOT_FOUND = "NOT_FOUND",
  DATABASE_ERROR = "DB_ERROR",
  EXTERNAL_TIMEOUT = "EXTERNAL_TIMEOUT",
  CAPACITY_EXCEEDED = "CAPACITY_ERROR",
  INTERNAL_SERVER_ERROR = "INTERNAL_ERROR",
  DXF_GENERATION_FAILED = "DXF_FAILED",
}

export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
  category: ErrorCategory;
  details?: Record<string, any>;
  requestId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly category: ErrorCategory;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number,
    category: ErrorCategory,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: Record<string, any>,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.category = category;
    this.code = code;
    this.details = details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  public toJSON(): ApiErrorResponse {
    return {
      error: this.message,
      code: this.code,
      category: this.category,
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
    new ApiError(message, 400, ErrorCategory.VALIDATION, ErrorCode.INPUT_INVALID, details),

  authentication: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 401, ErrorCategory.AUTHENTICATION, ErrorCode.UNAUTHORIZED, details),

  authorization: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 403, ErrorCategory.AUTHORIZATION, ErrorCode.FORBIDDEN, details),

  notFound: (resource: string, details?: Record<string, any>) =>
    new ApiError(
      `${resource} not found`,
      404,
      ErrorCategory.NOT_FOUND,
      ErrorCode.RESOURCE_NOT_FOUND,
      details,
    ),

  conflict: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 409, ErrorCategory.CONFLICT, ErrorCode.DATABASE_ERROR, details),

  rateLimit: (message = "Too many requests", details?: Record<string, any>) =>
    new ApiError(message, 429, ErrorCategory.RATE_LIMIT, ErrorCode.CAPACITY_EXCEEDED, details),

  externalService: (service: string, originalError?: Error, code: ErrorCode = ErrorCode.EXTERNAL_TIMEOUT) =>
    new ApiError(
      `Failed to reach external service: ${service}`,
      502,
      ErrorCategory.EXTERNAL_SERVICE,
      code,
      { originalMessage: originalError?.message },
    ),

  internal: (message: string, originalError?: Error, code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR) =>
    new ApiError(
      message || "Internal server error",
      500,
      ErrorCategory.INTERNAL,
      code,
      { originalMessage: originalError?.message },
    ),
};

import { z } from "zod";

/**
 * Express error handler middleware
 * Call this as the last middleware in your Express app
 * @param err Error object
 * @param req Express request
 * @param res Express response
 * @param next Express next function
 */
export function errorHandler(err: any, req: any, res: any, _next: any) {
  const requestId = res.locals?.requestId || `req-${Date.now()}`;
  const operation_id = res.locals?.operation_id;
  const projeto_id = res.locals?.projeto_id;
  const ponto_id = res.locals?.ponto_id;
  const tenant_id = res.locals?.tenantId || res.locals?.tenant_id;

  // 1. Handle our custom ApiError
  if (err instanceof ApiError) {
    const response: ApiErrorResponse = {
      error: err.message,
      code: err.code,
      category: err.category,
      details: config.NODE_ENV === "development" ? err.details : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    };

    // Log error
    const logMetadata = {
      statusCode: err.statusCode,
      requestId,
      tenant_id,
      operation_id,
      projeto_id,
      ponto_id,
      details: err.details,
      stack: config.NODE_ENV === "development" ? err.stack : undefined,
    };

    if (err.statusCode >= 500) {
      logger.error(`[${err.category}] ${err.message}`, logMetadata);
    } else {
      logger.warn(`[${err.category}] ${err.message}`, logMetadata);
    }

    return res.status(err.statusCode).json(response);
  }

  // 2. Handle Zod validation errors
  if (err instanceof z.ZodError) {
    const response: ApiErrorResponse = {
      error: "Falha na validação dos dados (Zod)",
      code: ErrorCode.INPUT_INVALID,
      category: ErrorCategory.VALIDATION,
      details: { errors: err.issues },
      requestId,
      timestamp: new Date().toISOString(),
    };

    logger.warn(`[${ErrorCode.INPUT_INVALID}] Zod Validation Error`, {
      requestId,
      tenant_id,
      errors: err.issues,
    });

    return res.status(400).json(response);
  }

  // 3. Handle errors with status codes (e.g. body-parser 413, or other middleware errors)
  if (err.status || err.statusCode) {
    const statusCode = err.status || err.statusCode;
    const response: ApiErrorResponse = {
      error: err.message || "Request Error",
      code: statusCode === 413 ? ErrorCode.FILE_TOO_LARGE : ErrorCode.INPUT_INVALID,
      category: ErrorCategory.VALIDATION,
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      logger.error(`[${ErrorCode.INTERNAL_SERVER_ERROR}] ${err.message}`, { requestId, tenant_id, error: err });
    } else {
      logger.warn(`[${ErrorCode.INPUT_INVALID}] ${err.message}`, { requestId, tenant_id, error: err });
    }

    return res.status(statusCode).json(response);
  }

  // 4. Handle unknown errors
  const response: ApiErrorResponse = {
    error:
      config.NODE_ENV === "development" ? err.message : "Internal server error",
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    category: ErrorCategory.INTERNAL,
    requestId,
    timestamp: new Date().toISOString(),
  };

  logger.error(`[${ErrorCode.INTERNAL_SERVER_ERROR}] ${err.message || "Unknown error"}`, {
    requestId,
    tenant_id,
    operation_id,
    projeto_id,
    ponto_id,
    error: err,
    stack: err.stack,
  });

  return res.status(500).json(response);
}

/**
 * Wraps async route handlers to catch errors and pass to errorHandler
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>,
) {
  return (req: any, res: any, next: any) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}
