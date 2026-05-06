/**
 * MaintenanceRepository – Repository Pattern (Item 2).
 *
 * Delete-only operations across multiple tables, used by maintenanceService.ts.
 */
import { getDbClient } from "./dbClient.js";
import { logger } from "../utils/logger.js";

export interface IMaintenanceRepository {
  deleteOldAuditLogs(retentionDays: number): Promise<number>;
  deleteOldJobs(
    completedMaxAgeMs: number,
    absoluteMaxAgeMs: number,
  ): Promise<number>;
}

export class PostgresMaintenanceRepository implements IMaintenanceRepository {
  async deleteOldAuditLogs(retentionDays: number): Promise<number> {
    const sql = getDbClient();
    if (!sql) return 0;
    try {
      const result = await sql.unsafe(
        `WITH deleted AS (
           DELETE FROM audit_logs
           WHERE changed_at < NOW() - ($1 || ' days')::interval
           RETURNING id
         ) SELECT COUNT(*) AS cnt FROM deleted`,
        [String(retentionDays)],
      );
      return Number((result as any[])[0]?.cnt ?? 0);
    } catch (err) {
      logger.warn("[MaintenanceRepository] deleteOldAuditLogs failed", { err });
      return 0;
    }
  }

  async deleteOldJobs(
    completedMaxAgeMs: number,
    absoluteMaxAgeMs: number,
  ): Promise<number> {
    const sql = getDbClient();
    if (!sql) return 0;
    try {
      const result = await sql.unsafe(
        `WITH deleted AS (
           DELETE FROM jobs
           WHERE (status IN ('completed','failed')
                  AND updated_at < NOW() - ($1::numeric * interval '1 millisecond'))
              OR created_at < NOW() - ($2::numeric * interval '1 millisecond')
           RETURNING id
         ) SELECT COUNT(*) AS cnt FROM deleted`,
        [completedMaxAgeMs, absoluteMaxAgeMs],
      );
      return Number((result as any[])[0]?.cnt ?? 0);
    } catch (err) {
      logger.warn("[MaintenanceRepository] deleteOldJobs failed", { err });
      return 0;
    }
  }
}

export const maintenanceRepository: IMaintenanceRepository =
  new PostgresMaintenanceRepository();
