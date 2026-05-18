-- Migration: 109_ensure_audit_partition_changed_by_indexes.sql
-- Date: 2026-05-17
-- Purpose: Ensure audit_logs partitions have (changed_by, tenant_id) indexes
--          to reduce sequential scans and FK-related lock overhead.

BEGIN;

-- Guarantee parent composite index exists for planner consistency.
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by_tenant
  ON public.audit_logs (changed_by, tenant_id);

DO $$
DECLARE
  part RECORD;
  created_count INTEGER := 0;
  idx_name TEXT;
BEGIN
  FOR part IN
    SELECT child_ns.nspname AS schema_name, child.relname AS table_name
    FROM pg_inherits inh
    JOIN pg_class parent ON parent.oid = inh.inhparent
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    JOIN pg_class child ON child.oid = inh.inhrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    WHERE parent_ns.nspname = 'public'
      AND parent.relname = 'audit_logs'
      AND child_ns.nspname = 'public'
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = part.schema_name
        AND c.table_name = part.table_name
        AND c.column_name = 'changed_by'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = part.schema_name
        AND c.table_name = part.table_name
        AND c.column_name = 'tenant_id'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
      WHERE tbl_ns.nspname = part.schema_name
        AND tbl.relname = part.table_name
        AND pg_get_indexdef(i.indexrelid) ILIKE '%(changed_by, tenant_id)%'
    ) THEN
      idx_name := format('idx_%s_changed_by_tenant', part.table_name);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I.%I (changed_by, tenant_id)',
        idx_name,
        part.schema_name,
        part.table_name
      );
      created_count := created_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    changed_by,
    changed_at,
    tenant_id
  ) VALUES (
    'PERFORMANCE_OPTIMIZATION',
    'pg_indexes',
    'migration-109:audit-partition-indexes',
    NULL,
    jsonb_build_object(
      'migration', '109_ensure_audit_partition_changed_by_indexes.sql',
      'created_indexes', created_count,
      'index_pattern', '(changed_by, tenant_id)',
      'target_parent', 'public.audit_logs'
    ),
    NULL,
    now(),
    '00000000-0000-0000-0000-000000000001'
  );
END
$$;

COMMIT;
