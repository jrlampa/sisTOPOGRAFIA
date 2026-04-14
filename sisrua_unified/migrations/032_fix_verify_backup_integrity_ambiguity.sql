-- Migration: 032_fix_verify_backup_integrity_ambiguity.sql
-- Purpose: Fix ambiguous output-variable references in private.verify_backup_integrity().

BEGIN;

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
  SELECT MAX(bm.backup_at) INTO v_last_daily
  FROM backup.backup_manifest bm
  WHERE bm.backup_type = 'daily' AND bm.status = 'ok';

  check_name := 'last_daily_backup'; status := 'ok';
  detail := 'Last daily backup: ' || COALESCE(v_last_daily::TEXT, 'NONE');
  IF v_last_daily IS NULL OR v_last_daily < now() - INTERVAL '25 hours' THEN
    status := 'WARNING';
  END IF;
  RETURN NEXT;

  SELECT COUNT(*) INTO v_count FROM backup.backup_manifest bm WHERE bm.status = 'ok';
  check_name := 'active_backup_count'; status := 'ok';
  detail := 'Active backup manifests: ' || v_count;
  IF v_count = 0 THEN status := 'CRITICAL'; END IF;
  RETURN NEXT;

  SELECT COUNT(*) INTO v_count
  FROM backup.backup_manifest bm
  WHERE bm.table_name = 'constants_catalog' AND bm.status = 'ok' AND bm.row_count > 0
  ORDER BY bm.backup_at DESC LIMIT 1;

  check_name := 'constants_catalog_backup_nonempty'; status := 'ok';
  detail := 'Recent non-empty constants_catalog backups: ' || v_count;
  IF v_count = 0 THEN status := 'WARNING'; END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.verify_backup_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.verify_backup_integrity() TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('032_fix_verify_backup_integrity_ambiguity.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;

COMMIT;
