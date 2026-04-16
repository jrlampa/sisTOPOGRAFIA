-- Migration: 039_harden_multi_tenant_rls.sql
-- Objetivo: reforçar isolamento multi-tenant com RLS explícito e policies faltantes.
-- Escopo: tenants, user_roles, bt_export_history, jobs, dxf_tasks.

-- 1) Garantir RLS habilitado nas tabelas de domínio multi-tenant.
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bt_export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dxf_tasks ENABLE ROW LEVEL SECURITY;

-- 2) Tenant isolation para bt_export_history.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bt_export_history'
      AND policyname = 'tenant_isolation_bt_export_history'
  ) THEN
    CREATE POLICY tenant_isolation_bt_export_history ON public.bt_export_history
      USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);
  END IF;
END $$;

-- 3) Acesso controlado à tabela de tenants.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenants_service_role_all'
  ) THEN
    CREATE POLICY tenants_service_role_all ON public.tenants
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenants_deny_anon'
  ) THEN
    CREATE POLICY tenants_deny_anon ON public.tenants
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

-- 4) user_roles restrito por tenant + service role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'tenant_isolation_user_roles'
  ) THEN
    CREATE POLICY tenant_isolation_user_roles ON public.user_roles
      USING (
        auth.role() = 'service_role'
        OR tenant_id = public.current_tenant_id()
        OR tenant_id IS NULL
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR tenant_id = public.current_tenant_id()
        OR tenant_id IS NULL
      );
  END IF;
END $$;

-- 5) Migration bookkeeping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('039_harden_multi_tenant_rls.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;
