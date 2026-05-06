-- Migration: Fix Remaining Security Definer Views
-- Date: 2026-04-26
-- Description: Remediation for critical security advisor alerts. Recreates views as SECURITY INVOKER.

BEGIN;

-- 1. Fix v_audit_summary
DROP VIEW IF EXISTS public.v_audit_summary CASCADE;
CREATE VIEW public.v_audit_summary 
WITH (security_invoker = true) AS
SELECT
    DATE_TRUNC('day', changed_at)::DATE AS audit_date,
    table_name,
    action,
    COUNT(*)                            AS event_count,
    COUNT(DISTINCT changed_by)          AS unique_actors
FROM public.audit_logs
GROUP BY 1, 2, 3;

-- 2. Fix v_constants_catalog_latest
DROP VIEW IF EXISTS public.v_constants_catalog_latest CASCADE;
CREATE VIEW public.v_constants_catalog_latest 
WITH (security_invoker = true) AS
SELECT DISTINCT ON (environment, key)
    id,
    environment,
    namespace,
    key,
    value,
    description,
    version_hash,
    is_active,
    created_at,
    updated_at
FROM public.constants_catalog
WHERE deleted_at IS NULL
  AND is_active = TRUE
ORDER BY environment, key, updated_at DESC;

-- 3. Fix v_lgpd_compliance_dashboard
DROP VIEW IF EXISTS public.v_lgpd_compliance_dashboard CASCADE;
CREATE VIEW public.v_lgpd_compliance_dashboard 
WITH (security_invoker = true) AS
SELECT
  'rights_requests_overdue'            AS metric,
  COUNT(*)::TEXT                       AS value,
  'Solicitações de direitos vencidas'  AS description
FROM public.lgpd_rights_requests
WHERE deadline_at < now()
  AND status NOT IN ('fulfilled', 'rejected')
UNION ALL
SELECT
  'incidents_pending_anpd_notification',
  COUNT(*)::TEXT,
  'Incidentes críticos aguardando notificação ANPD (>72h)'
FROM public.lgpd_security_incidents
WHERE anpd_notified_at IS NULL
  AND severity IN ('high', 'critical')
  AND detected_at < (now() - INTERVAL '72 hours')
UNION ALL
SELECT
  'active_consent_activities',
  COUNT(DISTINCT activity_name)::TEXT,
  'Atividades de tratamento com base legal cadastrada'
FROM public.lgpd_processing_activities
WHERE is_active = TRUE;

-- Restore Grants
GRANT SELECT ON public.v_audit_summary TO authenticated, service_role;
GRANT SELECT ON public.v_constants_catalog_latest TO authenticated, anon, service_role;
GRANT SELECT ON public.v_lgpd_compliance_dashboard TO authenticated, service_role;

-- Comments
COMMENT ON VIEW public.v_audit_summary IS 'Remediated to Security Invoker for RLS compliance.';
COMMENT ON VIEW public.v_constants_catalog_latest IS 'Remediated to Security Invoker for RLS compliance.';
COMMENT ON VIEW public.v_lgpd_compliance_dashboard IS 'Remediated to Security Invoker for RLS compliance.';

COMMIT;
