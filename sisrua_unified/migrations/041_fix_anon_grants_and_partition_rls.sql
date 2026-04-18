-- Migration: 041_fix_anon_grants_and_partition_rls.sql
-- Tech Lead Debug – 2026-04-17
--
-- PROBLEMAS ENCONTRADOS NA AUDITORIA:
--   1. role `anon` tem INSERT/UPDATE/DELETE em 66 tabelas (todas as partições)
--      Root cause: migration 034 (time_series_partitioning) criou tabelas novas
--      APÓS a migration 013 (revoke_excess_grants). O Supabase aplica GRANT ALL
--      automaticamente em toda tabela nova criada no schema public.
--
--   2. 57 tabelas particionadas-filho (child) com RLS=ON e zero policies:
--      comportamento deny-all para queries diretas. Semanticamente correto
--      (nenhum acesso direto às partições por anon/authenticated), mas o RLS
--      nas child tables é redundante e confuso — as policies vivem no parent.
--      Solução: DISABLE ROW LEVEL SECURITY nas child tables; manter apenas no
--      parent que já tem as policies corretas.
--
--   3. `_migrations` com RLS=ON e zero policies — deny-all acidental. Esta
--      tabela é gerenciada exclusivamente por service_role (bypassa RLS), mas
--      o RLS habilitado sem policy é ruído de auditoria.
--
-- AÇÕES:
--   A. Revogar TODOS os grants de anon/authenticated em todo schema public.
--   B. Re-conceder apenas o mínimo intencional.
--   C. Desabilitar RLS nas tabelas child de partições (proteção fica no parent).
--   D. Desabilitar RLS em _migrations (sem necessidade de policy).
--   E. Adicionar RLS policy em tabelas de conformidade que carecem dela.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. REVOKE ALL de anon e authenticated em todas as tabelas/views/sequences
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  obj RECORD;
BEGIN
  -- Tabelas (inclui partitions child e parent)
  FOR obj IN
    SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS fqname
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', obj.fqname);
  END LOOP;

  -- Views
  FOR obj IN
    SELECT quote_ident(schemaname) || '.' || quote_ident(viewname) AS fqname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', obj.fqname);
  END LOOP;

  -- Sequences
  FOR obj IN
    SELECT quote_ident(sequence_schema) || '.' || quote_ident(sequence_name) AS fqname
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM anon, authenticated', obj.fqname);
  END LOOP;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Re-conceder APENAS o mínimo intencional
--
-- Modelo de acesso pós-migration:
--   anon           → SELECT em jobs e constants_catalog
--                    (necessário para polling de status sem autenticação)
--   authenticated  → SELECT em jobs, constants_catalog, dxf_tasks, bt_export_history
--                    SELECT em views de compliance/LGPD (read-only dashboard)
--   service_role   → bypassa RLS, sem necessidade de GRANT explícito
-- ─────────────────────────────────────────────────────────────────────────────

-- Acesso anon mínimo
GRANT SELECT ON TABLE public.jobs TO anon;
GRANT SELECT ON TABLE public.constants_catalog TO anon;

-- Acesso authenticated
GRANT SELECT ON TABLE public.jobs TO authenticated;
GRANT SELECT ON TABLE public.dxf_tasks TO authenticated;
GRANT SELECT ON TABLE public.bt_export_history TO authenticated;
GRANT SELECT ON TABLE public.constants_catalog TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- Views de compliance (read-only, RLS no source protege os dados)
GRANT SELECT ON TABLE public.v_tenant_usage_summary TO authenticated;
GRANT SELECT ON TABLE public.v_user_roles_summary TO authenticated;
GRANT SELECT ON TABLE public.v_soft_deleted_summary TO authenticated;
GRANT SELECT ON TABLE public.v_lgpd_compliance_dashboard TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. DESABILITAR RLS nas tabelas child de partições
--
-- Justificativa: RLS policies nas child partition tables NÃO são herdadas do
-- parent. Queries de aplicação sempre passam pelo parent (ex: `jobs`,
-- `dxf_tasks`, `bt_export_history`, `audit_logs_partitioned`), que já têm
-- as políticas corretas. Manter RLS=ON nas children sem policies é um estado
-- deny-all silencioso e confuso em auditoria.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  child RECORD;
BEGIN
  -- Obter todas as child partition tables
  FOR child IN
    SELECT c.relname AS child_table
    FROM pg_inherits
    JOIN pg_class c ON pg_inherits.inhrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'  -- regular table (partition child)
      AND c.relrowsecurity = true
      -- Sem policies definidas diretamente nesta child table
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', child.child_table);
    RAISE NOTICE 'RLS desabilitado na child partition: %', child.child_table;
  END LOOP;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Desabilitar RLS em _migrations (tabela de controle interno)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public._migrations DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- E. RLS policies para tabelas LGPD/compliance sem policies
-- ─────────────────────────────────────────────────────────────────────────────

-- lgpd_consent_records: usuário só vê seus próprios registros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lgpd_consent_records'
      AND policyname = 'lgpd_consent_service_role_all'
  ) THEN
    CREATE POLICY lgpd_consent_service_role_all ON public.lgpd_consent_records
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lgpd_consent_records'
      AND policyname = 'lgpd_consent_owner_select'
  ) THEN
    CREATE POLICY lgpd_consent_owner_select ON public.lgpd_consent_records
      FOR SELECT USING (auth.role() = 'authenticated' AND user_id = auth.uid()::text);
  END IF;
END $$;

-- lgpd_rights_requests: usuário só vê suas próprias solicitações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lgpd_rights_requests'
      AND policyname = 'lgpd_rights_service_role_all'
  ) THEN
    CREATE POLICY lgpd_rights_service_role_all ON public.lgpd_rights_requests
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lgpd_rights_requests'
      AND policyname = 'lgpd_rights_owner_select'
  ) THEN
    CREATE POLICY lgpd_rights_owner_select ON public.lgpd_rights_requests
      FOR SELECT USING (auth.role() = 'authenticated' AND user_id = auth.uid()::text);
  END IF;
END $$;

-- lgpd_processing_activities: leitura pública autenticada, escrita só service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lgpd_processing_activities'
      AND policyname = 'lgpd_activities_authenticated_select'
  ) THEN
    CREATE POLICY lgpd_activities_authenticated_select ON public.lgpd_processing_activities
      FOR SELECT USING (auth.role() IN ('service_role', 'authenticated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lgpd_processing_activities'
      AND policyname = 'lgpd_activities_service_role_write'
  ) THEN
    CREATE POLICY lgpd_activities_service_role_write ON public.lgpd_processing_activities
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- lgpd_security_incidents: service_role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lgpd_security_incidents'
      AND policyname = 'lgpd_incidents_service_role_all'
  ) THEN
    CREATE POLICY lgpd_incidents_service_role_all ON public.lgpd_security_incidents
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- tenant_service_profiles: isolamento por tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_service_profiles'
      AND policyname = 'tenant_service_profiles_isolation'
  ) THEN
    CREATE POLICY tenant_service_profiles_isolation ON public.tenant_service_profiles
      USING (
        auth.role() = 'service_role'
        OR tenant_id = public.current_tenant_id()
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR tenant_id = public.current_tenant_id()
      );
  END IF;
END $$;

-- user_roles_audit: service_role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles_audit'
      AND policyname = 'user_roles_audit_service_role_all'
  ) THEN
    CREATE POLICY user_roles_audit_service_role_all ON public.user_roles_audit
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- F. Registrar migration
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public._migrations (filename)
VALUES ('041_fix_anon_grants_and_partition_rls.sql')
ON CONFLICT (filename) DO NOTHING;
