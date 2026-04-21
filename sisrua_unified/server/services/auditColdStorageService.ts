/**
 * auditColdStorageService.ts — Time-series Cold Storage para Logs de Auditoria (76 [T1])
 */

import crypto from "crypto";
import { logger } from "../utils/logger.js";

export interface AuditHotLog {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  resource: string;
  ts: string;
  context: Record<string, unknown>;
}

export interface AuditColdLog extends AuditHotLog {
  partitionMonth: string; // YYYY-MM
  archivedAt: string;
}

const hotLogs: AuditHotLog[] = [];
const coldLogs: AuditColdLog[] = [];

function toMonth(ts: string): string {
  return ts.slice(0, 7);
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export class AuditColdStorageService {
  static ingestHotLog(data: Omit<AuditHotLog, "id">): AuditHotLog {
    const log: AuditHotLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...data,
    };
    hotLogs.push(log);
    return log;
  }

  static archiveOlderThan(days: number): { moved: number; remainingHot: number; totalCold: number } {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const toMove = hotLogs.filter((l) => new Date(l.ts).getTime() < cutoff);

    for (const log of toMove) {
      coldLogs.push({
        ...log,
        partitionMonth: toMonth(log.ts),
        archivedAt: new Date().toISOString(),
      });
    }

    const movedIds = new Set(toMove.map((l) => l.id));
    for (let i = hotLogs.length - 1; i >= 0; i--) {
      if (movedIds.has(hotLogs[i]!.id)) hotLogs.splice(i, 1);
    }

    if (toMove.length > 0) {
      logger.info(`auditColdStorage: ${toMove.length} logs movidos para camada fria`);
    }

    return {
      moved: toMove.length,
      remainingHot: hotLogs.length,
      totalCold: coldLogs.length,
    };
  }

  static queryCold(params?: {
    tenantId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): AuditColdLog[] {
    let result = [...coldLogs];

    if (params?.tenantId) {
      result = result.filter((l) => l.tenantId === params.tenantId);
    }
    if (params?.from) {
      const fromMs = new Date(params.from).getTime();
      result = result.filter((l) => new Date(l.ts).getTime() >= fromMs);
    }
    if (params?.to) {
      const toMs = new Date(params.to).getTime();
      result = result.filter((l) => new Date(l.ts).getTime() <= toMs);
    }

    result.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 100;
    return result.slice(offset, offset + limit);
  }

  static getStats(): {
    hotCount: number;
    coldCount: number;
    partitions: Array<{ month: string; count: number }>;
  } {
    const byMonth = new Map<string, number>();
    for (const log of coldLogs) {
      byMonth.set(log.partitionMonth, (byMonth.get(log.partitionMonth) ?? 0) + 1);
    }

    return {
      hotCount: hotLogs.length,
      coldCount: coldLogs.length,
      partitions: [...byMonth.entries()]
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  static exportPartition(month: string): {
    month: string;
    count: number;
    ndjson: string;
    sha256: string;
  } {
    const rows = coldLogs
      .filter((l) => l.partitionMonth === month)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const ndjson = rows.map((r) => JSON.stringify(r)).join("\n");
    return {
      month,
      count: rows.length,
      ndjson,
      sha256: hashContent(ndjson),
    };
  }
}
