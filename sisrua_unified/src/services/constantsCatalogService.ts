export interface ConstantsRefreshEvent {
  namespaces: string[];
  success: boolean;
  httpStatus: number;
  actor: string;
  durationMs?: number;
  errorMessage?: string;
  createdAt?: string;
}

export interface ConstantsCatalogStatus {
  flags: {
    cqt: boolean;
    clandestino: boolean;
    config: boolean;
  };
  cache: Record<string, number>;
  rateLimitPolicy: {
    general: { windowMs: number; limit: number };
    dxf: { windowMs: number; limit: number };
  };
  dxfCleanupPolicy: {
    fileTtlMs: number;
    maxFileAgeMs: number;
    cleanupCheckIntervalMs: number;
  };
  lastRefreshEvent: ConstantsRefreshEvent | null;
}

export interface ConstantsRefreshResponse {
  ok: boolean;
  refreshedNamespaces: string[];
  snapshotIds: number[];
  cache: Record<string, number>;
  rateLimitPolicy: {
    general: { windowMs: number; limit: number };
    dxf: { windowMs: number; limit: number };
  };
  dxfCleanupPolicy: {
    fileTtlMs: number;
    maxFileAgeMs: number;
    cleanupCheckIntervalMs: number;
  };
}

export interface ConstantsRefreshEventsResponse {
  events: ConstantsRefreshEvent[];
  limit: number;
}

export const fetchConstantsCatalogStatus = async (): Promise<ConstantsCatalogStatus> => {
  const response = await fetch('/api/constants/status');
  if (!response.ok) {
    throw new Error(`Failed to load constants status (HTTP ${response.status})`);
  }

  return response.json();
};

export const refreshConstantsCatalog = async (token?: string, actor = 'settings-modal'): Promise<ConstantsRefreshResponse> => {
  const headers: Record<string, string> = {
    'x-refresh-actor': actor,
  };

  if (token) {
    headers['x-constants-refresh-token'] = token;
  }

  const response = await fetch('/api/constants/refresh', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh constants (HTTP ${response.status})`);
  }

  return response.json();
};

export const fetchConstantsRefreshEvents = async (limit = 10, token?: string): Promise<ConstantsRefreshEventsResponse> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers['x-constants-refresh-token'] = token;
  }

  const response = await fetch(`/api/constants/refresh-events?limit=${limit}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load refresh history (HTTP ${response.status})`);
  }

  return response.json();
};

export interface ConstantsRefreshStats {
  totalRefreshes: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDurationMs: number | null;
  maxDurationMs: number | null;
  minSuccessDurationMs: number | null;
  lastSuccessAt: string | null;
  firstRefreshAt: string | null;
  namespaceFrequency: Record<string, number>;
  topActors: Array<{ actor: string; refreshCount: number; successCount: number; lastSeenAt: string }>;
}

export const fetchConstantsRefreshStats = async (token?: string): Promise<ConstantsRefreshStats> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers['x-constants-refresh-token'] = token;
  }

  const response = await fetch('/api/constants/refresh-stats', {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load refresh stats (HTTP ${response.status})`);
  }

  return response.json();
};

export interface CatalogSnapshotMeta {
  id: number;
  namespace: string;
  actor: string;
  label: string | null;
  entryCount: number;
  createdAt: string;
}

export interface CatalogSnapshotsResponse {
  snapshots: CatalogSnapshotMeta[];
  limit: number;
}

export interface SnapshotRestoreResponse {
  ok: boolean;
  restoredSnapshotId: number;
  namespace: string;
  entryCount: number;
  snapshotCreatedAt: string;
  cache: Record<string, number>;
}

export const fetchCatalogSnapshots = async (limit = 10, token?: string, namespace?: string): Promise<CatalogSnapshotsResponse> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers['x-constants-refresh-token'] = token;
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (namespace) params.set('namespace', namespace);

  const response = await fetch(`/api/constants/snapshots?${params.toString()}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load snapshots (HTTP ${response.status})`);
  }

  return response.json();
};

export const restoreCatalogSnapshot = async (id: number, token?: string): Promise<SnapshotRestoreResponse> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers['x-constants-refresh-token'] = token;
  }

  const response = await fetch(`/api/constants/snapshots/${id}/restore`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to restore snapshot ${id} (HTTP ${response.status})`);
  }

  return response.json();
};
