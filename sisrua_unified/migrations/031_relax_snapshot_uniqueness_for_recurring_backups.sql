-- Migration: 031_relax_snapshot_uniqueness_for_recurring_backups.sql
-- Purpose:
--   Allow recurring logical backups in backup.*_snapshot tables by removing
--   inherited PK/UNIQUE constraints and unique indexes from LIKE INCLUDING ALL.

BEGIN;

DO $$
DECLARE
  v_table TEXT;
  v_constraint RECORD;
  v_index RECORD;
BEGIN
  FOR v_table IN
    SELECT unnest(ARRAY[
      'constants_catalog_snapshot',
      'user_roles_snapshot',
      'bt_export_history_snapshot'
    ])
  LOOP
    -- Drop PK/UNIQUE constraints copied from source tables.
    FOR v_constraint IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE n.nspname = 'backup'
        AND r.relname = v_table
        AND c.contype IN ('p', 'u')
    LOOP
      EXECUTE format('ALTER TABLE backup.%I DROP CONSTRAINT IF EXISTS %I', v_table, v_constraint.conname);
    END LOOP;

    -- Drop remaining unique indexes (defense in depth).
    FOR v_index IN
      SELECT idx.indexname
      FROM pg_indexes idx
      JOIN pg_class i ON i.relname = idx.indexname
      JOIN pg_namespace ns ON ns.oid = i.relnamespace
      JOIN pg_index pi ON pi.indexrelid = i.oid
      WHERE idx.schemaname = 'backup'
        AND idx.tablename = v_table
        AND pi.indisunique = true
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS backup.%I', v_index.indexname);
    END LOOP;
  END LOOP;
END
$$;

-- Recreate non-unique access indexes by backup id (idempotent names).
CREATE INDEX IF NOT EXISTS idx_bkp_constants_catalog_backup_id
  ON backup.constants_catalog_snapshot (_backup_id);

CREATE INDEX IF NOT EXISTS idx_bkp_user_roles_backup_id
  ON backup.user_roles_snapshot (_backup_id);

CREATE INDEX IF NOT EXISTS idx_bkp_bt_history_backup_id
  ON backup.bt_export_history_snapshot (_backup_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('031_relax_snapshot_uniqueness_for_recurring_backups.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;

COMMIT;
