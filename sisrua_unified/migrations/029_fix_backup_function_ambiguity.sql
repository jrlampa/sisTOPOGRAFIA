-- Migration: 029_fix_backup_function_ambiguity.sql
-- Purpose: Fix ambiguous output-variable references in private.backup_critical_tables().

BEGIN;

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
  v_row_count BIGINT;
  v_expires TIMESTAMPTZ := now() + p_retention;
  v_target_table TEXT;
  v_snapshot_table TEXT;
  v_target_cols TEXT;
  v_select_cols TEXT;
  v_has_deleted_at BOOLEAN;
  v_has_created_at BOOLEAN;
  v_where TEXT;
BEGIN
  IF p_backup_type NOT IN ('daily', 'weekly', 'manual', 'pre_restore') THEN
    RAISE EXCEPTION 'Invalid backup type: %', p_backup_type;
  END IF;

  FOR v_target_table, v_snapshot_table IN
    SELECT 'constants_catalog', 'constants_catalog_snapshot'
    UNION ALL SELECT 'user_roles', 'user_roles_snapshot'
    UNION ALL SELECT 'bt_export_history', 'bt_export_history_snapshot'
  LOOP
    INSERT INTO backup.backup_manifest (backup_type, table_name, expires_at)
    VALUES (p_backup_type, v_target_table, v_expires)
    RETURNING id INTO v_manifest_id;

    SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_target_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_target_table
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns s
        WHERE s.table_schema = 'backup'
          AND s.table_name = v_snapshot_table
          AND s.column_name = c.column_name
      );

    SELECT string_agg(format('t.%I', c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_select_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_target_table
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns s
        WHERE s.table_schema = 'backup'
          AND s.table_name = v_snapshot_table
          AND s.column_name = c.column_name
      );

    IF v_target_cols IS NULL OR v_select_cols IS NULL THEN
      RAISE EXCEPTION 'No shared columns between public.% and backup.%', v_target_table, v_snapshot_table;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = v_target_table
        AND ic.column_name = 'deleted_at'
    ) INTO v_has_deleted_at;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = v_target_table
        AND ic.column_name = 'created_at'
    ) INTO v_has_created_at;

    v_where := 'TRUE';
    IF v_has_deleted_at THEN
      v_where := 't.deleted_at IS NULL';
    END IF;

    IF v_target_table = 'bt_export_history' AND v_has_created_at THEN
      v_where := v_where || ' AND t.created_at > now() - INTERVAL ''90 days''';
    END IF;

    EXECUTE format(
      'INSERT INTO backup.%I (_backup_id, _backed_up_at, %s)
       SELECT $1, now(), %s
       FROM public.%I t
       WHERE %s',
      v_snapshot_table,
      v_target_cols,
      v_select_cols,
      v_target_table,
      v_where
    )
    USING v_manifest_id;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;

    UPDATE backup.backup_manifest bm
    SET row_count = v_row_count,
        status = 'ok'
    WHERE bm.id = v_manifest_id;

    table_name := v_target_table;
    rows_backed_up := v_row_count;
    manifest_id := v_manifest_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.backup_critical_tables(TEXT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.backup_critical_tables(TEXT, INTERVAL) TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('029_fix_backup_function_ambiguity.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;

COMMIT;
