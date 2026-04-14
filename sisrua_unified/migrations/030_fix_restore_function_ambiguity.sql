-- Migration: 030_fix_restore_function_ambiguity.sql
-- Purpose: Fix ambiguous output-variable references in private.restore_table_from_backup().

BEGIN;

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
    SELECT b.manifest_id
    INTO v_pre_restore_manifest_id
    FROM private.backup_critical_tables('pre_restore', INTERVAL '7 days') b
    WHERE b.table_name = p_table_name
    LIMIT 1;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns ic
    WHERE ic.table_schema = 'public'
      AND ic.table_name = p_table_name
      AND ic.column_name = 'deleted_at'
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

  UPDATE backup.restore_operations ro
  SET pre_restore_manifest_id = v_pre_restore_manifest_id,
      restored_rows = v_restored,
      soft_deleted_rows = v_soft_deleted,
      finished_at = now(),
      status = 'ok'
  WHERE ro.id = v_restore_id;

  table_name := p_table_name;
  source_manifest_id := p_manifest_id;
  pre_restore_manifest_id := v_pre_restore_manifest_id;
  restored_rows := v_restored;
  soft_deleted_rows := v_soft_deleted;
  finished_at := now();
  RETURN NEXT;

EXCEPTION WHEN OTHERS THEN
  UPDATE backup.restore_operations ro
  SET finished_at = now(),
      status = 'failed',
      error_message = SQLERRM
  WHERE ro.id = v_restore_id;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION private.restore_table_from_backup(TEXT, UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.restore_table_from_backup(TEXT, UUID, TEXT, BOOLEAN, BOOLEAN) TO postgres, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('030_fix_restore_function_ambiguity.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;

COMMIT;
