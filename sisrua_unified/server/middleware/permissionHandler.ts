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
  | "bt_calculate"
  | "read_dg"
  | "write_dg";

/**
 * Permission matrix: Role -> Permissions
 * Define quais permissões cada papel tem
 */
const permissionsMatrix: Record<UserRole, Permission[]> = {
  admin: ["read", "write", "delete", "admin", "export_dxf", "bt_calculate", "read_dg", "write_dg"],
  technician: ["read", "write", "export_dxf", "bt_calculate", "read_dg", "write_dg"],
  viewer: ["read", "read_dg"],
  guest: [],
};

/**
 * Middleware para controle de permissões granular (RBAC).
 */
export const requirePermission = (requiredPermission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.headers["x-user-id"] as string) || res.locals.userId;
    const requestId = res.locals.requestId;

    try {
      const userRole = await getUserRole(userId);
      const userPermissions = permissionsMatrix[userRole] || [];

      const hasPermission =
        userPermissions.includes(requiredPermission) ||
        userPermissions.includes("admin");

      if (hasPermission) {
        logger.info("Permission granted", { userId, userRole, requiredPermission, requestId });
        return next();
      }

      logger.warn("Permission denied", { userId, userRole, requiredPermission, requestId, path: req.path });
      return next(createError.authorization(`Missing required permission: ${requiredPermission}`));
    } catch (err: unknown) {
      logger.error("Error checking permissions", { userId, requiredPermission, requestId, error: err instanceof Error ? err.message : String(err) });
      return next(createError.authorization("Permission check failed"));
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
  if (list.includes("READ_DESIGN_GENERATIVO")) return requirePermission("read_dg");
  if (list.includes("WRITE_DESIGN_GENERATIVO")) return requirePermission("write_dg");
  
  return requirePermission("read");
};
