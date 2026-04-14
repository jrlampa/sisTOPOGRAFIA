export interface RetentionPolicy {
  id: string;
  resourceType: string;
  maxAgeDays: number;
  maxCount?: number;
  archiveOnExpiry: boolean;
  enabled: boolean;
}

export interface RetentionResult {
  resourceType: string;
  toDelete: string[];
  toArchive: string[];
  toKeep: string[];
}

type RetentionItem = { id: string; createdAt: Date; size?: number };

const policies = new Map<string, RetentionPolicy>();

const registerPolicy = (policy: RetentionPolicy): void => {
  policies.set(policy.resourceType, policy);
};

const getPolicy = (resourceType: string): RetentionPolicy | null => {
  return policies.get(resourceType) ?? null;
};

const evaluateRetention = (
  resourceType: string,
  items: RetentionItem[]
): { toDelete: string[]; toArchive: string[]; toKeep: string[] } => {
  const policy = policies.get(resourceType);
  if (!policy || !policy.enabled) {
    return { toDelete: [], toArchive: [], toKeep: items.map((i) => i.id) };
  }

  const now = Date.now();
  const cutoffMs = policy.maxAgeDays * 24 * 60 * 60 * 1000;

  const sorted = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const toDelete: string[] = [];
  const toArchive: string[] = [];
  const toKeep: string[] = [];

  sorted.forEach((item, index) => {
    const age = now - item.createdAt.getTime();
    const tooOld = age > cutoffMs;
    const tooMany = policy.maxCount !== undefined && index >= policy.maxCount;
    const expired = tooOld || tooMany;

    if (expired) {
      if (policy.archiveOnExpiry) {
        toArchive.push(item.id);
      } else {
        toDelete.push(item.id);
      }
    } else {
      toKeep.push(item.id);
    }
  });

  return { toDelete, toArchive, toKeep };
};

const applyPolicy = (resourceType: string, items: RetentionItem[]): RetentionResult => {
  const result = evaluateRetention(resourceType, items);
  return { resourceType, ...result };
};

const clearPolicies = (): void => {
  policies.clear();
};

// Default policies
registerPolicy({
  id: 'default_dxf_file',
  resourceType: 'dxf_file',
  maxAgeDays: 90,
  archiveOnExpiry: false,
  enabled: true
});

registerPolicy({
  id: 'default_audit_log',
  resourceType: 'audit_log',
  maxAgeDays: 365,
  archiveOnExpiry: false,
  enabled: true
});

registerPolicy({
  id: 'default_domain_snapshot',
  resourceType: 'domain_snapshot',
  maxAgeDays: 180,
  maxCount: 100,
  archiveOnExpiry: true,
  enabled: true
});

export { registerPolicy, getPolicy, evaluateRetention, applyPolicy, clearPolicies };
