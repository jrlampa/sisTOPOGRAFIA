/**
 * ABAC Policy Service - Attribute-Based Access Control
 * Enhances RBAC with fine-grained contextual access control by Resource, Action, and Context.
 */

export type PolicyEffect = 'allow' | 'deny';

export type PolicyOperator = 'in' | 'not_in' | 'equals' | 'not_equals' | 'contains' | 'starts_with';

export interface AttributeCondition {
  attribute: string;
  operator: PolicyOperator;
  values: unknown[];
}

export type PolicyCondition =
  | AttributeCondition
  | ((subject: PolicySubject, context?: Record<string, unknown>) => boolean);

export interface PolicyRule {
  id: string;
  resource: string;
  action: string;
  condition: PolicyCondition;
  effect: PolicyEffect;
}

export interface PolicySubject {
  roles: string[];
  attributes: Record<string, unknown>;
}

export interface EvaluationResult {
  allowed: boolean;
  matchedRule?: string;
}

// Internal rule store (ordered: explicit deny before allow)
const rules: PolicyRule[] = [];

/**
 * Evaluate an attribute condition against subject + context.
 */
function evaluateCondition(
  condition: PolicyCondition,
  subject: PolicySubject,
  context?: Record<string, unknown>,
): boolean {
  if (typeof condition === 'function') {
    return condition(subject, context);
  }

  const { attribute, operator, values } = condition as AttributeCondition;

  // Resolve attribute value from subject attributes or context
  const attrValue =
    subject.attributes[attribute] !== undefined
      ? subject.attributes[attribute]
      : context?.[attribute];

  switch (operator) {
    case 'in':
      return values.includes(attrValue);
    case 'not_in':
      return !values.includes(attrValue);
    case 'equals':
      return attrValue === values[0];
    case 'not_equals':
      return attrValue !== values[0];
    case 'contains': {
      if (Array.isArray(attrValue)) {
        return values.some((v) => (attrValue as unknown[]).includes(v));
      }
      if (typeof attrValue === 'string') {
        return values.some((v) => (attrValue as string).includes(String(v)));
      }
      return false;
    }
    case 'starts_with':
      return typeof attrValue === 'string' &&
        values.some((v) => (attrValue as string).startsWith(String(v)));
    default:
      return false;
  }
}

/**
 * Check if a rule applies to the given resource and action.
 * Supports wildcards ('*').
 */
function ruleMatches(rule: PolicyRule, resource: string, action: string): boolean {
  const resourceMatch = rule.resource === '*' || rule.resource === resource;
  const actionMatch = rule.action === '*' || rule.action === action;
  return resourceMatch && actionMatch;
}

/**
 * Evaluate all policies for a subject requesting resource/action with optional context.
 * Deny rules take precedence over allow rules.
 */
export function evaluatePolicy(
  subject: PolicySubject,
  resource: string,
  action: string,
  context?: Record<string, unknown>,
): EvaluationResult {
  // Short-circuit: admins always allowed (unless explicit deny exists)
  const isAdmin = subject.roles.includes('admin');

  let allowedRule: PolicyRule | undefined;
  let deniedRule: PolicyRule | undefined;

  for (const rule of rules) {
    if (!ruleMatches(rule, resource, action)) {
      continue;
    }

    const conditionMet = evaluateCondition(rule.condition, subject, context);
    if (!conditionMet) {
      continue;
    }

    if (rule.effect === 'deny') {
      deniedRule = rule;
      break; // Explicit deny wins immediately
    } else if (!allowedRule) {
      allowedRule = rule;
    }
  }

  // Explicit deny wins over anything
  if (deniedRule) {
    return { allowed: false, matchedRule: deniedRule.id };
  }

  // Explicit allow
  if (allowedRule) {
    return { allowed: true, matchedRule: allowedRule.id };
  }

  // Default: admin fallback (no explicit rule matched)
  if (isAdmin) {
    return { allowed: true };
  }

  return { allowed: false };
}

/**
 * Add a policy rule. Deny rules are prepended to be evaluated first.
 */
export function addRule(rule: PolicyRule): void {
  const exists = rules.findIndex((r) => r.id === rule.id);
  if (exists !== -1) {
    rules.splice(exists, 1);
  }

  if (rule.effect === 'deny') {
    rules.unshift(rule);
  } else {
    rules.push(rule);
  }
}

/**
 * Remove a policy rule by ID.
 */
export function removeRule(id: string): void {
  const index = rules.findIndex((r) => r.id === id);
  if (index !== -1) {
    rules.splice(index, 1);
  }
}

/**
 * List all current rules (read-only copy).
 */
export function listRules(): Readonly<PolicyRule[]> {
  return [...rules];
}

/**
 * Clear all rules (useful for testing).
 */
export function clearRules(): void {
  rules.length = 0;
}

// -------------------------------------------------------------------------
// Default rules: seeded on module load
// -------------------------------------------------------------------------

/**
 * Admin can do anything (wildcard allow).
 */
addRule({
  id: 'default:admin:allow-all',
  resource: '*',
  action: '*',
  effect: 'allow',
  condition: (subject) => subject.roles.includes('admin'),
});

/**
 * Viewer can only read.
 */
addRule({
  id: 'default:viewer:read-only',
  resource: '*',
  action: 'read',
  effect: 'allow',
  condition: (subject) => subject.roles.includes('viewer'),
});
