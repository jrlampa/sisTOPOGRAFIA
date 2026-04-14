-- Migration: 027_fix_verify_backup_restore_operations.sql
-- Purpose: Fix ambiguous output-variable references in private.verify_backup_restore_operations().

BEGIN;

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
  SELECT COUNT(*) INTO v_count
  FROM cron.job cj
  WHERE cj.jobname IN (
    'backup_critical_tables_daily',
    'backup_critical_tables_weekly',
    'cleanup_expired_backups_weekly',
    'verify_backup_integrity_daily'
  );

  check_name := 'backup_cron_jobs_configured';
  status := CASE WHEN v_count = 4 THEN 'ok' WHEN v_count >= 2 THEN 'WARNING' ELSE 'CRITICAL' END;
  detail := 'Configured jobs: ' || v_count || '/4';
  RETURN NEXT;

  SELECT COUNT(*) INTO v_count
  FROM backup.backup_manifest bm
  WHERE bm.status = 'ok'
    AND bm.expires_at < now();

  check_name := 'retention_overdue_active_backups';
  status := CASE WHEN v_count = 0 THEN 'ok' ELSE 'WARNING' END;
  detail := 'Active backups with expires_at in the past: ' || v_count;
  RETURN NEXT;

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

  SELECT MAX(ro.finished_at) INTO v_last_restore
  FROM backup.restore_operations ro
  WHERE ro.status = 'ok';

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('027_fix_verify_backup_restore_operations.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;

COMMIT;
