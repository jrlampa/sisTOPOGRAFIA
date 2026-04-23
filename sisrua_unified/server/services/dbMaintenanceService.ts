import { logger } from "../utils/logger.js";
import postgres from "postgres";
import { config } from "../config.js";

/**
 * Database Maintenance Service
 * 
 * Fornece operações de manutenção de baixo nível para otimizar a performance
 * e reduzir o "bloat" de tabelas críticas.
 */
export class DbMaintenanceService {
  private static sql: ReturnType<typeof postgres> | null = null;

  private static async init() {
    if (this.sql) return;
    if (!config.DATABASE_URL) {
      throw new Error("DATABASE_URL not configured");
    }
    this.sql = postgres(config.DATABASE_URL, {
      max: 1,
      idle_timeout: 10,
    });
  }

  /**
   * Executa VACUUM ANALYZE nas tabelas especificadas.
   * IMPORTANTE: Esta operação pode ser pesada e deve ser usada com cautela.
   */
  static async runVacuumAnalyze(tables: string[] = ["audit_logs", "bt_export_history", "user_roles"]): Promise<{ success: boolean; results: string[] }> {
    await this.init();
    if (!this.sql) return { success: false, results: [] };

    const results: string[] = [];
    logger.info("Starting manual VACUUM ANALYZE", { tables });

    for (const table of tables) {
      try {
        // VACUUM não pode ser executado dentro de uma transação.
        // O driver 'postgres' executa comandos individualmente quando não usamos .begin()
        await this.sql.unsafe(`VACUUM ANALYZE public.${table}`);
        results.push(`Table ${table}: SUCCESS`);
        logger.info(`VACUUM ANALYZE success for ${table}`);
      } catch (err: any) {
        results.push(`Table ${table}: FAILED (${err.message})`);
        logger.error(`VACUUM ANALYZE failed for ${table}`, { error: err.message });
      }
    }

    return { success: results.every(r => r.includes("SUCCESS")), results };
  }

  /**
   * Retorna um relatório de saúde detalhado do DB (Bloat, Índices, Saúde).
   */
  static async getHealthStats(): Promise<any> {
    await this.init();
    if (!this.sql) return null;

    try {
      const stats = await this.sql.unsafe("SELECT * FROM private.db_health_report()");
      return stats;
    } catch (err: any) {
      logger.error("Failed to fetch DB health stats", { error: err.message });
      return null;
    }
  }
}
