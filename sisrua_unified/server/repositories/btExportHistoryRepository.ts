/**
 * BtExportHistoryRepository – Repository Pattern (Item 2).
 *
 * Owns all SQL against `bt_export_history`. Business logic (HTTP handlers,
 * filtering, pagination) stays in btExportHistoryService.ts.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BtExportHistoryRow {
  id: string;
  projectType: string | null;
  btContextUrl: string | null;
  criticalPoleId: string | null;
  criticalAccumulatedClients: number | null;
  criticalAccumulatedDemandKva: number | null;
  verifiedPoles: number | null;
  verifiedEdges: number | null;
  verifiedTransformers: number | null;
  totalPoles: number | null;
  totalEdges: number | null;
  totalTransformers: number | null;
  cqtScenario: string | null;
  cqtDmdi: number | null;
  cqtP31: number | null;
  cqtP32: number | null;
  cqtK10QtMttr: number | null;
  cqtParityStatus: string | null;
  cqtParityPassed: number | null;
  cqtParityFailed: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface BtExportHistoryFilter {
  projectType?: string;
  cqtScenario?: string;
  limit?: number;
  offset?: number;
}

export interface IBtExportHistoryRepository {
  insert(row: Omit<BtExportHistoryRow, "id" | "createdAt">): Promise<string>;
  findAll(filter?: BtExportHistoryFilter): Promise<BtExportHistoryRow[]>;
  count(
    filter?: Pick<BtExportHistoryFilter, "projectType" | "cqtScenario">,
  ): Promise<number>;
  deleteOlderThan(date: Date): Promise<number>;
}

// ── Implementation ─────────────────────────────────────────────────────────────

export class PostgresBtExportHistoryRepository implements IBtExportHistoryRepository {
  async insert(
    row: Omit<BtExportHistoryRow, "id" | "createdAt">,
  ): Promise<string> {
    const sql = getDbClient();
    if (!sql) throw new Error("DB unavailable");
    const result = await sql.unsafe(
      `INSERT INTO bt_export_history (
         project_type, bt_context_url, critical_pole_id,
         critical_accumulated_clients, critical_accumulated_demand_kva,
         verified_poles, verified_edges, verified_transformers,
         total_poles, total_edges, total_transformers,
         cqt_scenario, cqt_dmdi, cqt_p31, cqt_p32, cqt_k10_qt_mttr,
         cqt_parity_status, cqt_parity_passed, cqt_parity_failed, metadata
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb
       ) RETURNING id`,
      [
        row.projectType,
        row.btContextUrl,
        row.criticalPoleId,
        row.criticalAccumulatedClients,
        row.criticalAccumulatedDemandKva,
        row.verifiedPoles,
        row.verifiedEdges,
        row.verifiedTransformers,
        row.totalPoles,
        row.totalEdges,
        row.totalTransformers,
        row.cqtScenario,
        row.cqtDmdi,
        row.cqtP31,
        row.cqtP32,
        row.cqtK10QtMttr,
        row.cqtParityStatus,
        row.cqtParityPassed,
        row.cqtParityFailed,
        row.metadata ? JSON.stringify(row.metadata) : null,
      ],
    );
    return (result as any[])[0].id as string;
  }

  async findAll(
    filter: BtExportHistoryFilter = {},
  ): Promise<BtExportHistoryRow[]> {
    const sql = getDbClient();
    if (!sql) return [];
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (filter.projectType) {
        conditions.push(`project_type = $${params.length + 1}`);
        params.push(filter.projectType);
      }
      if (filter.cqtScenario) {
        conditions.push(`cqt_scenario = $${params.length + 1}`);
        params.push(filter.cqtScenario);
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const limit = filter.limit ?? 100;
      const offset = filter.offset ?? 0;
      params.push(limit, offset);
      const rows = await sql.unsafe(
        `SELECT * FROM bt_export_history ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      return (rows as any[]).map(_mapRow);
    } catch (err) {
      logger.warn("[BtExportHistoryRepository] findAll failed", { err });
      return [];
    }
  }

  async count(
    filter: Pick<BtExportHistoryFilter, "projectType" | "cqtScenario"> = {},
  ): Promise<number> {
    const sql = getDbClient();
    if (!sql) return 0;
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.projectType) {
      conditions.push(`project_type = $${params.length + 1}`);
      params.push(filter.projectType);
    }
    if (filter.cqtScenario) {
      conditions.push(`cqt_scenario = $${params.length + 1}`);
      params.push(filter.cqtScenario);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await sql.unsafe(
      `SELECT COUNT(*) AS cnt FROM bt_export_history ${where}`,
      params,
    );
    return Number((result as any[])[0]?.cnt ?? 0);
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const sql = getDbClient();
    if (!sql) return 0;
    const result = await sql.unsafe(
      `WITH deleted AS (DELETE FROM bt_export_history WHERE created_at < $1 RETURNING id)
       SELECT COUNT(*) AS cnt FROM deleted`,
      [date.toISOString()],
    );
    return Number((result as any[])[0]?.cnt ?? 0);
  }
}

function _mapRow(r: any): BtExportHistoryRow {
  return {
    id: r.id,
    projectType: r.project_type ?? null,
    btContextUrl: r.bt_context_url ?? null,
    criticalPoleId: r.critical_pole_id ?? null,
    criticalAccumulatedClients:
      r.critical_accumulated_clients != null
        ? Number(r.critical_accumulated_clients)
        : null,
    criticalAccumulatedDemandKva:
      r.critical_accumulated_demand_kva != null
        ? Number(r.critical_accumulated_demand_kva)
        : null,
    verifiedPoles: r.verified_poles != null ? Number(r.verified_poles) : null,
    verifiedEdges: r.verified_edges != null ? Number(r.verified_edges) : null,
    verifiedTransformers:
      r.verified_transformers != null ? Number(r.verified_transformers) : null,
    totalPoles: r.total_poles != null ? Number(r.total_poles) : null,
    totalEdges: r.total_edges != null ? Number(r.total_edges) : null,
    totalTransformers:
      r.total_transformers != null ? Number(r.total_transformers) : null,
    cqtScenario: r.cqt_scenario ?? null,
    cqtDmdi: r.cqt_dmdi != null ? Number(r.cqt_dmdi) : null,
    cqtP31: r.cqt_p31 != null ? Number(r.cqt_p31) : null,
    cqtP32: r.cqt_p32 != null ? Number(r.cqt_p32) : null,
    cqtK10QtMttr: r.cqt_k10_qt_mttr != null ? Number(r.cqt_k10_qt_mttr) : null,
    cqtParityStatus: r.cqt_parity_status ?? null,
    cqtParityPassed:
      r.cqt_parity_passed != null ? Number(r.cqt_parity_passed) : null,
    cqtParityFailed:
      r.cqt_parity_failed != null ? Number(r.cqt_parity_failed) : null,
    metadata: r.metadata ?? null,
    createdAt: new Date(r.created_at),
  };
}

export const btExportHistoryRepository: IBtExportHistoryRepository =
  new PostgresBtExportHistoryRepository();
