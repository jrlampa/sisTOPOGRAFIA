/**
 * systemHealthDashboardService.ts — Serviço de agregação de KPIs via Materialized Views.
 *
 * Roadmap Item 125 [T1]: Observabilidade de Negócio e Saúde do Sistema.
 * Consome Materialized Views otimizadas (023_advanced_performance_indexes.sql)
 * para fornecer resumos de alto nível para o painel admin.
 */
import { getDbClient } from "../repositories/dbClient.js";
import { logger } from "../utils/logger.js";

export interface BtDailySummary {
  day_local: string;
  project_type: string;
  export_count: number;
  avg_critical_clients: number;
  max_critical_clients: number;
  avg_demand_kva: number;
  max_demand_kva: number;
  parity_pass_count: number;
  parity_fail_count: number;
}

export interface AuditStat {
  table_name: string;
  action: string;
  event_count: number;
  unique_users: number;
  first_event: string;
  last_event: string;
  last_event_day: string;
}

export interface ConstantsNamespaceSummary {
  namespace: string;
  total_entries: number;
  active_entries: number;
  soft_deleted: number;
  last_updated_at: string;
}

export interface SystemHealthMvsReport {
  btHistory: BtDailySummary[];
  auditStats: AuditStat[];
  catalogSummary: ConstantsNamespaceSummary[];
  timestamp: string;
}

/**
 * Obtém o relatório consolidado de saúde do sistema baseado em MVs.
 */
export async function getSystemHealthMvsReport(): Promise<SystemHealthMvsReport | null> {
  const sql = getDbClient();
  if (!sql) {
    logger.warn("[SystemHealthDashboardService] Banco de dados indisponível.");
    return null;
  }

  try {
    const [btHistory, auditStats, catalogSummary] = await Promise.all([
      sql<BtDailySummary[]>`
        SELECT 
          day_local::text, 
          project_type, 
          export_count::int,
          avg_critical_clients::float, 
          max_critical_clients::float,
          avg_demand_kva::float, 
          max_demand_kva::float,
          parity_pass_count::int, 
          parity_fail_count::int
        FROM mv_bt_history_daily_summary
        ORDER BY day_local DESC, project_type ASC
        LIMIT 30
      `,
      sql<AuditStat[]>`
        SELECT 
          table_name, 
          action, 
          event_count::int, 
          unique_users::int,
          first_event::text, 
          last_event::text, 
          last_event_day::text
        FROM mv_audit_stats
        ORDER BY event_count DESC
      `,
      sql<ConstantsNamespaceSummary[]>`
        SELECT 
          namespace, 
          total_entries::int, 
          active_entries::int, 
          soft_deleted::int, 
          last_updated_at::text
        FROM mv_constants_namespace_summary
        ORDER BY namespace ASC
      `
    ]);

    return {
      btHistory,
      auditStats,
      catalogSummary,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("[SystemHealthDashboardService] Erro ao buscar MVs de saúde", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
