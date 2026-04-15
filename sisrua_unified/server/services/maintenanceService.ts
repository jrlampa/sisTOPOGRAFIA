import postgres from "postgres";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

interface MaintenanceStats {
  auditLogsDeleted: number;
  jobsDeleted: number;
  filesDeleted: number;
}

class MaintenanceService {
  private sql: ReturnType<typeof postgres> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private dbRetryAfterMs = 0;

  private isDnsResolutionError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toUpperCase();
    return normalized.includes("ENOTFOUND") || normalized.includes("EAI_AGAIN");
  }

  private getSql() {
    if (!config.maintenanceDbCleanupEnabled || !config.DATABASE_URL)
      return null;
    if (Date.now() < this.dbRetryAfterMs) return null;
    if (!this.sql) {
      this.sql = postgres(config.DATABASE_URL, {
        max: 1,
        idle_timeout: 30,
        ssl: config.NODE_ENV === "production" ? "require" : undefined,
      });
    }
    return this.sql;
  }

  public async runMaintenance(): Promise<MaintenanceStats> {
    const stats: MaintenanceStats = {
      auditLogsDeleted: 0,
      jobsDeleted: 0,
      filesDeleted: 0,
    };

    const sql = this.getSql();
    if (sql) {
      try {
        logger.info("[Maintenance] Starting DB cleanup...");

        // 1. Clean Audit Logs (> 30 days)
        const auditResult = await sql`
                    DELETE FROM audit_logs 
                    WHERE changed_at < NOW() - INTERVAL '30 days'
                    RETURNING id
                `;
        stats.auditLogsDeleted = auditResult.length;

        // 2. Clean Jobs (> 24h if success/failure, or > 7 days anyway)
        const jobsResult = await sql`
                    DELETE FROM jobs 
                    WHERE (status IN ('completed', 'failed') AND created_at < NOW() - INTERVAL '24 hours')
                       OR (created_at < NOW() - INTERVAL '7 days')
                    RETURNING id
                `;
        stats.jobsDeleted = jobsResult.length;

        logger.info(
          `[Maintenance] DB Cleanup complete: ${stats.auditLogsDeleted} logs, ${stats.jobsDeleted} jobs deleted.`,
        );
      } catch (error) {
        logger.error("[Maintenance] DB Cleanup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (this.isDnsResolutionError(error)) {
          this.dbRetryAfterMs = Date.now() + 30 * 60 * 1000;
          logger.warn(
            "[Maintenance] DB cleanup paused due to DNS resolution failure",
            {
              retryAfterIso: new Date(this.dbRetryAfterMs).toISOString(),
            },
          );
          if (this.sql) {
            this.sql.end().catch(() => undefined);
            this.sql = null;
          }
        }
      }
    }

    // 3. File cleanup check (Safety net for DXF)
    try {
      const dxfDir = config.DXF_DIRECTORY;
      if (fs.existsSync(dxfDir)) {
        const files = fs.readdirSync(dxfDir);
        const now = Date.now();
        const maxAge = config.DXF_MAX_AGE_MS || 7200000; // 2h fallback

        for (const file of files) {
          if (file === ".gitkeep") continue;
          const filePath = path.join(dxfDir, file);
          const fileStat = fs.statSync(filePath);
          if (now - fileStat.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
            stats.filesDeleted++;
          }
        }
      }
    } catch (error) {
      logger.error("[Maintenance] File cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return stats;
  }

  public start() {
    if (this.timer) return;

    // Run every 6 hours
    const INTERVAL = 6 * 60 * 60 * 1000;

    logger.info("[Maintenance] Service scheduled every 6 hours.");

    this.timer = setInterval(async () => {
      await this.runMaintenance();
    }, INTERVAL);

    // Run immediately on start
    setTimeout(() => this.runMaintenance(), 5000);
  }

  public async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.sql) {
      await this.sql.end();
      this.sql = null;
    }
  }
}

export const maintenanceService = new MaintenanceService();
