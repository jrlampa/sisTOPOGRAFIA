/**
 * Access Recertification Service
 * Tracks role assignments with timestamps and supports periodic privilege review.
 */

import { randomUUID } from 'crypto';

export interface RoleAssignment {
  id: string;
  userId: string;
  role: string;
  assignedAt: Date;
  expiresAt: Date;
  certifiedBy?: string;
  certifiedAt?: Date;
  revoked: boolean;
}

// Default validity period: 90 days
const DEFAULT_VALID_DAYS = 90;
// Default warning window before expiry: 14 days
const DEFAULT_WARNING_DAYS = 14;

// In-memory store for role assignments
const assignments = new Map<string, RoleAssignment>();

/**
 * Issue a new role assignment for a user.
 * @param userId - The user ID receiving the role
 * @param role - The role being assigned
 * @param validDays - How many days until the assignment expires (default: 90)
 */
export function issueRoleAssignment(
  userId: string,
  role: string,
  validDays: number = DEFAULT_VALID_DAYS,
): RoleAssignment {
  if (!userId || userId.trim().length === 0) {
    throw new Error('userId is required');
  }
  if (!role || role.trim().length === 0) {
    throw new Error('role is required');
  }
  if (validDays <= 0) {
    throw new Error('validDays must be a positive number');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

  const assignment: RoleAssignment = {
    id: randomUUID(),
    userId: userId.trim(),
    role: role.trim(),
    assignedAt: now,
    expiresAt,
    revoked: false,
  };

  assignments.set(assignment.id, assignment);
  return assignment;
}

/**
 * List assignments that have already expired (expiresAt <= cutoffDate).
 * Only non-revoked assignments are returned.
 * @param cutoffDate - Date to compare against (default: now)
 */
export function listExpiredAssignments(cutoffDate?: Date): RoleAssignment[] {
  const cutoff = cutoffDate ?? new Date();
  return Array.from(assignments.values()).filter(
    (a) => !a.revoked && a.expiresAt <= cutoff,
  );
}

/**
 * List assignments that are expiring soon (within warningDays).
 * Only non-revoked, non-expired assignments are returned.
 * @param warningDays - Window in days before expiry to warn (default: 14)
 */
export function listPendingRecertification(warningDays: number = DEFAULT_WARNING_DAYS): RoleAssignment[] {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);
  return Array.from(assignments.values()).filter(
    (a) => !a.revoked && a.expiresAt > now && a.expiresAt <= windowEnd,
  );
}

/**
 * Revoke all expired assignments.
 * @returns Number of assignments revoked
 */
export function revokeExpiredAssignments(): number {
  const now = new Date();
  let count = 0;
  for (const assignment of assignments.values()) {
    if (!assignment.revoked && assignment.expiresAt <= now) {
      assignment.revoked = true;
      count++;
    }
  }
  return count;
}

/**
 * Certify (extend) an existing assignment.
 * Resets the expiresAt to DEFAULT_VALID_DAYS from now.
 * @param id - Assignment ID
 * @param certifiedBy - User who is performing certification
 * @param extendDays - Days to extend from now (default: DEFAULT_VALID_DAYS)
 */
export function certifyAssignment(
  id: string,
  certifiedBy: string,
  extendDays: number = DEFAULT_VALID_DAYS,
): RoleAssignment {
  const assignment = assignments.get(id);
  if (!assignment) {
    throw new Error(`Assignment not found: ${id}`);
  }
  if (assignment.revoked) {
    throw new Error(`Cannot certify a revoked assignment: ${id}`);
  }
  if (!certifiedBy || certifiedBy.trim().length === 0) {
    throw new Error('certifiedBy is required');
  }

  const now = new Date();
  assignment.certifiedBy = certifiedBy.trim();
  assignment.certifiedAt = now;
  assignment.expiresAt = new Date(now.getTime() + extendDays * 24 * 60 * 60 * 1000);

  return assignment;
}

/**
 * Get a single assignment by ID.
 */
export function getAssignment(id: string): RoleAssignment | undefined {
  return assignments.get(id);
}

/**
 * List all assignments (for reporting).
 */
export function listAllAssignments(): RoleAssignment[] {
  return Array.from(assignments.values());
}

/**
 * List active (non-revoked, non-expired) assignments for a user.
 */
export function listActiveAssignmentsForUser(userId: string): RoleAssignment[] {
  const now = new Date();
  return Array.from(assignments.values()).filter(
    (a) => a.userId === userId.trim() && !a.revoked && a.expiresAt > now,
  );
}

/**
 * Clear all assignments (for testing).
 */
export function clearAllAssignments(): void {
  assignments.clear();
}
