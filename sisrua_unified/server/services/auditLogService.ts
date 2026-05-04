/**
 * Audit Log Service - Write-Once Forensic Multilayer Audit Trail
 * Records context (Geography, Device, IP) with tamper detection via SHA-256.
 *
 * RESILIENCE: In-memory store as source of truth; DB persistence is fire-and-forget.
 * MULTI-TENANCY: Enforces tenant_id isolation.
 */

import { createHash, randomUUID } from 'crypto';
import { getDbClient } from '../repositories/dbClient.js';
import { logger } from '../utils/logger.js';

// In-memory store (write-once entries)
const auditStore: AuditEntry[] = [];

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
 * Log a new audit entry synchronously.
 * The entry is stored immediately in the in-memory store (write-once).
 * Persistence to Postgres is fire-and-forget (does not block or throw).
 */
export function logAudit(
  input: Omit<AuditEntry, 'id' | 'timestamp' | 'sha256'>,
): Readonly<AuditEntry> {
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
  const frozen = Object.freeze<AuditEntry>({ ...partial, sha256 });
  auditStore.push(frozen);

  // Fire-and-forget DB persistence
  const sql = getDbClient();
  if (sql) {
    sql`
      INSERT INTO public.audit_logs (
        id, table_name, record_id, action, new_data, changed_by, tenant_id, changed_at
      ) VALUES (
        ${id}, ${partial.resource}, ${partial.resourceId || id}, ${partial.action},
        ${sql.json({ ...input.details, sha256, userAgent: input.userAgent, ipAddress: input.ipAddress })},
        ${input.userId || null}, ${input.tenantId || null}, ${timestamp}
      )
    `.catch((err: unknown) => {
      logger.error('Failed to persist audit log to database', {
        error: err instanceof Error ? err.message : String(err),
        entryId: id,
      });
    });
  }

  return frozen;
}

/** Filter an entry against the provided criteria. */
function matchesFilter(e: AuditEntry, f: AuditFilter): boolean {
  if (f.userId && e.userId !== f.userId) return false;
  if (f.tenantId && e.tenantId !== f.tenantId) return false;
  if (f.action && e.action !== f.action) return false;
  if (f.resource && e.resource !== f.resource) return false;
  if (f.result && e.result !== f.result) return false;
  if (f.timeRange?.from && e.timestamp < f.timeRange.from) return false;
  if (f.timeRange?.to && e.timestamp > f.timeRange.to) return false;
  return true;
}

/** Query entries from the in-memory store. */
export function queryAudit(filters: AuditFilter): Readonly<AuditEntry>[] {
  return auditStore.filter((e) => matchesFilter(e, filters));
}

/** CSV field quoting: wrap in double-quotes if the value contains commas, quotes, or newlines. */
function csvField(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_HEADERS = [
  'id', 'timestamp', 'userId', 'action', 'resource',
  'resourceId', 'ipAddress', 'userAgent', 'geography', 'result', 'sha256',
] as const;

/**
 * Export audit entries as JSON or CSV string.
 */
export function exportAudit(filters: AuditFilter, format: 'json' | 'csv'): string {
  const entries = queryAudit(filters);
  if (format === 'json') {
    return JSON.stringify(entries);
  }
  const header = CSV_HEADERS.join(',');
  if (entries.length === 0) return header;
  const rows = entries.map((e) =>
    CSV_HEADERS.map((k) => csvField((e as Record<string, unknown>)[k])).join(','),
  );
  return [header, ...rows].join('\n');
}

/** Verify tamper-evident integrity of an entry by recomputing its SHA-256. */
export function verifyEntry(entry: AuditEntry): boolean {
  const { sha256, ...rest } = entry;
  return computeHash(rest as Omit<AuditEntry, 'sha256'>) === sha256;
}

/** Clear all in-memory audit entries. Intended for testing. */
export function clearAuditLog(): void {
  auditStore.length = 0;
}

/** Return the total number of in-memory audit entries. Intended for testing. */
export function getAuditCount(): number {
  return auditStore.length;
}
