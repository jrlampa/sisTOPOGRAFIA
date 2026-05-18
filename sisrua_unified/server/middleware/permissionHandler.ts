import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { createError } from '../errorHandler.js';
import { config } from '../config.js';
import { getUserRole, type UserRole } from '../services/roleService.js';

export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'export_dxf'
  | 'bt_calculate'
  | 'read_dg'
  | 'write_dg';

/**
 * Permission matrix: Role -> Permissions
 * Define quais permissões cada papel tem
 */
const permissionsMatrix: Record<UserRole, Permission[]> = {
  admin: ['read', 'write', 'delete', 'admin', 'export_dxf', 'bt_calculate', 'read_dg', 'write_dg'],
  technician: ['read', 'write', 'export_dxf', 'bt_calculate', 'read_dg', 'write_dg'],
  viewer: ['read', 'read_dg'],
  guest: [],
};

function normalizeTenantCandidate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRoleClaim(value: unknown): UserRole | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'admin' ||
    normalized === 'technician' ||
    normalized === 'viewer' ||
    normalized === 'guest'
  ) {
    return normalized;
  }

  if (
    normalized === 'superadmin' ||
    normalized === 'service_role' ||
    normalized === 'supabase_admin'
  ) {
    return 'admin';
  }

  return null;
}

/**
 * Middleware para controle de permissões granular (RBAC).
 */
export const requirePermission = (requiredPermission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const localUserId = typeof res.locals.userId === 'string' ? res.locals.userId.trim() : '';
    const headerUserId =
      typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'].trim() : '';
    const canTrustHeaderIdentity = config.NODE_ENV !== 'production';
    const userId = localUserId || (canTrustHeaderIdentity ? headerUserId : '') || undefined;
    const requestId = res.locals.requestId;
    const trustedTenantId = normalizeTenantCandidate(res.locals.tenantId);
    const requestedTenantId =
      normalizeTenantCandidate(req.headers['x-tenant-id']) ||
      normalizeTenantCandidate(req.headers['x-projeto-id']);
    const supabaseRoleClaim = normalizeRoleClaim(res.locals.supabaseRoleClaim);

    if (localUserId && headerUserId && localUserId !== headerUserId) {
      logger.warn('User identity mismatch between trusted context and header', {
        requestId,
        path: req.path,
        localUserId,
        headerUserId,
      });
    }

    if (!localUserId && headerUserId && !canTrustHeaderIdentity) {
      logger.warn('Ignoring client-provided x-user-id in production', {
        requestId,
        path: req.path,
        headerUserId,
      });
    }

    if (trustedTenantId && requestedTenantId && trustedTenantId !== requestedTenantId) {
      logger.warn('Tenant mismatch between trusted JWT claim and request header', {
        requestId,
        path: req.path,
        trustedTenantId,
        requestedTenantId,
      });
      return next(createError.authorization('Tenant mismatch'));
    }

    if (!userId) {
      logger.warn('Unauthenticated access attempt to restricted resource', {
        requestId,
        path: req.path,
      });
      return next(createError.authentication('Authentication required'));
    }

    try {
      const userContext = await getUserRole(userId);
      const userRole =
        userContext.role === 'viewer' && supabaseRoleClaim ? supabaseRoleClaim : userContext.role;
      const tenantId = trustedTenantId || userContext.tenantId;

      // Propaga o tenantId para os repositórios através do res.locals
      res.locals.userId = userId;
      res.locals.userRole = userRole;
      res.locals.tenantId = tenantId;

      const userPermissions = permissionsMatrix[userRole] || [];

      const hasPermission =
        userPermissions.includes(requiredPermission) || userPermissions.includes('admin');

      if (hasPermission) {
        logger.info('Permission granted', {
          userId,
          userRole,
          requiredPermission,
          requestId,
        });
        return next();
      }

      const errorMessage = `Missing required permission: ${requiredPermission}`;
      logger.warn('Permission denied', {
        userId,
        userRole,
        requiredPermission,
        requestId,
        path: req.path,
      });
      return next(createError.authorization(errorMessage));
    } catch (err: unknown) {
      logger.error('Error checking permissions', {
        userId,
        requiredPermission,
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return next(createError.authorization('Permission check failed'));
    }
  };
};

/**
 * Alias de compatibilidade: aceita uma lista de permissões customizadas (strings).
 * Correção: mapeia permissões de negócio DG reais se informadas.
 */
export const permissionHandler = (permissions: string | string[]) => {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  // Tenta encontrar uma permissão DG correspondente
  if (list.includes('READ_DESIGN_GENERATIVO')) return requirePermission('read_dg');
  if (list.includes('WRITE_DESIGN_GENERATIVO')) return requirePermission('write_dg');

  return requirePermission('read');
};
