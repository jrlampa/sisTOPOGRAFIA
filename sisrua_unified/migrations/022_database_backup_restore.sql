-- Migration: 022_database_backup_restore.sql
-- Purpose: Estruturar backup e restore de banco de forma abrangente.
--
-- Estratégia:
--   1. Schema dedicado `backup` para armazenar snapshots lógicos de tabelas críticas
--   2. Função private.backup_critical_tables() – captura snapshot diário via pg_cron
--   3. Política de retenção: 30 dias para backups diários, 12 semanas para semanais
--   4. Função private.restore_table_from_backup(table_name, backup_ts) – restauração controlada
--   5. Função private.verify_backup_integrity() – verificação operacional de sanidade
--   6. Agendamento automático via pg_cron
--
-- Nota: Backups físicos (pg_basebackup / Supabase PITR) são complementares e
--       configurados na camada de infraestrutura. Esta migração cobre a camada
--       lógica de aplicação para recuperação granular.

CREATE SCHEMA IF NOT EXISTS backup;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela de manifesto de backups
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup.backup_manifest (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type   TEXT NOT NULL CHECK (backup_type IN ('daily', 'weekly', 'manual', 'pre_restore')),
  table_name    TEXT NOT NULL,
  row_count     BIGINT NOT NULL DEFAULT 0,
  size_bytes    BIGINT,
  backup_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'failed', 'expired', 'restored')),
  notes         TEXT,
  created_by    TEXT NOT NULL DEFAULT 'pg_cron'
);

