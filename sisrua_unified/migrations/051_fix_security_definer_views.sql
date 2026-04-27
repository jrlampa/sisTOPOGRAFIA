-- Migration: Fix Security Definer Views (Remediation for Supabase Security Audit)
-- Date: 2026-04-26
-- Description: Recreates views with SECURITY INVOKER property to respect RLS policies.

BEGIN;

-- 1. Fix v_tenant_usage_summary
DROP VIEW IF EXISTS public.v_tenant_usage_summary CASCADE;
CREATE VIEW public.v_tenant_usage_summary 
WITH (security_invoker = true) AS
SELECT
  t.id          AS tenant_id,
  t.slug        AS tenant_slug,
  t.name        AS tenant_name,
  t.plan,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') AS completed_jobs,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'failed')    AS failed_jobs,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status IN ('queued', 'processing')) AS active_jobs,
  COUNT(DISTINCT beh.id) AS total_bt_exports,
  MAX(j.created_at)      AS last_activity_at
FROM public.tenants t
LEFT JOIN public.jobs j             ON j.tenant_id = t.id AND j.deleted_at IS NULL
LEFT JOIN public.bt_export_history beh ON beh.tenant_id = t.id AND beh.deleted_at IS NULL
GROUP BY t.id, t.slug, t.name, t.plan;

-- 2. Fix v_lgpd_retention_due
DROP VIEW IF EXISTS public.v_lgpd_retention_due CASCADE;
CREATE VIEW public.v_lgpd_retention_due 
WITH (security_invoker = true) AS
SELECT
    id,
    data_category,
    legal_basis,
    retention_period,
    deletion_policy,
    responsible_team,
    review_due_date,
    CASE
        WHEN review_due_date < CURRENT_DATE            THEN 'vencido'
        WHEN review_due_date < CURRENT_DATE + 30       THEN 'vence_em_30_dias'
        ELSE                                                'ok'
    END AS review_status,
    tenant_id,
    created_at,
    updated_at
FROM public.lgpd_data_lifecycle;

-- 3. Fix v_soft_deleted_summary
DROP VIEW IF EXISTS public.v_soft_deleted_summary CASCADE;
CREATE VIEW public.v_soft_deleted_summary 
WITH (security_invoker = true) AS
SELECT 'constants_catalog'           AS table_name, COUNT(*) AS deleted_count, MAX(deleted_at) AS last_deleted_at
FROM public.constants_catalog
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'jobs', COUNT(*), MAX(deleted_at)
FROM public.jobs
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'dxf_tasks', COUNT(*), MAX(deleted_at)
FROM public.dxf_tasks
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'bt_export_history', COUNT(*), MAX(deleted_at)
FROM public.bt_export_history
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'user_roles', COUNT(*), MAX(deleted_at)
FROM public.user_roles
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'constants_refresh_events', COUNT(*), MAX(deleted_at)
FROM public.constants_refresh_events
WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'constants_catalog_snapshots', COUNT(*), MAX(deleted_at)
FROM public.constants_catalog_snapshots
WHERE deleted_at IS NOT NULL;

-- 4. Fix v_user_roles_summary
DROP VIEW IF EXISTS public.v_user_roles_summary CASCADE;
CREATE VIEW public.v_user_roles_summary 
WITH (security_invoker = true) AS
SELECT 
    role,
    COUNT(*) as user_count,
    COUNT(DISTINCT assigned_by) as assigned_by_count,
    MIN(assigned_at) as earliest_assignment,
    MAX(last_updated) as latest_update
FROM public.user_roles
WHERE role <> 'guest'::user_role
GROUP BY role;

-- 5. Restore Grants (Explicitly SELECT only)
GRANT SELECT ON public.v_tenant_usage_summary TO authenticated, service_role;
GRANT SELECT ON public.v_lgpd_retention_due TO authenticated, service_role;
GRANT SELECT ON public.v_soft_deleted_summary TO authenticated, service_role;
GRANT SELECT ON public.v_user_roles_summary TO authenticated, service_role;

-- 6. Add Comments to track remediation
COMMENT ON VIEW public.v_tenant_usage_summary IS 'Remediated to Security Invoker for RLS compliance.';
COMMENT ON VIEW public.v_lgpd_retention_due IS 'Remediated to Security Invoker for RLS compliance.';
COMMENT ON VIEW public.v_soft_deleted_summary IS 'Remediated to Security Invoker for RLS compliance.';
COMMENT ON VIEW public.v_user_roles_summary IS 'Remediated to Security Invoker for RLS compliance.';

COMMIT;
