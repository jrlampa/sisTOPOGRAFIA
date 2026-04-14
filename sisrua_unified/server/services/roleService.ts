import postgres from "postgres";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

export type UserRole = "admin" | "technician" | "viewer" | "guest";

interface UserRoleRecord {
  user_id: string;
  role: UserRole;
  assigned_at: string;
  last_updated: string;
}

// Initialize database connection using unified DATABASE_URL
const sql = config.DATABASE_URL
  ? postgres(config.DATABASE_URL, {
      ssl: config.NODE_ENV === "production" ? "require" : undefined,
      max: 5,
      connect_timeout: 10,
    })
  : null;

/**
 * RBAC Service
 * - Recupera papéis de usuário do banco de dados
 * - Implementa cache in-memory para performance
 * - Fornece interface confiável para permission handler
 */

// Cache in-memory com TTL (5 minutos por padrão)
const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Recupera o papel de um usuário do banco de dados
 * @param userId - ID do usuário
 * @returns UserRole do usuário ou 'guest' se não encontrado
 */
export async function getUserRole(
  userId: string | undefined,
): Promise<UserRole> {
  // Usuários sem ID são sempre guests
  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return "guest";
  }

  const normalizedUserId = userId.trim();

  // Verificar cache
  const cached = roleCache.get(normalizedUserId);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug("User role cache hit", { userId: normalizedUserId });
    return cached.role;
  }

  try {
    if (!sql) {
      logger.debug("DB not available, defaulting role to viewer", { userId: normalizedUserId });
      return "viewer";
    }
    const rows = await sql<UserRoleRecord[]>`
        `;

    if (rows && rows.length > 0) {
      const userRole = rows[0].role as UserRole;

      // Cache o resultado
      roleCache.set(normalizedUserId, {
        role: userRole,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      logger.debug("User role retrieved from database", {
        userId: normalizedUserId,
        role: userRole,
      });

      return userRole;
    }

    // Usuário não registrado no banco = viewer (read-only)
    // Não fazer cache para usuários não encontrados (deixar descoberta dinâmica)
    logger.debug("User role not found in database, defaulting to viewer", {
      userId: normalizedUserId,
    });

    return "viewer";
  } catch (err: unknown) {
    logger.error("Failed to retrieve user role", {
      userId: normalizedUserId,
      error: err instanceof Error ? err.message : String(err),
    });

    // Fallback seguro: viewer em caso de erro de banco
    return "viewer";
  }
}

/**
 * Limpar cache de papéis de usuário (para teste ou invalidação manual)
 */
export function clearRoleCache(): void {
  roleCache.clear();
  logger.info("User role cache cleared");
}

/**
 * Limpar cache específico de um usuário
 */
export function clearUserRoleCache(userId: string): void {
  roleCache.delete(userId.trim());
  logger.debug("User role cache cleared for user", { userId });
}

/**
 * Atribuir ou atualizar papel de um usuário
 * @param userId - ID do usuário
 * @param role - Novo papel
 * @param assignedBy - Quem fez a atribuição (para auditoria)
 * @param reason - Motivo da mudança
 */
export async function setUserRole(
  userId: string,
  role: UserRole,
  assignedBy: string,
  reason?: string,
): Promise<boolean> {
  if (!userId || userId.trim().length === 0) {
    logger.warn("Invalid userId for setUserRole");
    return false;
  }

  const normalizedUserId = userId.trim();

  try {
    if (!sql) {
      logger.warn("DB not available, cannot set user role");
      return false;
    }
    const rows = await sql<UserRoleRecord[]>`
            VALUES (${normalizedUserId}, ${role}, ${assignedBy.trim()}, ${reason || null})
            ON CONFLICT (user_id) DO UPDATE
            SET role = ${role}, assigned_by = ${assignedBy.trim()}, reason = ${reason || null}
            RETURNING user_id, role
        `;

    if (rows && rows.length > 0) {
      // Invalidar cache do usuário
      clearUserRoleCache(normalizedUserId);

      logger.info("User role updated", {
        userId: normalizedUserId,
        newRole: role,
        assignedBy,
        reason,
      });

      return true;
    }

    return false;
  } catch (err: unknown) {
    logger.error("Failed to set user role", {
      userId: normalizedUserId,
      role,
      error: err instanceof Error ? err.message : String(err),
    });

    return false;
  }
}

/**
 * Obter todos os usuários com um papel específico (para relatórios)
 * @param role - UserRole a filtrar
 */
export async function getUsersByRole(
  role: UserRole,
): Promise<UserRoleRecord[]> {
  try {
    if (!sql) return [];
    const rows = await sql<UserRoleRecord[]>`
            WHERE role = ${role}
            ORDER BY last_updated DESC
        `;

    return rows || [];
  } catch (err: unknown) {
    logger.error("Failed to retrieve users by role", {
      role,
      error: err instanceof Error ? err.message : String(err),
    });

    return [];
  }
}

/**
 * Obter estatísticas de distribuição de papéis
 */
export async function getRoleStatistics(): Promise<Record<UserRole, number>> {
  try {
    if (!sql) return { admin: 0, technician: 0, viewer: 0, guest: 0 };
    const rows = await sql<{ role: UserRole; count: number }[]>`
            SELECT role, COUNT(*) as count
            FROM user_roles
            WHERE role <> 'guest'::user_role
            GROUP BY role
        `;

    const stats: Record<UserRole, number> = {
      admin: 0,
      technician: 0,
      viewer: 0,
      guest: 0,
    };

    if (rows) {
      for (const row of rows) {
        stats[row.role] = row.count;
      }
    }

    return stats;
  } catch (err: unknown) {
    logger.error("Failed to retrieve role statistics", {
      error: err instanceof Error ? err.message : String(err),
    });

    return { admin: 0, technician: 0, viewer: 0, guest: 0 };
  }
}
