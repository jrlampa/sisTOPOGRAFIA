/**
 * RoleRepository – Repository Pattern (Item 2).
 *
 * Owns all SQL against `user_roles`. TTL cache lives in roleService.ts.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "technician" | "viewer" | "guest";

export interface UserRoleRow {
  userId: string;
  role: UserRole;
  tenantId: string | null;
  assignedBy: string | null;
  reason: string | null;
  assignedAt: Date;
  lastUpdated: Date;
}

export interface IRoleRepository {
  findByUserId(userId: string): Promise<UserRoleRow | null>;
  findByRole(role: UserRole): Promise<UserRoleRow[]>;
  countByRole(): Promise<Record<UserRole, number>>;
  upsert(
    userId: string,
    role: UserRole,
    assignedBy: string,
    reason?: string,
  ): Promise<void>;
}

// ── Implementation ─────────────────────────────────────────────────────────────

export class PostgresRoleRepository implements IRoleRepository {
  async findByUserId(userId: string): Promise<UserRoleRow | null> {
    const sql = getDbClient();
    if (!sql) return null;
    try {
      const rows = await sql.unsafe(
        `SELECT user_id, role, tenant_id, assigned_by, reason, assigned_at, last_updated
         FROM user_roles WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      const r = (rows as any[])[0];
      return r ? _mapRow(r) : null;
    } catch (err) {
      logger.warn("[RoleRepository] findByUserId failed", { userId, err });
      return null;
    }
  }

  async findByRole(role: UserRole): Promise<UserRoleRow[]> {
    const sql = getDbClient();
    if (!sql) return [];
    try {
      const rows = await sql.unsafe(
        `SELECT user_id, role, tenant_id, assigned_by, reason, assigned_at, last_updated
         FROM user_roles WHERE role = $1 ORDER BY assigned_at DESC`,
        [role],
      );
      return (rows as any[]).map(_mapRow);
    } catch (err) {
      logger.warn("[RoleRepository] findByRole failed", { role, err });
      return [];
    }
  }

  async countByRole(): Promise<Record<UserRole, number>> {
    const sql = getDbClient();
    const defaults: Record<UserRole, number> = {
      admin: 0,
      technician: 0,
      viewer: 0,
      guest: 0,
    };
    if (!sql) return defaults;
    try {
      const rows = await sql.unsafe(
        `SELECT role, COUNT(*) AS cnt FROM user_roles GROUP BY role`,
      );
      const result = { ...defaults };
      for (const r of rows as any[]) {
        result[r.role as UserRole] = Number(r.cnt);
      }
      return result;
    } catch (err) {
      logger.warn("[RoleRepository] countByRole failed", { err });
      return defaults;
    }
  }

  async upsert(
    userId: string,
    role: UserRole,
    assignedBy: string,
    reason?: string,
  ): Promise<void> {
    const sql = getDbClient();
    if (!sql) return;
    try {
      await sql.unsafe(
        `INSERT INTO user_roles (user_id, role, assigned_by, reason, assigned_at, last_updated)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET role = EXCLUDED.role,
               assigned_by = EXCLUDED.assigned_by,
               reason = EXCLUDED.reason,
               last_updated = NOW()`,
        [userId, role, assignedBy, reason ?? null],
      );
    } catch (err) {
      logger.warn("[RoleRepository] upsert failed", { userId, role, err });
    }
  }
}

function _mapRow(r: any): UserRoleRow {
  return {
    userId: r.user_id,
    role: r.role as UserRole,
    tenantId: r.tenant_id ?? null,
    assignedBy: r.assigned_by ?? null,
    reason: r.reason ?? null,
    assignedAt: new Date(r.assigned_at),
    lastUpdated: new Date(r.last_updated),
  };
}

export const roleRepository: IRoleRepository = new PostgresRoleRepository();
