import type { BtExportHistoryEntry } from '../types';

export interface BtExportHistoryPage {
  entries: BtExportHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface BtExportHistoryFilters {
  projectType?: 'ramais' | 'clandestino';
  cqtScenario?: 'atual' | 'proj1' | 'proj2';
}

export interface BtExportHistoryClearResponse {
  deletedCount: number;
}

export interface BtExportHistoryIngestPayload {
  projectType: 'ramais' | 'clandestino';
  btContextUrl: string;
  btContext: unknown;
  exportedAt?: string;
}

export interface BtExportHistoryIngestResponse {
  stored: boolean;
  entry: BtExportHistoryEntry | null;
}

const buildUrl = (limit: number, offset: number, filters?: BtExportHistoryFilters): string => {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (filters?.projectType) {
    params.set('projectType', filters.projectType);
  }

  if (filters?.cqtScenario) {
    params.set('cqtScenario', filters.cqtScenario);
  }

  return `/api/bt-history?${params.toString()}`;
};

export const listBtExportHistory = async (
  limit: number,
  offset: number,
  filters?: BtExportHistoryFilters,
): Promise<BtExportHistoryPage> => {
  const response = await fetch(buildUrl(limit, offset, filters));
  if (!response.ok) {
    throw new Error(`Falha ao listar histórico BT (HTTP ${response.status})`);
  }

  const data = (await response.json()) as BtExportHistoryPage;
  return {
    entries: Array.isArray(data.entries) ? data.entries : [],
    total: typeof data.total === 'number' ? data.total : 0,
    limit: typeof data.limit === 'number' ? data.limit : limit,
    offset: typeof data.offset === 'number' ? data.offset : offset,
  };
};

export const createBtExportHistory = async (entry: BtExportHistoryEntry): Promise<boolean> => {
  const response = await fetch('/api/bt-history', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { stored?: boolean };
  return payload.stored === true;
};

export const ingestBtExportHistory = async (payload: BtExportHistoryIngestPayload): Promise<BtExportHistoryIngestResponse> => {
  const response = await fetch('/api/bt-history/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const parsed = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    stored?: boolean;
    entry?: BtExportHistoryEntry | null;
  };

  if (!response.ok || parsed.ok !== true) {
    throw new Error(parsed.error || `Falha ao ingerir histórico BT (${response.status})`);
  }

  return {
    stored: parsed.stored === true,
    entry: parsed.entry ?? null,
  };
};

export async function clearBtExportHistoryRemote(options: {
  projectType?: BtExportHistoryFilters['projectType'];
  cqtScenario?: BtExportHistoryFilters['cqtScenario'];
} = {}): Promise<BtExportHistoryClearResponse> {
  const params = new URLSearchParams();
  if (options.projectType) params.set('projectType', options.projectType);
  if (options.cqtScenario) params.set('cqtScenario', options.cqtScenario);

  const query = params.toString();
  const endpoint = query ? `/api/bt-history?${query}` : '/api/bt-history';
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    deletedCount?: number;
  };

  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Falha ao limpar historico BT remoto (${response.status})`);
  }

  return { deletedCount: payload.deletedCount ?? 0 };
}
