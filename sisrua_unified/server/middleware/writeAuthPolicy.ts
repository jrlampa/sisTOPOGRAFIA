import { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

function isMutatingMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function readTrustedIdentity(req: Request, res: Response): string | null {
  const localUserId = typeof res.locals.userId === 'string' ? res.locals.userId.trim() : '';
  if (localUserId) {
    return localUserId;
  }

  if (config.NODE_ENV !== 'production') {
    const headerUserId =
      typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'].trim() : '';
    if (headerUserId) {
      return headerUserId;
    }
  }

  return null;
}

function normalizeTenant(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requireAuthenticatedWrite(req: Request, res: Response, next: NextFunction): void {
  if (!isMutatingMethod(req.method)) {
    next();
    return;
  }

  const principal = readTrustedIdentity(req, res);
  if (!principal) {
    logger.warn('Blocked mutating request without authenticated identity', {
      path: req.path,
      method: req.method,
      requestId: res.locals.requestId,
    });
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHENTICATED_WRITE',
      message: 'Write operations require authenticated identity',
    });
    return;
  }

  res.locals.userId = principal;
  next();
}

export function enforceTenantConsistency(
  resolveTenant: (req: Request) => unknown
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const trustedTenantId = normalizeTenant(res.locals.tenantId);
    const requestTenantId = normalizeTenant(resolveTenant(req));

    if (!trustedTenantId || !requestTenantId) {
      next();
      return;
    }

    if (trustedTenantId !== requestTenantId) {
      logger.warn('Tenant mismatch blocked by route policy', {
        path: req.path,
        method: req.method,
        trustedTenantId,
        requestTenantId,
        requestId: res.locals.requestId,
      });
      res.status(403).json({
        error: 'Forbidden',
        code: 'TENANT_MISMATCH',
        message: 'Tenant mismatch between authenticated context and request payload',
      });
      return;
    }

    next();
  };
}
