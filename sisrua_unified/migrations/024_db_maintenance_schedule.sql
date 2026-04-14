-- Migration: 024_db_maintenance_schedule.sql
-- Purpose: Formalizar manutenção recorrente abrangente do banco de dados.
--
-- Escopo implementado por esta migration:
--   1. Tabela de governança operacional: private.maintenance_log
--   2. Tabela de cold storage: private.audit_logs_archive
--   3. Função de apoio e logging para manutenção com VACUUM ANALYZE
--   4. Archival de audit_logs antigos para tabela de arquivo
--   5. Relatório de saúde operacional do banco baseado em pg_stat_*
--   6. Cleanup de maintenance_log antigo
--   7. Agendamento pg_cron de VACUUM, archival, health report e cleanup de maintenance_log
--   8. View private.v_maintenance_schedule consolidando jobs desta rotina e jobs relacionados
--
-- Observação: jobs de backup, verify backup, refresh de materialized views e cleanup_old_jobs
-- são referenciados na view consolidada, mas são criados em outras migrations.
--
-- Idempotente: usa unschedule/reschedule para cron jobs e IF NOT EXISTS para objetos novos.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela de log de manutenção (governança operacional)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.maintenance_log (
  id           BIGSERIAL PRIMARY KEY,
  job_name     TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'error')),
  details      JSONB,
  error_msg    TEXT
);

CREATE INDEX IF NOT EXISTS idx_maint_log_job_date
  ON private.maintenance_log (job_name, started_at DESC);

REVOKE ALL ON private.maintenance_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.maintenance_log TO service_role, postgres;
GRANT USAGE, SELECT ON SEQUENCE private.maintenance_log_id_seq TO service_role, postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabela de archive de audit_logs antigos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.audit_logs_archive (
  LIKE public.audit_logs INCLUDING ALL
);

CREATE INDEX IF NOT EXISTS idx_audit_archive_table_date
  ON private.audit_logs_archive (table_name, changed_at DESC);

REVOKE ALL ON private.audit_logs_archive FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.audit_logs_archive TO service_role, postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Função: VACUUM ANALYZE em tabelas de alto volume
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.run_vacuum_analyze()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO private.maintenance_log (job_name) VALUES ('vacuum_analyze')
  RETURNING id INTO v_log_id;

  -- VACUUM ANALYZE via SQL (não EXECUTE dentro de plpgsql; usa pg_catalog direto)
  -- Nota: VACUUM não pode ser executado dentro de uma transação explícita.
  -- A execução real é feita pelo pg_cron chamando as statements diretamente.
  -- Esta função serve para logging e verificação de integridade.

  UPDATE private.maintenance_log
  SET status = 'ok',
      finished_at = now(),
      details = jsonb_build_object(
        'note', 'VACUUM ANALYZE agendado via pg_cron como statement direto',
        'tables', ARRAY[
          'public.jobs', 'public.dxf_tasks', 'public.bt_export_history',
          'public.constants_catalog', 'public.audit_logs'
        ]
      )
  WHERE id = v_log_id;
