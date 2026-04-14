import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { createError } from "../errorHandler.js";
import { getUserRole, type UserRole } from "../services/roleService.js";
import { config } from "../config.js";

export type Permission =
  | "read"
  | "write"
  | "delete"
  | "admin"
  | "export_dxf"
  | "bt_calculate";

/**
 * Permission matrix: Role -> Permissions
 * Define quais permissões cada papel tem
 */
const permissionsMatrix: Record<UserRole, Permission[]> = {
  admin: ["read", "write", "delete", "admin", "export_dxf", "bt_calculate"],
  technician: ["read", "write", "export_dxf", "bt_calculate"],
  viewer: ["read"],
  guest: [],
};

/**
 * Middleware para controle de permissões granular (RBAC).
 * Recupera papel do usuário do banco de dados e valida permissão contra matriz.
 *
 * Fluxo:
 * 1. Extrair userId de headers/locals
 * 2. Consultar roleService para obter papel do usuário (com cache)
 * 3. Resolver permissões baseadas no papel
 * 4. Validar permissão solicitada
 * 5. Log de sucesso/falha
 */
export const requirePermission = (requiredPermission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const headerUserId = req.headers["x-user-id"] as string | undefined;
    let userId = headerUserId || (res.locals.userId as string | undefined);
    const requestId = res.locals.requestId;

    try {
      const hostname = (req.hostname || "").toLowerCase();
      const requestIp = (req.ip || "").toLowerCase();
      const isLoopbackHost =
        hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
      const isLoopbackIp =
        requestIp === "::1" ||
        requestIp === "127.0.0.1" ||
        requestIp === "::ffff:127.0.0.1";
      // O frontend envia 'x-user-id: system-admin' quando em localhost.
      // O fallback também deve ser aplicado para esse userId sentinel,
      // evitando dependência de banco em ambiente de desenvolvimento local.
      const isLocalAdminSentinel =
        (userId?.trim() ?? "") === "system-admin";
      const shouldApplyLocalFallback =
        config.NODE_ENV !== "production" &&
        (!userId || userId.trim().length === 0 || isLocalAdminSentinel) &&
        (isLoopbackHost || isLoopbackIp);

      let userRole: UserRole;
      if (shouldApplyLocalFallback) {
        userId = "system-admin";
        userRole = "admin";
        logger.warn("Applying local RBAC fallback user", {
          userId,
          userRole,
          requestId,
          path: req.path,
          hostname,
          requestIp,
        });
      } else {
        // Recuperar papel do usuário de fonte confiável (banco de dados com cache)
        userRole = await getUserRole(userId);
      }

      // Resolver permissões para este papel
      const userPermissions = permissionsMatrix[userRole] || [];

      // Validar se o usuário possui a permissão requerida
      const hasPermission =
        userPermissions.includes(requiredPermission) ||
        userPermissions.includes("admin");

      if (hasPermission) {
        logger.info("Permission granted", {
          userId,
          userRole,
          requiredPermission,
          requestId,
        });
        return next();
      }

      // Permissão negada
      logger.warn("Permission denied", {
        userId,
        userRole,
        requiredPermission,
        requestId,
        path: req.path,
      });

      return next(
        createError.authorization(
          `Missing required permission: ${requiredPermission}`,
          {
            required: requiredPermission,
            provided: userRole,
            userPermissions,
          },
        ),
      );
    } catch (err: unknown) {
      logger.error("Error checking permissions", {
        userId,
        requiredPermission,
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });

      // Fallback seguro: negar em caso de erro interno
      return next(
        createError.authorization("Permission check failed", {
          reason: "internal_error",
        }),
      );
    }
  };
};