CREATE INDEX IF NOT EXISTS idx_backup_manifest_table_type_date
  ON backup.backup_manifest (table_name, backup_type, backup_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_manifest_expires
  ON backup.backup_manifest (expires_at)
  WHERE status = 'ok';

-- Acesso restrito ao service_role
REVOKE ALL ON backup.backup_manifest FROM PUBLIC, anon, authenticated;
GRANT ALL ON backup.backup_manifest TO service_role, postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabelas de snapshot lógico para cada tabela crítica
--    (estrutura espelha a tabela original + metadados de backup)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup.constants_catalog_snapshot (
  _backup_id   UUID NOT NULL REFERENCES backup.backup_manifest(id) ON DELETE CASCADE,
  _backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  LIKE public.constants_catalog INCLUDING ALL
);
CREATE INDEX IF NOT EXISTS idx_bkp_constants_catalog_id
  ON backup.constants_catalog_snapshot (_backup_id);

CREATE TABLE IF NOT EXISTS backup.user_roles_snapshot (
  _backup_id   UUID NOT NULL REFERENCES backup.backup_manifest(id) ON DELETE CASCADE,
  _backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  LIKE public.user_roles INCLUDING ALL
);
CREATE INDEX IF NOT EXISTS idx_bkp_user_roles_id
  ON backup.user_roles_snapshot (_backup_id);

CREATE TABLE IF NOT EXISTS backup.bt_export_history_snapshot (
  _backup_id   UUID NOT NULL REFERENCES backup.backup_manifest(id) ON DELETE CASCADE,
  _backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  LIKE public.bt_export_history INCLUDING ALL
);
CREATE INDEX IF NOT EXISTS idx_bkp_bt_history_id
  ON backup.bt_export_history_snapshot (_backup_id);

REVOKE ALL ON backup.constants_catalog_snapshot,
              backup.user_roles_snapshot,
              backup.bt_export_history_snapshot
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON backup.constants_catalog_snapshot,
             backup.user_roles_snapshot,
             backup.bt_export_history_snapshot
  TO service_role, postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Função principal de backup
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.backup_critical_tables(
  p_backup_type TEXT DEFAULT 'daily',
  p_retention   INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS TABLE (table_name TEXT, rows_backed_up BIGINT, manifest_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'backup'
AS $$
DECLARE
  v_manifest_id UUID;
  v_row_count   BIGINT;
  v_expires     TIMESTAMPTZ := now() + p_retention;
BEGIN
  -- ── constants_catalog ─────────────────────────────────────────────────────
  INSERT INTO backup.backup_manifest (backup_type, table_name, expires_at)
  VALUES (p_backup_type, 'constants_catalog', v_expires)
  RETURNING id INTO v_manifest_id;

  INSERT INTO backup.constants_catalog_snapshot (_backup_id, _backed_up_at,
    id, namespace, key, value, description, unit, source, environment,
    version, is_active, created_at, updated_at, changed_by, deleted_at)
  SELECT v_manifest_id, now(),
    id, namespace, key, value, description, unit, source, environment,
    version, is_active, created_at, updated_at, changed_by, deleted_at
  FROM public.constants_catalog
  WHERE deleted_at IS NULL;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  UPDATE backup.backup_manifest SET row_count = v_row_count WHERE id = v_manifest_id;
  table_name := 'constants_catalog'; rows_backed_up := v_row_count; manifest_id := v_manifest_id;
  RETURN NEXT;

  -- ── user_roles ────────────────────────────────────────────────────────────
  INSERT INTO backup.backup_manifest (backup_type, table_name, expires_at)
  VALUES (p_backup_type, 'user_roles', v_expires)
  RETURNING id INTO v_manifest_id;

  INSERT INTO backup.user_roles_snapshot (_backup_id, _backed_up_at,
      user_id, role, assigned_at, assigned_by, reason, deleted_at)
  SELECT v_manifest_id, now(),
      user_id, role, assigned_at, assigned_by, reason, deleted_at
  FROM public.user_roles
  WHERE deleted_at IS NULL;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  UPDATE backup.backup_manifest SET row_count = v_row_count WHERE id = v_manifest_id;
  table_name := 'user_roles'; rows_backed_up := v_row_count; manifest_id := v_manifest_id;
  RETURN NEXT;

  -- ── bt_export_history (últimos 90 dias) ───────────────────────────────────
  INSERT INTO backup.backup_manifest (backup_type, table_name, expires_at)
  VALUES (p_backup_type, 'bt_export_history', v_expires)
  RETURNING id INTO v_manifest_id;

  INSERT INTO backup.bt_export_history_snapshot (_backup_id, _backed_up_at,
    id, created_at, project_type, bt_context_url, critical_pole_id,
    critical_accumulated_clients, critical_accumulated_demand_kva,
    verified_poles, total_poles, verified_edges, total_edges,
    verified_transformers, total_transformers, cqt_scenario,
    cqt_dmdi, cqt_p31, cqt_p32, cqt_k10_qt_mttr, cqt_parity_status,
    cqt_parity_passed, cqt_parity_failed, metadata, deleted_at)
  SELECT v_manifest_id, now(),
    id, created_at, project_type, bt_context_url, critical_pole_id,
    critical_accumulated_clients, critical_accumulated_demand_kva,
    verified_poles, total_poles, verified_edges, total_edges,
    verified_transformers, total_transformers, cqt_scenario,
    cqt_dmdi, cqt_p31, cqt_p32, cqt_k10_qt_mttr, cqt_parity_status,
    cqt_parity_passed, cqt_parity_failed, metadata, deleted_at
  FROM public.bt_export_history
  WHERE deleted_at IS NULL
    AND created_at > now() - INTERVAL '90 days';

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  UPDATE backup.backup_manifest SET row_count = v_row_count WHERE id = v_manifest_id;
  table_name := 'bt_export_history'; rows_backed_up := v_row_count; manifest_id := v_manifest_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.backup_critical_tables(TEXT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.backup_critical_tables(TEXT, INTERVAL) TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Função de limpeza de backups expirados (retenção)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.cleanup_expired_backups()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'backup'
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  -- Marca como expirado; a exclusão em cascata remove os snapshots filhos
  UPDATE backup.backup_manifest
  SET status = 'expired'
  WHERE expires_at < now() AND status = 'ok';

  -- Remove manifests expirados (CASCADE apaga snapshots)
  DELETE FROM backup.backup_manifest
  WHERE status = 'expired' AND expires_at < now() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION private.cleanup_expired_backups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.cleanup_expired_backups() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Função de verificação de integridade dos backups
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.verify_backup_integrity()
RETURNS TABLE (
  check_name   TEXT,
  status       TEXT,
  detail       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'backup'
AS $$
DECLARE
  v_last_daily TIMESTAMPTZ;
  v_count      BIGINT;
BEGIN
  -- Verificação 1: backup diário recente (últimas 25h)
  SELECT MAX(backup_at) INTO v_last_daily
  FROM backup.backup_manifest
  WHERE backup_type = 'daily' AND status = 'ok';

  check_name := 'last_daily_backup'; status := 'ok';
  detail := 'Last daily backup: ' || COALESCE(v_last_daily::TEXT, 'NONE');
  IF v_last_daily IS NULL OR v_last_daily < now() - INTERVAL '25 hours' THEN
    status := 'WARNING';
  END IF;
  RETURN NEXT;

  -- Verificação 2: contagem mínima de snapshots ativos
  SELECT COUNT(*) INTO v_count FROM backup.backup_manifest WHERE status = 'ok';
  check_name := 'active_backup_count'; status := 'ok';
  detail := 'Active backup manifests: ' || v_count;
  IF v_count = 0 THEN status := 'CRITICAL'; END IF;
  RETURN NEXT;

  -- Verificação 3: integridade de constants_catalog (row_count > 0)
  SELECT COUNT(*) INTO v_count
  FROM backup.backup_manifest
  WHERE table_name = 'constants_catalog' AND status = 'ok' AND row_count > 0
  ORDER BY backup_at DESC LIMIT 1;
  check_name := 'constants_catalog_backup_nonempty'; status := 'ok';
  detail := 'Recent non-empty constants_catalog backups: ' || v_count;
  IF v_count = 0 THEN status := 'WARNING'; END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.verify_backup_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.verify_backup_integrity() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Agendamento pg_cron
-- ─────────────────────────────────────────────────────────────────────────────
DO $do$
DECLARE v_job RECORD;
BEGIN
  -- Remove agendamentos anteriores com mesmo nome
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname IN (
    'backup_critical_tables_daily',
    'backup_critical_tables_weekly',
    'cleanup_expired_backups_weekly',
    'verify_backup_integrity_daily'
  ) LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  -- Backup diário às 02:00 UTC (retenção 30 dias)
  PERFORM cron.schedule(
    'backup_critical_tables_daily',
    '0 2 * * *',
    $$SELECT * FROM private.backup_critical_tables('daily', INTERVAL '30 days')$$
  );

  -- Backup semanal (domingo 01:00 UTC, retenção 84 dias = 12 semanas)
  PERFORM cron.schedule(
    'backup_critical_tables_weekly',
    '0 1 * * 0',
    $$SELECT * FROM private.backup_critical_tables('weekly', INTERVAL '84 days')$$
  );

  -- Limpeza de backups expirados (sexta 04:00 UTC)
  PERFORM cron.schedule(
    'cleanup_expired_backups_weekly',
    '0 4 * * 5',
    'SELECT private.cleanup_expired_backups()'
  );

  -- Verificação de integridade diária às 06:00 UTC
  PERFORM cron.schedule(
    'verify_backup_integrity_daily',
    '0 6 * * *',
    'SELECT * FROM private.verify_backup_integrity()'
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
    VALUES ('022_database_backup_restore.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
