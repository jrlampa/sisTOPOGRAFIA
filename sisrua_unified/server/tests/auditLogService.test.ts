import {
  logAudit,
  queryAudit,
  exportAudit,
  verifyEntry,
  getAuditCount,
  clearAuditLog,
  type AuditEntry,
} from '../services/auditLogService';

describe('AuditLogService', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  // -------------------------------------------------------------------------
  // logAudit
  // -------------------------------------------------------------------------
  describe('logAudit', () => {
    it('creates an entry with id, timestamp, and sha256', () => {
      const entry = logAudit({ action: 'login', resource: 'auth', result: 'success' });
      expect(entry.id).toBeTruthy();
      expect(entry.timestamp).toBeTruthy();
      expect(entry.sha256).toBeTruthy();
      expect(entry.sha256).toHaveLength(64);
    });

    it('stores all provided optional fields', () => {
      const entry = logAudit({
        action: 'export',
        resource: 'map',
        resourceId: 'map-123',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        geography: 'SP',
        result: 'success',
        details: { format: 'dxf' },
      });
      expect(entry.userId).toBe('user-1');
      expect(entry.ipAddress).toBe('192.168.1.1');
      expect(entry.userAgent).toBe('Mozilla/5.0');
      expect(entry.geography).toBe('SP');
      expect(entry.resourceId).toBe('map-123');
      expect(entry.details).toEqual({ format: 'dxf' });
    });

    it('throws for missing action', () => {
      expect(() => logAudit({ action: '', resource: 'map', result: 'success' })).toThrow('action is required');
    });

    it('throws for missing resource', () => {
      expect(() => logAudit({ action: 'read', resource: '', result: 'success' })).toThrow('resource is required');
    });

    it('trims action and resource', () => {
      const entry = logAudit({ action: '  read  ', resource: '  map  ', result: 'success' });
      expect(entry.action).toBe('read');
      expect(entry.resource).toBe('map');
    });

    it('increments audit store count', () => {
      logAudit({ action: 'read', resource: 'data', result: 'success' });
      logAudit({ action: 'write', resource: 'data', result: 'success' });
      expect(getAuditCount()).toBe(2);
    });

    it('returned entry is frozen (write-once)', () => {
      const entry = logAudit({ action: 'read', resource: 'r', result: 'success' });
      expect(() => {
        (entry as AuditEntry).action = 'tampered';
      }).toThrow();
      expect(entry.action).toBe('read');
    });

    it('generates unique IDs for each entry', () => {
      const e1 = logAudit({ action: 'read', resource: 'r', result: 'success' });
      const e2 = logAudit({ action: 'read', resource: 'r', result: 'success' });
      expect(e1.id).not.toBe(e2.id);
    });

    it('supports all result values', () => {
      const s = logAudit({ action: 'login', resource: 'auth', result: 'success' });
      const f = logAudit({ action: 'login', resource: 'auth', result: 'failure' });
      const b = logAudit({ action: 'login', resource: 'auth', result: 'blocked' });
      expect(s.result).toBe('success');
      expect(f.result).toBe('failure');
      expect(b.result).toBe('blocked');
    });
  });

  // -------------------------------------------------------------------------
  // verifyEntry
  // -------------------------------------------------------------------------
  describe('verifyEntry', () => {
    it('verifies a freshly created entry as valid', () => {
      const entry = logAudit({ action: 'read', resource: 'data', result: 'success' });
      expect(verifyEntry(entry as AuditEntry)).toBe(true);
    });

    it('detects tampered action field', () => {
      const entry = logAudit({ action: 'read', resource: 'data', result: 'success' }) as AuditEntry;
      const tampered = { ...entry, action: 'delete' };
      expect(verifyEntry(tampered)).toBe(false);
    });

    it('detects tampered sha256 field', () => {
      const entry = logAudit({ action: 'read', resource: 'data', result: 'success' }) as AuditEntry;
      const tampered = { ...entry, sha256: 'a'.repeat(64) };
      expect(verifyEntry(tampered)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // queryAudit
  // -------------------------------------------------------------------------
  describe('queryAudit', () => {
    beforeEach(() => {
      logAudit({ action: 'login', resource: 'auth', userId: 'u1', result: 'success', geography: 'SP' });
      logAudit({ action: 'export', resource: 'map', userId: 'u2', result: 'success', geography: 'RJ' });
      logAudit({ action: 'login', resource: 'auth', userId: 'u1', result: 'failure' });
      logAudit({ action: 'delete', resource: 'project', userId: 'u3', result: 'blocked' });
    });

    it('returns all entries with empty filter', () => {
      expect(queryAudit({})).toHaveLength(4);
    });

    it('filters by userId', () => {
      const results = queryAudit({ userId: 'u1' });
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.userId === 'u1')).toBe(true);
    });

    it('filters by action', () => {
      const results = queryAudit({ action: 'login' });
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.action === 'login')).toBe(true);
    });

    it('filters by resource', () => {
      const results = queryAudit({ resource: 'auth' });
      expect(results).toHaveLength(2);
    });

    it('filters by result', () => {
      const failures = queryAudit({ result: 'failure' });
      expect(failures).toHaveLength(1);
      const blocked = queryAudit({ result: 'blocked' });
      expect(blocked).toHaveLength(1);
    });

    it('filters by timeRange.from', () => {
      const from = new Date(Date.now() - 1000).toISOString();
      const results = queryAudit({ timeRange: { from } });
      expect(results).toHaveLength(4);
    });

    it('filters by timeRange.to excludes future entries', () => {
      const past = new Date(Date.now() - 10000).toISOString();
      const results = queryAudit({ timeRange: { to: past } });
      expect(results).toHaveLength(0);
    });

    it('combines multiple filters', () => {
      const results = queryAudit({ userId: 'u1', action: 'login', result: 'failure' });
      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('u1');
      expect(results[0].result).toBe('failure');
    });

    it('returns empty array when no match', () => {
      expect(queryAudit({ userId: 'nonexistent' })).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // exportAudit
  // -------------------------------------------------------------------------
  describe('exportAudit', () => {
    beforeEach(() => {
      logAudit({ action: 'login', resource: 'auth', userId: 'u1', result: 'success', ipAddress: '10.0.0.1' });
      logAudit({ action: 'export', resource: 'map', userId: 'u2', result: 'failure' });
    });

    it('exports JSON with all entries', () => {
      const json = exportAudit({}, 'json');
      const parsed = JSON.parse(json) as AuditEntry[];
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toHaveProperty('sha256');
    });

    it('exports filtered JSON', () => {
      const json = exportAudit({ userId: 'u1' }, 'json');
      const parsed = JSON.parse(json) as AuditEntry[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].userId).toBe('u1');
    });

    it('exports CSV with header row', () => {
      const csv = exportAudit({}, 'csv');
      const lines = csv.split('\n');
      expect(lines[0]).toContain('id,timestamp,userId,action,resource');
      expect(lines.length).toBe(3); // header + 2 data rows
    });

    it('CSV contains sha256 column', () => {
      const csv = exportAudit({}, 'csv');
      const header = csv.split('\n')[0];
      expect(header).toContain('sha256');
    });

    it('exports empty CSV with only headers for empty filter', () => {
      clearAuditLog();
      const csv = exportAudit({}, 'csv');
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1); // only header
    });

    it('CSV handles commas in values by quoting', () => {
      clearAuditLog();
      logAudit({
        action: 'read',
        resource: 'data',
        result: 'success',
        userAgent: 'Mozilla/5.0 (Windows, NT)',
      });
      const csv = exportAudit({}, 'csv');
      expect(csv).toContain('"Mozilla/5.0 (Windows, NT)"');
    });
  });
});
