-- Migration: 026_backup_restore_operations_and_drill.sql
-- Purpose:
--   Complete backup/restore operations with:
--     1) Controlled restore function from logical backups
--     2) Restore operation log (audit trail)
--     3) Operational verification function for backup/restore readiness
--
-- Scope:
--   Supported restore targets from backup schema snapshots:
--     - public.constants_catalog           <- backup.constants_catalog_snapshot
--     - public.user_roles                  <- backup.user_roles_snapshot
--     - public.bt_export_history           <- backup.bt_export_history_snapshot

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup;

-- -----------------------------------------------------------------------------
-- 1) Restore operations audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup.restore_operations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name             TEXT NOT NULL,
  source_manifest_id     UUID NOT NULL REFERENCES backup.backup_manifest(id),
  pre_restore_manifest_id UUID,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at            TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
  restored_rows          BIGINT NOT NULL DEFAULT 0,
  soft_deleted_rows      BIGINT NOT NULL DEFAULT 0,
  actor                  TEXT NOT NULL DEFAULT 'manual',
  error_message          TEXT
);

CREATE INDEX IF NOT EXISTS idx_restore_ops_table_date
  ON backup.restore_operations (table_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_restore_ops_status_date
  ON backup.restore_operations (status, started_at DESC);

REVOKE ALL ON backup.restore_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON backup.restore_operations TO service_role, postgres;

-- -----------------------------------------------------------------------------
-- 2) Controlled restore function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.restore_table_from_backup(
  p_table_name TEXT,
  p_manifest_id UUID,
  p_actor TEXT DEFAULT 'manual',
  p_soft_delete_missing BOOLEAN DEFAULT true,
  p_create_pre_restore_backup BOOLEAN DEFAULT true
)
RETURNS TABLE (
  table_name TEXT,
  source_manifest_id UUID,
  pre_restore_manifest_id UUID,
  restored_rows BIGINT,
  soft_deleted_rows BIGINT,
  finished_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'backup'
AS $$
DECLARE
  v_snapshot_table TEXT;
  v_pk_col TEXT;
  v_manifest_table TEXT;
  v_manifest_status TEXT;
  v_has_deleted_at BOOLEAN;
  v_restore_id UUID;
  v_pre_restore_manifest_id UUID;
  v_target_cols TEXT;
  v_select_cols TEXT;
  v_update_set TEXT;
  v_restored BIGINT := 0;
  v_soft_deleted BIGINT := 0;
BEGIN
  IF p_table_name NOT IN ('constants_catalog', 'user_roles', 'bt_export_history') THEN
    RAISE EXCEPTION 'Unsupported restore table: %', p_table_name;
  END IF;

  IF p_table_name = 'constants_catalog' THEN
    v_snapshot_table := 'constants_catalog_snapshot';
    v_pk_col := 'id';
  ELSIF p_table_name = 'user_roles' THEN
    v_snapshot_table := 'user_roles_snapshot';
    v_pk_col := 'user_id';
  ELSE
    v_snapshot_table := 'bt_export_history_snapshot';
    v_pk_col := 'id';
  END IF;

  SELECT bm.table_name, bm.status
  INTO v_manifest_table, v_manifest_status
  FROM backup.backup_manifest bm
  WHERE bm.id = p_manifest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup manifest not found: %', p_manifest_id;
  END IF;

  IF v_manifest_table <> p_table_name THEN
    RAISE EXCEPTION 'Manifest % belongs to table %, expected %', p_manifest_id, v_manifest_table, p_table_name;
  END IF;

  IF v_manifest_status <> 'ok' THEN
    RAISE EXCEPTION 'Manifest % status is %, expected ok', p_manifest_id, v_manifest_status;
  END IF;

  INSERT INTO backup.restore_operations (table_name, source_manifest_id, actor)
  VALUES (p_table_name, p_manifest_id, COALESCE(NULLIF(p_actor, ''), 'manual'))
  RETURNING id INTO v_restore_id;

  IF p_create_pre_restore_backup THEN
    -- Create a safety backup before mutating production table.
    -- Filter the returned rows to keep only the current table manifest id.
    SELECT b.manifest_id
    INTO v_pre_restore_manifest_id
    FROM private.backup_critical_tables('pre_restore', INTERVAL '7 days') b
    WHERE b.table_name = p_table_name
    LIMIT 1;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = 'deleted_at'
  ) INTO v_has_deleted_at;

  SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_target_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns s
      WHERE s.table_schema = 'backup'
        AND s.table_name = v_snapshot_table
        AND s.column_name = c.column_name
    );

  IF v_target_cols IS NULL THEN
    RAISE EXCEPTION 'No shared columns between public.% and backup.%', p_table_name, v_snapshot_table;
  END IF;

  SELECT string_agg(format('s.%I', c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_select_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns s
      WHERE s.table_schema = 'backup'
        AND s.table_name = v_snapshot_table
        AND s.column_name = c.column_name
    );

  SELECT string_agg(format('%I = EXCLUDED.%I', c.column_name, c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_update_set
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name
    AND c.column_name <> v_pk_col
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns s
      WHERE s.table_schema = 'backup'
        AND s.table_name = v_snapshot_table
        AND s.column_name = c.column_name
    );

  IF p_soft_delete_missing AND v_has_deleted_at THEN
    EXECUTE format(
      'UPDATE public.%I t
       SET deleted_at = now()
       WHERE t.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM backup.%I s
           WHERE s._backup_id = $1
             AND s.%I = t.%I
         )',
      p_table_name,
      v_snapshot_table,
      v_pk_col,
      v_pk_col
    )
    USING p_manifest_id;

    GET DIAGNOSTICS v_soft_deleted = ROW_COUNT;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (%s)
     SELECT %s
     FROM backup.%I s
     WHERE s._backup_id = $1
     ON CONFLICT (%I) DO UPDATE SET %s',
    p_table_name,
    v_target_cols,
    v_select_cols,
    v_snapshot_table,
    v_pk_col,
    COALESCE(v_update_set, format('%I = EXCLUDED.%I', v_pk_col, v_pk_col))
  )
  USING p_manifest_id;

  GET DIAGNOSTICS v_restored = ROW_COUNT;

  UPDATE backup.restore_operations
  SET pre_restore_manifest_id = v_pre_restore_manifest_id,
      restored_rows = v_restored,
      soft_deleted_rows = v_soft_deleted,
      finished_at = now(),
      status = 'ok'
  WHERE id = v_restore_id;

  table_name := p_table_name;
  source_manifest_id := p_manifest_id;
  pre_restore_manifest_id := v_pre_restore_manifest_id;
  restored_rows := v_restored;
  soft_deleted_rows := v_soft_deleted;
  finished_at := now();
  RETURN NEXT;

