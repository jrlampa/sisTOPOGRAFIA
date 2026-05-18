-- Migration: 111_optimize_bt_export_history_cqt_filters.sql
-- Date: 2026-05-17
-- Purpose: Optimize bt_export_history queries filtered by cqt_scenario,
--          with and without project_type, while preserving write cost.

BEGIN;

-- Query pattern covered:
-- WHERE cqt_scenario = $1
-- ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bt_export_history_cqt_scenario_created_at
  ON public.bt_export_history (cqt_scenario, created_at DESC)
  WHERE cqt_scenario IS NOT NULL;

-- Query pattern covered:
-- WHERE project_type = $1 AND cqt_scenario = $2
-- ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bt_export_history_project_cqt_created_at
  ON public.bt_export_history (project_type, cqt_scenario, created_at DESC)
  WHERE cqt_scenario IS NOT NULL;

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
  'migration-111:bt-export-cqt-filters',
  NULL,
  jsonb_build_object(
    'migration', '111_optimize_bt_export_history_cqt_filters.sql',
    'table', 'bt_export_history',
    'indexes_created', jsonb_build_array(
      'idx_bt_export_history_cqt_scenario_created_at',
      'idx_bt_export_history_project_cqt_created_at'
    ),
    'target_patterns', jsonb_build_array(
      'filter by cqt_scenario + order by created_at desc',
      'filter by project_type and cqt_scenario + order by created_at desc'
    )
  ),
  NULL,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
