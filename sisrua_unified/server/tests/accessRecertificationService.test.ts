import {
  issueRoleAssignment,
  listExpiredAssignments,
  listPendingRecertification,
  revokeExpiredAssignments,
  certifyAssignment,
  getAssignment,
  listAllAssignments,
  listActiveAssignmentsForUser,
  clearAllAssignments,
  type RoleAssignment,
} from '../services/accessRecertificationService';

describe('AccessRecertificationService', () => {
  beforeEach(() => {
    clearAllAssignments();
  });

  // -------------------------------------------------------------------------
  // issueRoleAssignment
  // -------------------------------------------------------------------------
  describe('issueRoleAssignment', () => {
    it('creates an assignment with correct fields', () => {
      const a = issueRoleAssignment('user-1', 'admin');
      expect(a.id).toBeTruthy();
      expect(a.userId).toBe('user-1');
      expect(a.role).toBe('admin');
      expect(a.revoked).toBe(false);
      expect(a.assignedAt).toBeInstanceOf(Date);
      expect(a.expiresAt).toBeInstanceOf(Date);
    });

    it('default validity is 90 days', () => {
      const before = Date.now();
      const a = issueRoleAssignment('user-1', 'viewer');
      const after = Date.now();
      const expectedMs = 90 * 24 * 60 * 60 * 1000;
      expect(a.expiresAt.getTime() - a.assignedAt.getTime()).toBeCloseTo(expectedMs, -3);
      expect(a.expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
      expect(a.expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
    });

    it('respects custom validDays', () => {
      const a = issueRoleAssignment('user-2', 'technician', 30);
      const expected = 30 * 24 * 60 * 60 * 1000;
      expect(a.expiresAt.getTime() - a.assignedAt.getTime()).toBeCloseTo(expected, -3);
    });

    it('trims whitespace from userId and role', () => {
      const a = issueRoleAssignment('  user-3  ', '  admin  ');
      expect(a.userId).toBe('user-3');
      expect(a.role).toBe('admin');
    });

    it('throws for empty userId', () => {
      expect(() => issueRoleAssignment('', 'admin')).toThrow('userId is required');
    });

    it('throws for empty role', () => {
      expect(() => issueRoleAssignment('user-1', '')).toThrow('role is required');
    });

    it('throws for non-positive validDays', () => {
      expect(() => issueRoleAssignment('user-1', 'admin', 0)).toThrow('validDays must be a positive number');
    });

    it('generates unique IDs for each assignment', () => {
      const a1 = issueRoleAssignment('user-1', 'admin');
      const a2 = issueRoleAssignment('user-1', 'admin');
      expect(a1.id).not.toBe(a2.id);
    });
  });

  // -------------------------------------------------------------------------
  // listExpiredAssignments
  // -------------------------------------------------------------------------
  describe('listExpiredAssignments', () => {
    it('returns empty array when no assignments exist', () => {
      expect(listExpiredAssignments()).toEqual([]);
    });

    it('returns expired assignments', () => {
      const a = issueRoleAssignment('user-1', 'viewer', 1);
      // Manually set expiry in the past
      const past = new Date(Date.now() - 1000);
      const assignment = getAssignment(a.id)!;
      (assignment as RoleAssignment).expiresAt = past;

      const expired = listExpiredAssignments();
      expect(expired.some((e) => e.id === a.id)).toBe(true);
    });

    it('does not return non-expired assignments', () => {
      issueRoleAssignment('user-2', 'admin', 90);
      expect(listExpiredAssignments()).toHaveLength(0);
    });

    it('does not return revoked assignments', () => {
      const a = issueRoleAssignment('user-1', 'viewer', 1);
      const assignment = getAssignment(a.id)!;
      (assignment as RoleAssignment).expiresAt = new Date(Date.now() - 1000);
      revokeExpiredAssignments();
      expect(listExpiredAssignments()).toHaveLength(0);
    });

    it('uses custom cutoffDate', () => {
      const a = issueRoleAssignment('user-1', 'viewer', 5);
      // Far-future cutoff: everything appears expired
      const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const expired = listExpiredAssignments(future);
      expect(expired.some((e) => e.id === a.id)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // listPendingRecertification
  // -------------------------------------------------------------------------
  describe('listPendingRecertification', () => {
    it('returns assignments expiring within warning window', () => {
      const a = issueRoleAssignment('user-1', 'admin', 7); // expires in 7 days
      const pending = listPendingRecertification(14);
      expect(pending.some((p) => p.id === a.id)).toBe(true);
    });

    it('does not return assignments expiring beyond window', () => {
      issueRoleAssignment('user-2', 'admin', 30); // expires in 30 days
      const pending = listPendingRecertification(14);
      expect(pending).toHaveLength(0);
    });

    it('does not return already-expired assignments', () => {
      const a = issueRoleAssignment('user-1', 'viewer', 1);
      (getAssignment(a.id) as RoleAssignment).expiresAt = new Date(Date.now() - 1000);
      const pending = listPendingRecertification(14);
      expect(pending.some((p) => p.id === a.id)).toBe(false);
    });

    it('default warning window is 14 days', () => {
      const a = issueRoleAssignment('user-1', 'admin', 10);
      expect(listPendingRecertification().some((p) => p.id === a.id)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // revokeExpiredAssignments
  // -------------------------------------------------------------------------
  describe('revokeExpiredAssignments', () => {
    it('revokes expired assignments and returns count', () => {
      const a1 = issueRoleAssignment('user-1', 'viewer', 1);
      const a2 = issueRoleAssignment('user-2', 'admin', 1);
      issueRoleAssignment('user-3', 'technician', 90); // not expired

      // Set first two as expired
      (getAssignment(a1.id) as RoleAssignment).expiresAt = new Date(Date.now() - 1000);
      (getAssignment(a2.id) as RoleAssignment).expiresAt = new Date(Date.now() - 1000);

      const count = revokeExpiredAssignments();
      expect(count).toBe(2);
      expect(getAssignment(a1.id)!.revoked).toBe(true);
      expect(getAssignment(a2.id)!.revoked).toBe(true);
    });

    it('returns 0 when nothing is expired', () => {
      issueRoleAssignment('user-1', 'admin', 90);
      expect(revokeExpiredAssignments()).toBe(0);
    });

    it('does not double-revoke already revoked assignments', () => {
      const a = issueRoleAssignment('user-1', 'viewer', 1);
      (getAssignment(a.id) as RoleAssignment).expiresAt = new Date(Date.now() - 1000);
      revokeExpiredAssignments();
      const count = revokeExpiredAssignments();
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // certifyAssignment
  // -------------------------------------------------------------------------
  describe('certifyAssignment', () => {
    it('extends expiry and records certifiedBy and certifiedAt', () => {
      const a = issueRoleAssignment('user-1', 'admin', 90);
      const before = Date.now();
      const certified = certifyAssignment(a.id, 'manager-1');
      expect(certified.certifiedBy).toBe('manager-1');
      expect(certified.certifiedAt).toBeInstanceOf(Date);
      expect(certified.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 90 * 24 * 60 * 60 * 1000 - 1000,
      );
    });

    it('allows custom extension period', () => {
      const a = issueRoleAssignment('user-1', 'viewer', 10);
      certifyAssignment(a.id, 'manager-1', 180);
      const updated = getAssignment(a.id)!;
      const expectedMs = 180 * 24 * 60 * 60 * 1000;
      expect(updated.expiresAt.getTime() - Date.now()).toBeCloseTo(expectedMs, -4);
    });

    it('throws for unknown assignment id', () => {
      expect(() => certifyAssignment('nonexistent-id', 'manager')).toThrow('Assignment not found');
    });

    it('throws for revoked assignment', () => {
      const a = issueRoleAssignment('user-1', 'admin', 1);
      (getAssignment(a.id) as RoleAssignment).expiresAt = new Date(Date.now() - 1000);
      revokeExpiredAssignments();
      expect(() => certifyAssignment(a.id, 'manager')).toThrow('Cannot certify a revoked assignment');
    });

    it('throws for empty certifiedBy', () => {
      const a = issueRoleAssignment('user-1', 'admin', 90);
      expect(() => certifyAssignment(a.id, '')).toThrow('certifiedBy is required');
    });
  });

  // -------------------------------------------------------------------------
  // listActiveAssignmentsForUser
  // -------------------------------------------------------------------------
  describe('listActiveAssignmentsForUser', () => {
    it('returns only active assignments for a user', () => {
      issueRoleAssignment('user-1', 'admin', 90);
      issueRoleAssignment('user-1', 'viewer', 90);
      const expired = issueRoleAssignment('user-1', 'technician', 1);
      (getAssignment(expired.id) as RoleAssignment).expiresAt = new Date(Date.now() - 1000);

      const active = listActiveAssignmentsForUser('user-1');
      expect(active).toHaveLength(2);
      expect(active.every((a) => a.role !== 'technician')).toBe(true);
    });

    it('returns empty array for user with no assignments', () => {
      expect(listActiveAssignmentsForUser('no-user')).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // listAllAssignments
  // -------------------------------------------------------------------------
  describe('listAllAssignments', () => {
    it('returns all assignments regardless of status', () => {
      issueRoleAssignment('user-1', 'admin');
      issueRoleAssignment('user-2', 'viewer');
      expect(listAllAssignments()).toHaveLength(2);
    });

    it('returns empty array when store is empty', () => {
      expect(listAllAssignments()).toEqual([]);
    });
  });
});
