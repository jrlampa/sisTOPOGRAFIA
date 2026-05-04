import { logger } from "../utils/logger.js";
import { getDbClient } from "../repositories/dbClient.js";
import { onRoleChange } from "./cacheService.js";

export type UserRole = "admin" | "technician" | "viewer" | "guest";

export interface UserContext {
  role: UserRole;
  tenantId: string | null;
}

interface UserRoleRecord {
  user_id: string;
  role: UserRole;
  tenant_id: string | null;
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
const roleCache = new Map<string, { context: UserContext; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Recupera o contexto de um usuário (papel e tenant) do banco de dados.
 * Retorna 'guest' para IDs inválidos e 'viewer' com tenant nulo quando o DB não está disponível.
 */
export async function getUserRole(
  userId: string | undefined,
): Promise<UserContext> {
  const defaultContext: UserContext = { role: "viewer", tenantId: null };

  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return { role: "guest", tenantId: null };
  }

  const normalizedUserId = userId.trim();

  // Verificar cache
  const cached = roleCache.get(normalizedUserId);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug("User context cache hit", { userId: normalizedUserId });
    return cached.context;
  }

  try {
    const sql = getDbClient();
    if (!sql) {
      logger.debug("DB não disponível, contexto padrão: viewer", {
        userId: normalizedUserId,
      });
      return defaultContext;
    }
    const rows = await sql<any[]>`
      SELECT role, tenant_id
      FROM user_roles
      WHERE user_id = ${normalizedUserId}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (rows && rows.length > 0) {
      const context: UserContext = {
        role: rows[0].role as UserRole,
        tenantId: rows[0].tenant_id ?? null,
      };

      roleCache.set(normalizedUserId, {
        context,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      logger.debug("Contexto de usuário recuperado do banco", {
        userId: normalizedUserId,
        role: context.role,
        tenantId: context.tenantId,
      });

      return context;
    }

    logger.debug("Contexto de usuário não encontrado, padrão: viewer", {
      userId: normalizedUserId,
    });

    return defaultContext;
  } catch (err: unknown) {
    logger.error("Falha ao recuperar contexto de usuário", {
      userId: normalizedUserId,
      error: err instanceof Error ? err.message : String(err),
    });

    return defaultContext;
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
  tenantId?: string | null,
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
      INSERT INTO user_roles (user_id, role, tenant_id, assigned_by, reason)
      VALUES (${normalizedUserId}, ${role}, ${tenantId ?? null}, ${normalizedAssignedBy}, ${reason ?? null})
      ON CONFLICT (user_id) DO UPDATE
        SET role        = ${role},
            tenant_id   = COALESCE(EXCLUDED.tenant_id, user_roles.tenant_id),
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
      SELECT user_id, role, tenant_id, assigned_at, last_updated
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
