import {
  evaluatePolicy,
  addRule,
  removeRule,
  clearRules,
  listRules,
  type PolicyRule,
  type PolicySubject,
} from '../services/abacPolicyService';

// Reset rules to defaults before each test
function resetRules(): void {
  clearRules();
  // Re-add default rules
  addRule({
    id: 'default:admin:allow-all',
    resource: '*',
    action: '*',
    effect: 'allow',
    condition: (subject) => subject.roles.includes('admin'),
  });
  addRule({
    id: 'default:viewer:read-only',
    resource: '*',
    action: 'read',
    effect: 'allow',
    condition: (subject) => subject.roles.includes('viewer'),
  });
}

describe('ABACPolicyService', () => {
  beforeEach(() => {
    resetRules();
  });

  // -------------------------------------------------------------------------
  // Default rule: admin
  // -------------------------------------------------------------------------
  describe('default admin rule', () => {
    it('allows admin to read any resource', () => {
      const result = evaluatePolicy({ roles: ['admin'], attributes: {} }, 'project', 'read');
      expect(result.allowed).toBe(true);
      expect(result.matchedRule).toBe('default:admin:allow-all');
    });

    it('allows admin to write any resource', () => {
      const result = evaluatePolicy({ roles: ['admin'], attributes: {} }, 'document', 'write');
      expect(result.allowed).toBe(true);
    });

    it('allows admin to delete any resource', () => {
      const result = evaluatePolicy({ roles: ['admin'], attributes: {} }, 'user', 'delete');
      expect(result.allowed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Default rule: viewer
  // -------------------------------------------------------------------------
  describe('default viewer rule', () => {
    it('allows viewer to read any resource', () => {
      const result = evaluatePolicy({ roles: ['viewer'], attributes: {} }, 'map', 'read');
      expect(result.allowed).toBe(true);
      expect(result.matchedRule).toBe('default:viewer:read-only');
    });

    it('denies viewer from writing', () => {
      const result = evaluatePolicy({ roles: ['viewer'], attributes: {} }, 'map', 'write');
      expect(result.allowed).toBe(false);
    });

    it('denies viewer from deleting', () => {
      const result = evaluatePolicy({ roles: ['viewer'], attributes: {} }, 'project', 'delete');
      expect(result.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Geography contextual rules
  // -------------------------------------------------------------------------
  describe('geography attribute conditions', () => {
    beforeEach(() => {
      addRule({
        id: 'geo:technician:sp-rj',
        resource: 'network',
        action: 'write',
        effect: 'allow',
        condition: {
          attribute: 'geography',
          operator: 'in',
          values: ['SP', 'RJ'],
        },
      });
    });

    it('allows technician in SP to write network', () => {
      const subject: PolicySubject = { roles: ['technician'], attributes: { geography: 'SP' } };
      const result = evaluatePolicy(subject, 'network', 'write');
      expect(result.allowed).toBe(true);
      expect(result.matchedRule).toBe('geo:technician:sp-rj');
    });

    it('allows technician in RJ to write network', () => {
      const subject: PolicySubject = { roles: ['technician'], attributes: { geography: 'RJ' } };
      const result = evaluatePolicy(subject, 'network', 'write');
      expect(result.allowed).toBe(true);
    });

    it('denies technician in MG from writing network', () => {
      const subject: PolicySubject = { roles: ['technician'], attributes: { geography: 'MG' } };
      const result = evaluatePolicy(subject, 'network', 'write');
      expect(result.allowed).toBe(false);
    });

    it('uses context when attribute missing from subject', () => {
      const subject: PolicySubject = { roles: ['technician'], attributes: {} };
      const result = evaluatePolicy(subject, 'network', 'write', { geography: 'SP' });
      expect(result.allowed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Deny rules
  // -------------------------------------------------------------------------
  describe('deny rules take precedence', () => {
    it('deny rule blocks admin for specific resource', () => {
      addRule({
        id: 'deny:admin:restricted',
        resource: 'restricted',
        action: '*',
        effect: 'deny',
        condition: (subject) => subject.roles.includes('admin'),
      });

      const result = evaluatePolicy({ roles: ['admin'], attributes: {} }, 'restricted', 'read');
      expect(result.allowed).toBe(false);
      expect(result.matchedRule).toBe('deny:admin:restricted');
    });

    it('deny overrides a matching allow rule', () => {
      addRule({
        id: 'allow:viewer:special',
        resource: 'special',
        action: 'read',
        effect: 'allow',
        condition: () => true,
      });
      addRule({
        id: 'deny:all:special',
        resource: 'special',
        action: 'read',
        effect: 'deny',
        condition: () => true,
      });

      const result = evaluatePolicy({ roles: ['viewer'], attributes: {} }, 'special', 'read');
      expect(result.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Operators
  // -------------------------------------------------------------------------
  describe('policy condition operators', () => {
    it('not_in operator denies blocked users', () => {
      addRule({
        id: 'op:not-in-test',
        resource: 'data',
        action: 'export',
        effect: 'allow',
        condition: { attribute: 'concessionaria', operator: 'not_in', values: ['BLOCKED_CORP'] },
      });

      const allowed = evaluatePolicy(
        { roles: ['technician'], attributes: { concessionaria: 'ALLOWED_CORP' } },
        'data', 'export',
      );
      const denied = evaluatePolicy(
        { roles: ['technician'], attributes: { concessionaria: 'BLOCKED_CORP' } },
        'data', 'export',
      );

      expect(allowed.allowed).toBe(true);
      expect(denied.allowed).toBe(false);
    });

    it('equals operator matches exactly', () => {
      addRule({
        id: 'op:equals-test',
        resource: 'billing',
        action: 'view',
        effect: 'allow',
        condition: { attribute: 'department', operator: 'equals', values: ['finance'] },
      });

      expect(
        evaluatePolicy({ roles: ['user'], attributes: { department: 'finance' } }, 'billing', 'view').allowed,
      ).toBe(true);
      expect(
        evaluatePolicy({ roles: ['user'], attributes: { department: 'engineering' } }, 'billing', 'view').allowed,
      ).toBe(false);
    });

    it('not_equals operator works', () => {
      addRule({
        id: 'op:not-equals-test',
        resource: 'logs',
        action: 'purge',
        effect: 'allow',
        condition: { attribute: 'role', operator: 'not_equals', values: ['guest'] },
      });

      expect(
        evaluatePolicy({ roles: ['technician'], attributes: { role: 'technician' } }, 'logs', 'purge').allowed,
      ).toBe(true);
      expect(
        evaluatePolicy({ roles: ['guest'], attributes: { role: 'guest' } }, 'logs', 'purge').allowed,
      ).toBe(false);
    });

    it('contains operator works on string attribute', () => {
      addRule({
        id: 'op:contains-test',
        resource: 'report',
        action: 'read',
        effect: 'allow',
        condition: { attribute: 'tags', operator: 'contains', values: ['public'] },
      });

      expect(
        evaluatePolicy({ roles: ['user'], attributes: { tags: 'public,internal' } }, 'report', 'read').allowed,
      ).toBe(true);
      expect(
        evaluatePolicy({ roles: ['user'], attributes: { tags: 'internal' } }, 'report', 'read').allowed,
      ).toBe(false);
    });

    it('starts_with operator works', () => {
      addRule({
        id: 'op:starts-with',
        resource: 'file',
        action: 'read',
        effect: 'allow',
        condition: { attribute: 'path', operator: 'starts_with', values: ['/public/'] },
      });

      expect(
        evaluatePolicy({ roles: ['user'], attributes: { path: '/public/data.csv' } }, 'file', 'read').allowed,
      ).toBe(true);
      expect(
        evaluatePolicy({ roles: ['user'], attributes: { path: '/private/secret.csv' } }, 'file', 'read').allowed,
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Rule management
  // -------------------------------------------------------------------------
  describe('rule management', () => {
    it('addRule replaces existing rule with same id', () => {
      addRule({
        id: 'replace-me',
        resource: 'x',
        action: 'read',
        effect: 'allow',
        condition: () => true,
      });

      addRule({
        id: 'replace-me',
        resource: 'x',
        action: 'read',
        effect: 'deny',
        condition: () => true,
      });

      const r = listRules().find((rule) => rule.id === 'replace-me');
      expect(r?.effect).toBe('deny');
      expect(listRules().filter((rule) => rule.id === 'replace-me')).toHaveLength(1);
    });

    it('removeRule deletes a rule', () => {
      addRule({ id: 'to-remove', resource: 'y', action: 'write', effect: 'allow', condition: () => true });
      expect(listRules().some((r) => r.id === 'to-remove')).toBe(true);
      removeRule('to-remove');
      expect(listRules().some((r) => r.id === 'to-remove')).toBe(false);
    });

    it('removeRule is a no-op for unknown id', () => {
      const before = listRules().length;
      removeRule('nonexistent-id');
      expect(listRules().length).toBe(before);
    });

    it('listRules returns a copy (not the internal array)', () => {
      const r1 = listRules();
      const r2 = listRules();
      expect(r1).not.toBe(r2);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown subject with no rules
  // -------------------------------------------------------------------------
  describe('unknown subjects', () => {
    it('denies unknown roles with no matching rule', () => {
      const result = evaluatePolicy({ roles: ['contractor'], attributes: {} }, 'system', 'shutdown');
      expect(result.allowed).toBe(false);
    });

    it('no matchedRule when default deny applies', () => {
      const result = evaluatePolicy({ roles: ['contractor'], attributes: {} }, 'system', 'delete');
      expect(result.matchedRule).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Functional condition
  // -------------------------------------------------------------------------
  describe('functional conditions', () => {
    it('functional condition receives subject and context', () => {
      let capturedSubject: PolicySubject | undefined;
      let capturedContext: Record<string, unknown> | undefined;

      addRule({
        id: 'func-condition',
        resource: 'report',
        action: 'generate',
        effect: 'allow',
        condition: (subj, ctx) => {
          capturedSubject = subj;
          capturedContext = ctx;
          return true;
        },
      });

      const subject = { roles: ['technician'], attributes: { level: 2 } };
      const ctx = { region: 'south' };
      evaluatePolicy(subject, 'report', 'generate', ctx);

      expect(capturedSubject).toEqual(subject);
      expect(capturedContext).toEqual(ctx);
    });
  });
});
