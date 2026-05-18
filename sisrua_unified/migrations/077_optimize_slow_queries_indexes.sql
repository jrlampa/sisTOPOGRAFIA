-- Migration: 077_optimize_slow_queries_indexes.sql
-- Date: 2026-05-13
-- Issue: Medium priority - multiple queries identified as slow via pg_stat_statements
--
-- Optimization targets:
-- 1. Indexes on audit_logs for common filtering patterns
-- 2. Support for slow query analysis going forward
--
-- Strategy: Add selective indexes for audit log queries.

BEGIN;

-- 1. Add covering index on audit_logs for siem export queries
-- Helps filter and return events efficiently
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_changed_at 
  ON public.audit_logs (action, changed_at DESC);

-- 2. Add composite index for audit queries by user/tenant
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by_tenant
  ON public.audit_logs (changed_by, tenant_id);

-- 3. Add index for audit logs filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_table_date
  ON public.audit_logs (action, table_name, changed_at DESC);

-- 4. Document performance baseline for future optimization
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
  'migration-077:slow-query-indexes',
  jsonb_build_object(
    'slow_queries_identified', jsonb_build_array(
      'v_audit_siem_export',
      'backup_critical_tables',
      'db_health_report'
    ),
    'avg_response_time_ms', jsonb_build_object(
      'v_audit_siem_export', '1119.33',
      'backup_critical_tables', '353.18',
      'db_health_report', '173.20'
    )
  ),
  jsonb_build_object(
    'status', 'completed',
    'migration_file', '077_optimize_slow_queries_indexes.sql',
    'indexes_created', 3,
    'optimization_focus', 'audit_logs query performance'
  ),
  null,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
