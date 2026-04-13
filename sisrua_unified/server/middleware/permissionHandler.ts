import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { createError } from "../errorHandler.js";
import { getUserRole, type UserRole } from "../services/roleService.js";

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
    const userId = (req.headers["x-user-id"] as string) || res.locals.userId;
    const requestId = res.locals.requestId;

    try {
      // Recuperar papel do usuário de fonte confiável (banco de dados com cache)
      const userRole = await getUserRole(userId);

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
