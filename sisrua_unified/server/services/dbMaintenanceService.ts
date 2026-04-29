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
   * Saneamento operacional para dxf_tasks com falha.
   * Classifica erros e decide se cancela (input inválido) ou reencaminha (falha de runtime).
   */
  static async sanitizeFailedDxfTasks(limit: number = 200): Promise<{ processed: number; cancelled: number; requeued: number }> {
    await this.init();
    if (!this.sql) return { processed: 0, cancelled: 0, requeued: 0 };

    logger.info("Starting DXF task sanitation", { limit });

    const failedTasks = await this.sql.unsafe(`
      SELECT task_id, error, payload
      FROM public.dxf_tasks
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `);

    let cancelled = 0;
    let requeued = 0;

    for (const task of failedTasks) {
      const classification = this.classifyFailedTask(task.error, task.payload);
      
      if (classification === "cancel") {
        await this.sql`
          UPDATE public.dxf_tasks
          SET status = 'cancelled',
              error = COALESCE(error, '') || ' | sanitized=missing_input',
              finished_at = NOW(),
              updated_at = NOW()
          WHERE task_id = ${task.task_id}
        `;
        cancelled++;
      } else if (classification === "requeue") {
        await this.sql`
          UPDATE public.dxf_tasks
          SET status = 'queued',
              attempts = 0,
              error = NULL,
              started_at = NULL,
              finished_at = NULL,
              updated_at = NOW()
          WHERE task_id = ${task.task_id}
        `;
        requeued++;
      }
    }

    logger.info("DXF task sanitation completed", { processed: failedTasks.length, cancelled, requeued });
    return { processed: failedTasks.length, cancelled, requeued };
  }

  private static classifyFailedTask(error: string | null, payload: any): "cancel" | "requeue" | "skip" {
    const e = (error || "").toLowerCase();
    
    // Validação básica do payload
    const hasValidInput = payload && 
                         typeof payload.lat === 'number' && 
                         typeof payload.lon === 'number' && 
                         typeof payload.radius === 'number';

    if (!hasValidInput || 
        e.includes("missing required parameters") || 
        e.includes("invalid dxf input fields") ||
        e.includes("undefined")) {
      return "cancel";
    }

    if (e.includes("python script") || 
        e.includes("failed to spawn python") || 
        e.includes("worker") || 
        e.includes("module not found")) {
      return "requeue";
    }

    return "skip";
  }
}
