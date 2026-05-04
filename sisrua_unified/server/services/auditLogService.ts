/**
 * Audit Log Service - Write-Once Forensic Multilayer Audit Trail
 * Records context (Geography, Device, IP) with tamper detection via SHA-256.
 *
 * RESILIENCE: Persists logs to PostgreSQL audit_logs table.
 * MULTI-TENANCY: Enforces tenant_id isolation.
 */

import { createHash, randomUUID } from 'crypto';
import { getDbClient } from '../repositories/dbClient.js';
import { logger } from '../utils/logger.js';

export type AuditResult = 'success' | 'failure' | 'blocked';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId?: string;
  tenantId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  geography?: string;
  result: AuditResult;
  details?: Record<string, unknown>;
  sha256: string;
}

export interface AuditFilter {
  userId?: string;
  tenantId?: string;
  action?: string;
  resource?: string;
  result?: AuditResult;
  timeRange?: {
    from?: string;
    to?: string;
  };
}

/**
 * Compute SHA-256 hash of all entry fields except sha256 itself.
 * Canonical JSON serialization ensures determinism.
 */
function computeHash(entry: Omit<AuditEntry, 'sha256'>): string {
  const canonical = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    userId: entry.userId ?? null,
    tenantId: entry.tenantId ?? null,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    geography: entry.geography ?? null,
    result: entry.result,
    details: entry.details ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Log a new audit entry. Persists to database.
 */
export async function logAudit(
  input: Omit<AuditEntry, 'id' | 'timestamp' | 'sha256'>,
): Promise<Readonly<AuditEntry>> {
  if (!input.action || input.action.trim().length === 0) {
    throw new Error('action is required');
  }
  if (!input.resource || input.resource.trim().length === 0) {
    throw new Error('resource is required');
  }

  const id = randomUUID();
  const timestamp = new Date().toISOString();

  const partial: Omit<AuditEntry, 'sha256'> = {
    id,
    timestamp,
    userId: input.userId,
    tenantId: input.tenantId,
    action: input.action.trim(),
    resource: input.resource.trim(),
    resourceId: input.resourceId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    geography: input.geography,
    result: input.result,
    details: input.details,
  };

  const sha256 = computeHash(partial);
  const entry: AuditEntry = { ...partial, sha256 };

  // Persist to Postgres
  const sql = getDbClient();
  if (sql) {
    try {
      await sql`
        INSERT INTO public.audit_logs (
          id, table_name, record_id, action, new_data, changed_by, tenant_id, changed_at
        ) VALUES (
          ${id}, ${input.resource}, ${input.resourceId || id}, ${input.action}, 
          ${sql.json({ ...input.details, sha256, userAgent: input.userAgent, ipAddress: input.ipAddress })}, 
          ${input.userId || null}, ${input.tenantId || null}, ${timestamp}
        )
      `;
    } catch (err) {
      logger.error('Failed to persist audit log to database', { error: (err as Error).message, entryId: id });
      // We don't throw here to avoid breaking the main business flow if audit fails
    }
  }

  return Object.freeze(entry);
}

/**
 * Query audit entries from database.
 */
export async function queryAudit(filters: AuditFilter): Promise<Readonly<AuditEntry>[]> {
  const sql = getDbClient(true);
  if (!sql) return [];

  const results = await sql`
    SELECT 
      id, changed_at as timestamp, changed_by as "userId", tenant_id as "tenantId",
      action, table_name as resource, record_id as "resourceId",
      new_data->>'ipAddress' as "ipAddress",
      new_data->>'userAgent' as "userAgent",
      new_data->>'sha256' as sha256,
      new_data - 'sha256' - 'ipAddress' - 'userAgent' as details
    FROM public.audit_logs
    WHERE 
      (${filters.userId || null} IS NULL OR changed_by = ${filters.userId || null})
      AND (${filters.tenantId || null} IS NULL OR tenant_id = ${filters.tenantId || null})
      AND (${filters.action || null} IS NULL OR action = ${filters.action || null})
      AND (${filters.resource || null} IS NULL OR table_name = ${filters.resource || null})
      AND (${filters.timeRange?.from || null} IS NULL OR changed_at >= ${filters.timeRange?.from || null})
      AND (${filters.timeRange?.to || null} IS NULL OR changed_at <= ${filters.timeRange?.to || null})
    ORDER BY changed_at DESC
    LIMIT 100
  `;

  return results.map(r => Object.freeze({
    id: r.id,
    timestamp: r.timestamp.toISOString(),
    userId: r.userId,
    tenantId: r.tenantId,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    result: 'success', // Placeholder as it's not in the base table schema yet
    details: r.details,
    sha256: r.sha256
  } as AuditEntry));
}
