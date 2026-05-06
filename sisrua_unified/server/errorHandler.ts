/**
 * Centralized error handling utilities
 */
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { z } from "zod";

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
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly category: ErrorCategory,
    public readonly code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = "ApiError";
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

export const createError = {
  validation: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 400, ErrorCategory.VALIDATION, ErrorCode.INPUT_INVALID, details),
  authentication: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 401, ErrorCategory.AUTHENTICATION, ErrorCode.UNAUTHORIZED, details),
  authorization: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 403, ErrorCategory.AUTHORIZATION, ErrorCode.FORBIDDEN, details),
  notFound: (resource: string, details?: Record<string, any>) =>
    new ApiError(`${resource} not found`, 404, ErrorCategory.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND, details),
  conflict: (message: string, details?: Record<string, any>) =>
    new ApiError(message, 409, ErrorCategory.CONFLICT, ErrorCode.DATABASE_ERROR, details),
  rateLimit: (message = "Too many requests", details?: Record<string, any>) =>
    new ApiError(message, 429, ErrorCategory.RATE_LIMIT, ErrorCode.CAPACITY_EXCEEDED, details),
  externalService: (service: string, originalError?: Error, code: ErrorCode = ErrorCode.EXTERNAL_TIMEOUT) =>
    new ApiError(`Failed to reach external service: ${service}`, 502, ErrorCategory.EXTERNAL_SERVICE, code, { originalMessage: originalError?.message }),
  internal: (message: string, originalError?: Error, code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR) =>
    new ApiError(message || "Internal server error", 500, ErrorCategory.INTERNAL, code, { originalMessage: originalError?.message }),
};

export function errorHandler(err: any, req: any, res: any, _next: any) {
  try {
    const requestId = res.locals?.requestId || `req-${Date.now()}`;
    const tenant_id = res.locals?.tenantId || res.locals?.tenant_id;

    // 1. ApiError
    if (err instanceof ApiError) {
      const response: ApiErrorResponse = {
        error: err.message,
        code: err.code,
        category: err.category,
        details: config.NODE_ENV === "development" ? err.details : undefined,
        requestId,
        timestamp: new Date().toISOString(),
      };
      const metadata = { requestId, tenant_id, statusCode: err.statusCode };
      if (err.statusCode >= 500) logger.error(`[${err.category}] ${err.message}`, metadata);
      else logger.warn(`[${err.category}] ${err.message}`, metadata);
      return res.status(err.statusCode).json(response);
    }

    // 2. ZodError
    if (err instanceof z.ZodError) {
      const response: ApiErrorResponse = {
        error: "Validation failed",
        code: ErrorCode.INPUT_INVALID,
        category: ErrorCategory.VALIDATION,
        details: { errors: err.issues },
        requestId,
        timestamp: new Date().toISOString(),
      };
      logger.warn(`[${ErrorCode.INPUT_INVALID}] Zod Error`, { requestId, tenant_id, statusCode: 400 });
      return res.status(400).json(response);
    }

    // 3. Status-based errors (middleware like body-parser)
    if (err.status || err.statusCode) {
      const statusCode = err.status || err.statusCode;
      const response: ApiErrorResponse = {
        error: err.message || "Request Error",
        code: statusCode === 413 ? ErrorCode.FILE_TOO_LARGE : ErrorCode.INPUT_INVALID,
        category: ErrorCategory.VALIDATION,
        requestId,
        timestamp: new Date().toISOString(),
      };
      const metadata = { requestId, tenant_id, statusCode };
      if (statusCode >= 500) logger.error(`[INTERNAL_ERROR] ${err.message}`, metadata);
      else logger.warn(`[VALIDATION_ERROR] ${err.message}`, metadata);
      return res.status(statusCode).json(response);
    }

    // 4. Fallback unknown error
    const response: ApiErrorResponse = {
      error: config.NODE_ENV === "development" ? (err.message || "Internal Error") : "Internal server error",
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      category: ErrorCategory.INTERNAL,
      requestId,
      timestamp: new Date().toISOString(),
    };
    
    // Safely extract message and stack
    const msg = typeof err === 'string' ? err : (err?.message || "Unknown error");
    const stack = err?.stack;

    logger.error(`[INTERNAL_ERROR] ${msg}`, { requestId, tenant_id, statusCode: 500, stack });
    return res.status(500).json(response);
  } catch (criticalError) {
    console.error("EH CRITICAL FAIL:", criticalError);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export function asyncHandler(fn: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);
}
