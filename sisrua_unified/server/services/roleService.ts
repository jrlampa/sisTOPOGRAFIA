import { logger } from "../utils/logger.js";
import { getDbClient } from "../repositories/dbClient.js";
import { onRoleChange } from "./cacheService.js";

export type UserRole = "admin" | "technician" | "viewer" | "guest";

interface UserRoleRecord {
  user_id: string;
  role: UserRole;
  assigned_at: string;
  last_updated: string;
}

interface UserRoleUpsertResult {
  user_id: string;
  role: UserRole;
}

/**
 * Serviço RBAC — Gestão de papéis de usuários.
 *
 * - Recupera papéis de usuário do banco de dados via pool compartilhado (dbClient).
 * - Implementa cache in-memory com TTL para reduzir latência.
 * - Fornece interface confiável para o permissionHandler e o painel admin.
 */

// Cache in-memory com TTL (5 minutos por padrão)
const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Recupera o papel de um usuário do banco de dados.
 * Retorna 'guest' para IDs inválidos e 'viewer' quando o DB não está disponível.
 */
export async function getUserRole(
  userId: string | undefined,
): Promise<UserRole> {
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
    const sql = getDbClient();
    if (!sql) {
      logger.debug("DB não disponível, papel padrão: viewer", {
        userId: normalizedUserId,
      });
      return "viewer";
    }
    const rows = await sql<UserRoleRecord[]>`
      SELECT user_id, role, assigned_at, last_updated
      FROM user_roles
      WHERE user_id = ${normalizedUserId}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (rows && rows.length > 0) {
      const userRole = rows[0].role as UserRole;

      roleCache.set(normalizedUserId, {
        role: userRole,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      logger.debug("Papel de usuário recuperado do banco", {
        userId: normalizedUserId,
        role: userRole,
      });

      return userRole;
    }

    logger.debug("Papel de usuário não encontrado, padrão: viewer", {
      userId: normalizedUserId,
    });

    return "viewer";
  } catch (err: unknown) {
    logger.error("Falha ao recuperar papel de usuário", {
      userId: normalizedUserId,
      error: err instanceof Error ? err.message : String(err),
    });

    return "viewer";
  }
}

/** Limpa todo o cache de papéis de usuário. */
export function clearRoleCache(): void {
  roleCache.clear();
  logger.info("Cache de papéis de usuário limpo");
}

/** Limpa o cache de um usuário específico. */
export function clearUserRoleCache(userId: string): void {
  roleCache.delete(userId.trim());
  logger.debug("Cache de papel limpo para usuário", { userId });
}

/**
 * Atribui ou atualiza o papel de um usuário (upsert).
 */
export async function setUserRole(
  userId: string,
  role: UserRole,
  assignedBy: string,
  reason?: string,
): Promise<boolean> {
  if (!userId || userId.trim().length === 0) {
    logger.warn("userId inválido em setUserRole");
    return false;
  }
  if (!assignedBy || assignedBy.trim().length === 0) {
    logger.warn("assignedBy inválido em setUserRole");
    return false;
  }

  const normalizedUserId = userId.trim();
  const normalizedAssignedBy = assignedBy.trim();

  try {
    const sql = getDbClient();
    if (!sql) {
      logger.warn("DB não disponível, não é possível atribuir papel");
      return false;
    }
    const rows = await sql<UserRoleUpsertResult[]>`
      INSERT INTO user_roles (user_id, role, assigned_by, reason)
      VALUES (${normalizedUserId}, ${role}, ${normalizedAssignedBy}, ${reason ?? null})
      ON CONFLICT (user_id) DO UPDATE
        SET role        = ${role},
            assigned_by = ${normalizedAssignedBy},
            reason      = ${reason ?? null}
      RETURNING user_id, role
    `;

    if (rows && rows.length > 0) {
      clearUserRoleCache(normalizedUserId);

      // Invalidação proativa de cache sensível a permissões após mudança de papel.
      try {
        onRoleChange(normalizedUserId);
      } catch (cacheErr: unknown) {
        logger.warn("Falha ao invalidar cache após mudança de papel", {
          userId: normalizedUserId,
          error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
        });
      }

      logger.info("Papel de usuário atualizado", {
        userId: normalizedUserId,
        newRole: role,
        assignedBy: normalizedAssignedBy,
        reason,
      });

      return true;
    }

    return false;
  } catch (err: unknown) {
    logger.error("Falha ao atribuir papel de usuário", {
      userId: normalizedUserId,
      role,
      error: err instanceof Error ? err.message : String(err),
    });

    return false;
  }
}

/**
 * Obtém todos os usuários com um papel específico.
 */
export async function getUsersByRole(
  role: UserRole,
): Promise<UserRoleRecord[]> {
  try {
    const sql = getDbClient();
    if (!sql) return [];
    const rows = await sql<UserRoleRecord[]>`
      SELECT user_id, role, assigned_at, last_updated
      FROM user_roles
      WHERE role = ${role}
        AND deleted_at IS NULL
      ORDER BY last_updated DESC
    `;

    return rows ?? [];
  } catch (err: unknown) {
    logger.error("Falha ao listar usuários por papel", {
      role,
      error: err instanceof Error ? err.message : String(err),
    });

    return [];
  }
}

/**
 * Obtém estatísticas de distribuição de papéis.
 */
export async function getRoleStatistics(): Promise<Record<UserRole, number>> {
  const empty: Record<UserRole, number> = {
    admin: 0,
    technician: 0,
    viewer: 0,
    guest: 0,
  };
  try {
    const sql = getDbClient();
    if (!sql) return empty;
    const rows = await sql<{ role: UserRole; count: string }[]>`
      SELECT role, COUNT(*) AS count
      FROM user_roles
      WHERE role <> 'guest'::user_role
        AND deleted_at IS NULL
      GROUP BY role
    `;

    if (rows) {
      for (const row of rows) {
        empty[row.role] = Number(row.count);
      }
    }

    return empty;
  } catch (err: unknown) {
    logger.error("Falha ao recuperar estatísticas de papéis", {
      error: err instanceof Error ? err.message : String(err),
    });

    return empty;
  }
}
