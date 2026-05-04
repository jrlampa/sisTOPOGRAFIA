-- Migration: 059_revoke_excess_grants_new_objects.sql
-- Purpose:
--   Correct privilege drift caused by default grants on newly created objects.
--   Revoke all anon/authenticated privileges from public schema objects,
--   then re-grant only the minimum explicitly intended read surface.

DO $$
DECLARE
  obj RECORD;
BEGIN
  -- Revoke from all base tables
  FOR obj IN
    SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS fqname
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', obj.fqname);
  END LOOP;

  -- Revoke from all views
  FOR obj IN
    SELECT quote_ident(schemaname) || '.' || quote_ident(viewname) AS fqname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', obj.fqname);
  END LOOP;

  -- Revoke from all sequences
  FOR obj IN
    SELECT quote_ident(sequence_schema) || '.' || quote_ident(sequence_name) AS fqname
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM anon, authenticated', obj.fqname);
  END LOOP;
END
$$;

-- Minimal public access model
GRANT SELECT ON TABLE public.jobs TO anon, authenticated;
GRANT SELECT ON TABLE public.constants_catalog TO anon, authenticated;

-- Authenticated operational read surface
GRANT SELECT ON TABLE public.dxf_tasks TO authenticated;
GRANT SELECT ON TABLE public.bt_export_history TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

GRANT SELECT ON TABLE public.v_tenant_usage_summary TO authenticated;
GRANT SELECT ON TABLE public.v_user_roles_summary TO authenticated;
GRANT SELECT ON TABLE public.v_soft_deleted_summary TO authenticated;
GRANT SELECT ON TABLE public.v_lgpd_compliance_dashboard TO authenticated;
GRANT SELECT ON TABLE public.v_audit_summary TO authenticated;
GRANT SELECT ON TABLE public.v_lgpd_retention_due TO authenticated;
GRANT SELECT ON TABLE public.v_constants_catalog_latest TO authenticated;

-- Keep constants catalog latest publicly readable
GRANT SELECT ON TABLE public.v_constants_catalog_latest TO anon;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('059_revoke_excess_grants_new_objects.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END
$$;
