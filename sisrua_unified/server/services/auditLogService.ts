/**
 * Audit Log Service - Write-Once Forensic Multilayer Audit Trail
 * Records context (Geography, Device, IP) with tamper detection via SHA-256.
 */

import { createHash, randomUUID } from 'crypto';

export type AuditResult = 'success' | 'failure' | 'blocked';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId?: string;
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
  action?: string;
  resource?: string;
  result?: AuditResult;
  timeRange?: {
    from?: string;
    to?: string;
  };
}

// Write-once in-memory store
const auditStore = new Map<string, Readonly<AuditEntry>>();

/**
 * Compute SHA-256 hash of all entry fields except sha256 itself.
 * Canonical JSON serialization ensures determinism.
 */
function computeHash(entry: Omit<AuditEntry, 'sha256'>): string {
  const canonical = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    userId: entry.userId ?? null,
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
 * Log a new audit entry. Returns the created entry (read-only).
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

  // Freeze object to enforce write-once semantics
  const frozen = Object.freeze(entry);
  auditStore.set(id, frozen);

  return frozen;
}

/**
 * Verify the integrity of an audit entry by recomputing its SHA-256 hash.
 */
export function verifyEntry(entry: AuditEntry): boolean {
  const { sha256, ...rest } = entry;
  return computeHash(rest) === sha256;
}

/**
 * Query audit entries by filter criteria.
 */
export function queryAudit(filters: AuditFilter): Readonly<AuditEntry>[] {
  let results = Array.from(auditStore.values());

  if (filters.userId !== undefined) {
    results = results.filter((e) => e.userId === filters.userId);
  }

  if (filters.action !== undefined) {
    results = results.filter((e) => e.action === filters.action);
  }

  if (filters.resource !== undefined) {
    results = results.filter((e) => e.resource === filters.resource);
  }

  if (filters.result !== undefined) {
    results = results.filter((e) => e.result === filters.result);
  }

  if (filters.timeRange?.from !== undefined) {
    const from = filters.timeRange.from;
    results = results.filter((e) => e.timestamp >= from);
  }

  if (filters.timeRange?.to !== undefined) {
    const to = filters.timeRange.to;
    results = results.filter((e) => e.timestamp <= to);
  }

  return results;
}

/**
 * Export audit entries in JSON or CSV format (SIEM-compatible).
 */
export function exportAudit(filters: AuditFilter, format: 'json' | 'csv'): string {
  const entries = queryAudit(filters);

  if (format === 'json') {
    return JSON.stringify(entries, null, 2);
  }

  // CSV format
  const headers = [
    'id',
    'timestamp',
    'userId',
    'action',
    'resource',
    'resourceId',
    'ipAddress',
    'userAgent',
    'geography',
    'result',
    'sha256',
  ];

  const escapeCsv = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = entries.map((e) =>
    headers.map((h) => escapeCsv(e[h as keyof AuditEntry])).join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Get audit store size (number of entries).
 */
export function getAuditCount(): number {
  return auditStore.size;
}

/**
 * Clear all audit entries (for testing only - not exposed in production use).
 */
export function clearAuditLog(): void {
  auditStore.clear();
}
