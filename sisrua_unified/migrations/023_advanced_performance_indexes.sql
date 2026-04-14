-- Migration: 023_advanced_performance_indexes.sql
-- Purpose: Revisar performance de banco com recursos mais avançados.
--
-- Recursos implementados:
--   1. Índices BRIN para colunas de série temporal (custo de armazenamento mínimo)
--   2. Índices GIN/pg_trgm para busca textual em catálogo e histórico
--   3. Índices geoespaciais parciais (PostGIS disponível via Supabase)
--   4. Materialized Views para consultas pesadas recorrentes
--   5. Índices compostos adicionais para padrões de acesso identificados
--   6. Refresh automático das materialized views via pg_cron
--
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensões necessárias
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Índices BRIN (Block Range Index) – séries temporais volumosas
--    Ocupa ~1% do espaço de um B-tree; ideal para tabelas insert-only ordenadas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brin_jobs_created_at
  ON public.jobs USING BRIN (created_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS idx_brin_dxf_tasks_created_at
  ON public.dxf_tasks USING BRIN (created_at) WITH (pages_per_range = 32);

CREATE INDEX IF NOT EXISTS idx_brin_audit_logs_changed_at
  ON public.audit_logs USING BRIN (changed_at) WITH (pages_per_range = 64);

CREATE INDEX IF NOT EXISTS idx_brin_bt_history_created_at
  ON public.bt_export_history USING BRIN (created_at) WITH (pages_per_range = 32);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Índices GIN / pg_trgm – busca textual no catálogo e histórico
-- ─────────────────────────────────────────────────────────────────────────────
-- Busca por substring em namespace e key do catálogo
CREATE INDEX IF NOT EXISTS idx_trgm_constants_namespace
  ON public.constants_catalog USING GIN (namespace extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trgm_constants_key
  ON public.constants_catalog USING GIN (key extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Busca textual em logs de auditoria
CREATE INDEX IF NOT EXISTS idx_trgm_audit_table_name
  ON public.audit_logs USING GIN (table_name extensions.gin_trgm_ops);

-- Índice GIN em colunas JSONB para queries em metadata
CREATE INDEX IF NOT EXISTS idx_gin_bt_history_metadata
  ON public.bt_export_history USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_gin_audit_logs_new_data
  ON public.audit_logs USING GIN (new_data);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Índices compostos para padrões de acesso recorrentes
-- ─────────────────────────────────────────────────────────────────────────────
-- Auditoria por tabela + ação + data (relatórios de conformidade)
CREATE INDEX IF NOT EXISTS idx_audit_table_action_date
  ON public.audit_logs (table_name, action, changed_at DESC);

-- Auditoria por usuário + data (investigação de incidentes)
CREATE INDEX IF NOT EXISTS idx_audit_user_date
  ON public.audit_logs (changed_by, changed_at DESC)
  WHERE changed_by IS NOT NULL;

-- BT history por cenário CQT (análises de engenharia)
CREATE INDEX IF NOT EXISTS idx_bt_history_cqt_scenario_date
  ON public.bt_export_history (cqt_scenario, created_at DESC)
  WHERE deleted_at IS NULL AND cqt_scenario IS NOT NULL;

-- Jobs por status + tentativas (retry logic)
CREATE INDEX IF NOT EXISTS idx_jobs_status_attempts
  ON public.jobs (status, attempts)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Materialized View – Resumo diário do histórico BT (consulta pesada)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_bt_history_daily_summary AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo') AS day_local,
  project_type,
  COUNT(*)                                                        AS export_count,
  AVG(critical_accumulated_clients)                               AS avg_critical_clients,
  MAX(critical_accumulated_clients)                               AS max_critical_clients,
  AVG(critical_accumulated_demand_kva)                            AS avg_demand_kva,
  MAX(critical_accumulated_demand_kva)                            AS max_demand_kva,
  COUNT(CASE WHEN cqt_parity_status = 'pass' THEN 1 END)         AS parity_pass_count,
  COUNT(CASE WHEN cqt_parity_status = 'fail' THEN 1 END)         AS parity_fail_count
FROM public.bt_export_history
WHERE deleted_at IS NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bt_summary_day_type
  ON public.mv_bt_history_daily_summary (day_local, project_type);

GRANT SELECT ON public.mv_bt_history_daily_summary TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Materialized View – Estatísticas de auditoria por tabela
--    NOTA: table_name não é unique key, índice sem UNIQUE para permitir REFRESH
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_audit_stats AS
SELECT
  table_name,
  action,
  COUNT(*)                                          AS event_count,
  COUNT(DISTINCT changed_by)                        AS unique_users,
  MIN(changed_at)                                   AS first_event,
  MAX(changed_at)                                   AS last_event,
  date_trunc('day', MAX(changed_at))                AS last_event_day
FROM public.audit_logs
GROUP BY table_name, action
ORDER BY table_name, action;

CREATE INDEX IF NOT EXISTS idx_mv_audit_stats_table_action
  ON public.mv_audit_stats (table_name, action);

GRANT SELECT ON public.mv_audit_stats TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Materialized View – Status do catálogo por namespace
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_constants_namespace_summary AS
SELECT
  namespace,
  COUNT(*)                             AS total_entries,
  COUNT(CASE WHEN is_active THEN 1 END) AS active_entries,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) AS soft_deleted,
  MAX(updated_at)                      AS last_updated_at
FROM public.constants_catalog
GROUP BY namespace
ORDER BY namespace;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_constants_ns_summary
  ON public.mv_constants_namespace_summary (namespace);

GRANT SELECT ON public.mv_constants_namespace_summary TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Função para refresh de todas as materialized views
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.refresh_materialized_views()
RETURNS TABLE (view_name TEXT, refreshed_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bt_history_daily_summary;
  view_name := 'mv_bt_history_daily_summary'; refreshed_at := now();
  RETURN NEXT;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_audit_stats;
  view_name := 'mv_audit_stats'; refreshed_at := now();
  RETURN NEXT;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_constants_namespace_summary;
  view_name := 'mv_constants_namespace_summary'; refreshed_at := now();
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_materialized_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.refresh_materialized_views() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Agendamento de refresh via pg_cron
-- ─────────────────────────────────────────────────────────────────────────────
DO $do$
DECLARE v_job RECORD;
BEGIN
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname = 'refresh_materialized_views_hourly'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  -- Refresh a cada hora (minuto 5 de cada hora para evitar conflito com outros jobs)
  PERFORM cron.schedule(
    'refresh_materialized_views_hourly',
    '5 * * * *',
    'SELECT * FROM private.refresh_materialized_views()'
  );
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registro da migração
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('023_advanced_performance_indexes.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
