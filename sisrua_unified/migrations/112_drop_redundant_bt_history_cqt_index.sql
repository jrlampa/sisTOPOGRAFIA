-- Migration: 112_drop_redundant_bt_history_cqt_index.sql
-- Date: 2026-05-17
-- Purpose: Remove exact duplicate index on bt_export_history introduced during
--          optimization rollout to reduce write amplification and index bloat.

BEGIN;

-- Keep canonical index: idx_bt_export_history_cqt_created_at
-- Drop redundant duplicate created in migration 111.
DROP INDEX IF EXISTS public.idx_bt_export_history_cqt_scenario_created_at;

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
  'migration-112:drop-redundant-bt-index',
  jsonb_build_object(
    'dropped_index', 'idx_bt_export_history_cqt_scenario_created_at'
  ),
  jsonb_build_object(
    'migration', '112_drop_redundant_bt_history_cqt_index.sql',
    'kept_index', 'idx_bt_export_history_cqt_created_at',
    'reason', 'Exact duplicate index definition removed'
  ),
  NULL,
  now(),
  '00000000-0000-0000-0000-000000000001'
);

COMMIT;