EXCEPTION WHEN OTHERS THEN
  UPDATE backup.restore_operations
  SET finished_at = now(),
      status = 'failed',
      error_message = SQLERRM
  WHERE id = v_restore_id;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION private.restore_table_from_backup(TEXT, UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.restore_table_from_backup(TEXT, UUID, TEXT, BOOLEAN, BOOLEAN) TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- 3) Operational verification for backup/restore strategy
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.verify_backup_restore_operations()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  detail TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'backup'
AS $$
DECLARE
  v_count BIGINT;
  v_missing BIGINT;
  v_last_restore TIMESTAMPTZ;
BEGIN
  -- Routine: expected cron jobs configured
  SELECT COUNT(*) INTO v_count
  FROM cron.job
  WHERE jobname IN (
    'backup_critical_tables_daily',
    'backup_critical_tables_weekly',
    'cleanup_expired_backups_weekly',
    'verify_backup_integrity_daily'
  );

  check_name := 'backup_cron_jobs_configured';
  status := CASE WHEN v_count = 4 THEN 'ok' WHEN v_count >= 2 THEN 'WARNING' ELSE 'CRITICAL' END;
  detail := 'Configured jobs: ' || v_count || '/4';
  RETURN NEXT;

  -- Retention: no active backup past expiry
  SELECT COUNT(*) INTO v_count
  FROM backup.backup_manifest
  WHERE status = 'ok'
    AND expires_at < now();

  check_name := 'retention_overdue_active_backups';
  status := CASE WHEN v_count = 0 THEN 'ok' ELSE 'WARNING' END;
  detail := 'Active backups with expires_at in the past: ' || v_count;
  RETURN NEXT;

  -- Coverage: each critical table has at least one ok backup
  SELECT COUNT(*) INTO v_missing
  FROM (
    SELECT t.table_name
    FROM (VALUES ('constants_catalog'), ('user_roles'), ('bt_export_history')) AS t(table_name)
    LEFT JOIN LATERAL (
      SELECT 1
      FROM backup.backup_manifest bm
      WHERE bm.table_name = t.table_name
        AND bm.status = 'ok'
      ORDER BY bm.backup_at DESC
      LIMIT 1
    ) x ON true
    WHERE x IS NULL
  ) z;

  check_name := 'critical_table_backup_coverage';
  status := CASE WHEN v_missing = 0 THEN 'ok' ELSE 'CRITICAL' END;
  detail := 'Critical tables without any ok backup: ' || v_missing;
  RETURN NEXT;

  -- Restore drill recency (manual or automated)
  SELECT MAX(finished_at) INTO v_last_restore
  FROM backup.restore_operations
  WHERE status = 'ok';

  check_name := 'restore_drill_recency';
  status := CASE
    WHEN v_last_restore IS NULL THEN 'WARNING'
    WHEN v_last_restore < now() - INTERVAL '30 days' THEN 'WARNING'
    ELSE 'ok'
  END;
  detail := 'Last successful restore operation: ' || COALESCE(v_last_restore::TEXT, 'NONE');
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.verify_backup_restore_operations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.verify_backup_restore_operations() TO postgres, service_role;

CREATE OR REPLACE VIEW backup.v_restore_operations_recent AS
SELECT
  id,
  table_name,
  source_manifest_id,
  pre_restore_manifest_id,
  started_at,
  finished_at,
  status,
  restored_rows,
  soft_deleted_rows,
  actor,
  error_message
FROM backup.restore_operations
ORDER BY started_at DESC
LIMIT 200;

GRANT SELECT ON backup.v_restore_operations_recent TO service_role, postgres;

-- -----------------------------------------------------------------------------
-- 4) Migration bookkeeping
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('026_backup_restore_operations_and_drill.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;

COMMIT;
