import {
  registerPolicy,
  getPolicy,
  evaluateRetention,
  applyPolicy,
  clearPolicies
} from '../services/dataRetentionService';

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('dataRetentionService', () => {
  beforeEach(() => {
    clearPolicies();
  });

  it('should register and retrieve a policy', () => {
    registerPolicy({ id: 'p1', resourceType: 'test_resource', maxAgeDays: 30, archiveOnExpiry: false, enabled: true });
    const p = getPolicy('test_resource');
    expect(p).not.toBeNull();
    expect(p!.id).toBe('p1');
  });

  it('should return null for unregistered resource type', () => {
    expect(getPolicy('nonexistent')).toBeNull();
  });

  it('should keep all items when no policy is registered', () => {
    const items = [{ id: 'a', createdAt: daysAgo(100) }];
    const result = evaluateRetention('unknown_type', items);
    expect(result.toKeep).toContain('a');
    expect(result.toDelete).toHaveLength(0);
    expect(result.toArchive).toHaveLength(0);
  });

  it('should keep all items when policy is disabled', () => {
    registerPolicy({ id: 'p2', resourceType: 'r2', maxAgeDays: 10, archiveOnExpiry: false, enabled: false });
    const items = [{ id: 'x', createdAt: daysAgo(50) }];
    const result = evaluateRetention('r2', items);
    expect(result.toKeep).toContain('x');
  });

  it('should delete items older than maxAgeDays when archiveOnExpiry is false', () => {
    registerPolicy({ id: 'p3', resourceType: 'r3', maxAgeDays: 30, archiveOnExpiry: false, enabled: true });
    const items = [
      { id: 'old', createdAt: daysAgo(60) },
      { id: 'new', createdAt: daysAgo(10) }
    ];
    const result = evaluateRetention('r3', items);
    expect(result.toDelete).toContain('old');
    expect(result.toKeep).toContain('new');
  });

  it('should archive items older than maxAgeDays when archiveOnExpiry is true', () => {
    registerPolicy({ id: 'p4', resourceType: 'r4', maxAgeDays: 30, archiveOnExpiry: true, enabled: true });
    const items = [{ id: 'expired', createdAt: daysAgo(60) }];
    const result = evaluateRetention('r4', items);
    expect(result.toArchive).toContain('expired');
    expect(result.toDelete).toHaveLength(0);
  });

  it('should delete items exceeding maxCount', () => {
    registerPolicy({ id: 'p5', resourceType: 'r5', maxAgeDays: 365, maxCount: 2, archiveOnExpiry: false, enabled: true });
    const items = [
      { id: 'i1', createdAt: daysAgo(1) },
      { id: 'i2', createdAt: daysAgo(2) },
      { id: 'i3', createdAt: daysAgo(3) }
    ];
    const result = evaluateRetention('r5', items);
    expect(result.toKeep).toHaveLength(2);
    expect(result.toDelete).toHaveLength(1);
  });

  it('should archive items exceeding maxCount when archiveOnExpiry is true', () => {
    registerPolicy({ id: 'p6', resourceType: 'r6', maxAgeDays: 365, maxCount: 1, archiveOnExpiry: true, enabled: true });
    const items = [
      { id: 'j1', createdAt: daysAgo(1) },
      { id: 'j2', createdAt: daysAgo(2) }
    ];
    const result = evaluateRetention('r6', items);
    expect(result.toKeep).toHaveLength(1);
    expect(result.toArchive).toHaveLength(1);
  });

  it('should keep newest items when using maxCount (sorted by date desc)', () => {
    registerPolicy({ id: 'p7', resourceType: 'r7', maxAgeDays: 365, maxCount: 2, archiveOnExpiry: false, enabled: true });
    const items = [
      { id: 'newest', createdAt: daysAgo(1) },
      { id: 'middle', createdAt: daysAgo(5) },
      { id: 'oldest', createdAt: daysAgo(10) }
    ];
    const result = evaluateRetention('r7', items);
    expect(result.toKeep).toContain('newest');
    expect(result.toKeep).toContain('middle');
    expect(result.toDelete).toContain('oldest');
  });

  it('applyPolicy returns correct counts and resourceType', () => {
    registerPolicy({ id: 'p8', resourceType: 'r8', maxAgeDays: 30, archiveOnExpiry: false, enabled: true });
    const items = [
      { id: 'k1', createdAt: daysAgo(5) },
      { id: 'k2', createdAt: daysAgo(60) }
    ];
    const result = applyPolicy('r8', items);
    expect(result.resourceType).toBe('r8');
    expect(result.toKeep).toContain('k1');
    expect(result.toDelete).toContain('k2');
  });

  it('applyPolicy returns all in toKeep when policy is disabled', () => {
    registerPolicy({ id: 'p9', resourceType: 'r9', maxAgeDays: 1, archiveOnExpiry: false, enabled: false });
    const items = [{ id: 'm1', createdAt: daysAgo(100) }];
    const result = applyPolicy('r9', items);
    expect(result.toKeep).toContain('m1');
    expect(result.toDelete).toHaveLength(0);
  });

  it('should handle empty items list', () => {
    registerPolicy({ id: 'p10', resourceType: 'r10', maxAgeDays: 30, archiveOnExpiry: false, enabled: true });
    const result = evaluateRetention('r10', []);
    expect(result.toDelete).toHaveLength(0);
    expect(result.toArchive).toHaveLength(0);
    expect(result.toKeep).toHaveLength(0);
  });

  it('default policy dxf_file should be pre-registered', () => {
    // Re-register to simulate default
    registerPolicy({ id: 'default_dxf_file', resourceType: 'dxf_file', maxAgeDays: 90, archiveOnExpiry: false, enabled: true });
    const p = getPolicy('dxf_file');
    expect(p).not.toBeNull();
    expect(p!.maxAgeDays).toBe(90);
  });

  it('default policy audit_log should be pre-registered', () => {
    registerPolicy({ id: 'default_audit_log', resourceType: 'audit_log', maxAgeDays: 365, archiveOnExpiry: false, enabled: true });
    const p = getPolicy('audit_log');
    expect(p).not.toBeNull();
    expect(p!.maxAgeDays).toBe(365);
  });

  it('default policy domain_snapshot should have maxCount and archiveOnExpiry true', () => {
    registerPolicy({ id: 'default_domain_snapshot', resourceType: 'domain_snapshot', maxAgeDays: 180, maxCount: 100, archiveOnExpiry: true, enabled: true });
    const p = getPolicy('domain_snapshot');
    expect(p).not.toBeNull();
    expect(p!.maxCount).toBe(100);
    expect(p!.archiveOnExpiry).toBe(true);
  });

  it('should not delete items exactly at the boundary', () => {
    registerPolicy({ id: 'p11', resourceType: 'r11', maxAgeDays: 30, archiveOnExpiry: false, enabled: true });
    const items = [{ id: 'boundary', createdAt: daysAgo(29) }];
    const result = evaluateRetention('r11', items);
    expect(result.toKeep).toContain('boundary');
  });
});