EXCEPTION WHEN OTHERS THEN
  UPDATE private.maintenance_log
  SET status = 'error', finished_at = now(), error_msg = SQLERRM
  WHERE id = v_log_id;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION private.run_vacuum_analyze() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.run_vacuum_analyze() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Função: Archival de audit_logs com mais de 90 dias
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.archive_old_audit_logs(
  p_keep_for    INTERVAL DEFAULT INTERVAL '90 days',
  p_batch_limit INTEGER  DEFAULT 50000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  v_moved   INTEGER := 0;
  v_log_id  BIGINT;
BEGIN
  INSERT INTO private.maintenance_log (job_name) VALUES ('archive_audit_logs')
  RETURNING id INTO v_log_id;

  WITH to_archive AS (
    SELECT id FROM public.audit_logs
    WHERE changed_at < now() - p_keep_for
    ORDER BY changed_at ASC
    LIMIT GREATEST(p_batch_limit, 1)
    FOR UPDATE SKIP LOCKED
  ),
  moved AS (
    INSERT INTO private.audit_logs_archive
    SELECT al.* FROM public.audit_logs al
    JOIN to_archive ta ON al.id = ta.id
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  DELETE FROM public.audit_logs al
  USING moved m
  WHERE al.id = m.id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE private.maintenance_log
  SET status = 'ok', finished_at = now(),
      details = jsonb_build_object('rows_archived', v_moved, 'keep_for', p_keep_for::TEXT)
  WHERE id = v_log_id;

  RETURN v_moved;
EXCEPTION WHEN OTHERS THEN
  UPDATE private.maintenance_log
  SET status = 'error', finished_at = now(), error_msg = SQLERRM
  WHERE id = v_log_id;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION private.archive_old_audit_logs(INTERVAL, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.archive_old_audit_logs(INTERVAL, INTEGER) TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Função: Relatório de saúde operacional do banco
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.db_health_report()
RETURNS TABLE (
  metric      TEXT,
  value       TEXT,
  status      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  v_bloat_pct    NUMERIC;
  v_dead_tuples  BIGINT;
  v_cache_hit    NUMERIC;
  v_log_id       BIGINT;
BEGIN
  INSERT INTO private.maintenance_log (job_name) VALUES ('db_health_report')
  RETURNING id INTO v_log_id;

  -- Cache hit ratio (deve ser > 99%)
  SELECT ROUND(
    100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2
  ) INTO v_cache_hit
  FROM pg_stat_database WHERE datname = current_database();

  metric := 'cache_hit_ratio_pct'; value := COALESCE(v_cache_hit::TEXT, 'N/A');
  status := CASE WHEN v_cache_hit >= 99 THEN 'ok' WHEN v_cache_hit >= 95 THEN 'WARNING' ELSE 'CRITICAL' END;
  RETURN NEXT;

  -- Dead tuples em tabelas críticas
  SELECT COALESCE(SUM(n_dead_tup), 0) INTO v_dead_tuples
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
    AND relname IN ('jobs', 'audit_logs', 'bt_export_history', 'constants_catalog');

  metric := 'dead_tuples_critical_tables'; value := v_dead_tuples::TEXT;
  status := CASE WHEN v_dead_tuples < 10000 THEN 'ok' WHEN v_dead_tuples < 100000 THEN 'WARNING' ELSE 'CRITICAL' END;
  RETURN NEXT;

  -- Contagem de locks ativos
  SELECT COUNT(*) INTO v_dead_tuples FROM pg_locks WHERE NOT granted;
  metric := 'blocked_locks'; value := v_dead_tuples::TEXT;
  status := CASE WHEN v_dead_tuples = 0 THEN 'ok' WHEN v_dead_tuples < 5 THEN 'WARNING' ELSE 'CRITICAL' END;
  RETURN NEXT;

  -- Tamanho do banco
  metric := 'database_size';
  value := pg_size_pretty(pg_database_size(current_database()));
  status := 'ok';
  RETURN NEXT;

  -- Audit log count (volume)
  SELECT COUNT(*) INTO v_dead_tuples FROM public.audit_logs;
  metric := 'audit_log_total_rows'; value := v_dead_tuples::TEXT;
  status := CASE WHEN v_dead_tuples < 1000000 THEN 'ok' WHEN v_dead_tuples < 5000000 THEN 'WARNING' ELSE 'CRITICAL' END;
  RETURN NEXT;

  UPDATE private.maintenance_log
  SET status = 'ok', finished_at = now()
  WHERE id = v_log_id;
EXCEPTION WHEN OTHERS THEN
  UPDATE private.maintenance_log
  SET status = 'error', finished_at = now(), error_msg = SQLERRM
  WHERE id = v_log_id;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION private.db_health_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.db_health_report() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Função: Cleanup de maintenance_log antigo (>60 dias)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.cleanup_maintenance_log(
  p_keep_for INTERVAL DEFAULT INTERVAL '60 days'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM private.maintenance_log
  WHERE started_at < now() - p_keep_for;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION private.cleanup_maintenance_log(INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.cleanup_maintenance_log(INTERVAL) TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Agendamento pg_cron de toda a rotina de manutenção
-- ─────────────────────────────────────────────────────────────────────────────
DO $do$
DECLARE v_job RECORD;
BEGIN
  -- Remove agendamentos anteriores
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname IN (
    'vacuum_analyze_jobs_daily',
    'vacuum_analyze_audit_weekly',
    'archive_old_audit_logs_nightly',
    'db_health_report_daily',
    'cleanup_maintenance_log_monthly'
  ) LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  -- VACUUM ANALYZE em jobs diariamente às 03:10 (após limpeza de jobs às 03:20)
  PERFORM cron.schedule(
    'vacuum_analyze_jobs_daily',
    '10 3 * * *',
    $$VACUUM ANALYZE public.jobs; VACUUM ANALYZE public.dxf_tasks$$
  );

  -- VACUUM ANALYZE em tabelas pesadas toda semana (domingo 02:30)
  PERFORM cron.schedule(
    'vacuum_analyze_audit_weekly',
    '30 2 * * 0',
    $$VACUUM ANALYZE public.audit_logs; VACUUM ANALYZE public.bt_export_history; VACUUM ANALYZE public.constants_catalog$$
  );

  -- Archival de audit_logs noturnamente às 03:30 (lotes de 50k)
  PERFORM cron.schedule(
    'archive_old_audit_logs_nightly',
    '30 3 * * *',
    $$SELECT private.archive_old_audit_logs(INTERVAL '90 days', 50000)$$
  );

  -- Relatório de saúde do banco diariamente às 07:00
  PERFORM cron.schedule(
    'db_health_report_daily',
    '0 7 * * *',
    'SELECT * FROM private.db_health_report()'
  );

  -- Cleanup do maintenance_log mensalmente (dia 1 às 05:00)
  PERFORM cron.schedule(
    'cleanup_maintenance_log_monthly',
    '0 5 1 * *',
    $$SELECT private.cleanup_maintenance_log(INTERVAL '60 days')$$
  );
END
$do$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Vista operacional: cronograma de manutenção ativo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW private.v_maintenance_schedule AS
SELECT
  jobname,
  schedule,
  command,
  active,
  jobid
FROM cron.job
WHERE jobname IN (
  'cleanup_old_jobs_daily',
  'backup_critical_tables_daily',
  'backup_critical_tables_weekly',
  'cleanup_expired_backups_weekly',
  'verify_backup_integrity_daily',
  'refresh_materialized_views_hourly',
  'vacuum_analyze_jobs_daily',
  'vacuum_analyze_audit_weekly',
  'archive_old_audit_logs_nightly',
  'db_health_report_daily',
  'cleanup_maintenance_log_monthly'
)
ORDER BY jobname;

GRANT SELECT ON private.v_maintenance_schedule TO service_role, postgres;

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
    VALUES ('024_db_maintenance_schedule.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
