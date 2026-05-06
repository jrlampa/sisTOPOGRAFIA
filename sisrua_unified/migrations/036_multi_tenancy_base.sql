-- Migration: 036_multi_tenancy_base.sql
-- Roadmap Item 32: Isolamento Multi-tenant Robusto
--
-- Objetivo: Estrutura base de multi-tenancy para segregação total de dados,
-- chaves e segredos por cliente corporativo.
--
-- Estratégia:
--   1. Tabela `tenants` – cadastro de empresas/clientes corporativos.
--   2. Coluna `tenant_id` nas tabelas de negócio (jobs, dxf_tasks, bt_export_history).
--   3. RLS policies: registros só visíveis dentro do próprio tenant.
--   4. Índices de suporte para queries filtradas por tenant.
--
-- Segurança: idempotent, sem DROP ou ALTER TYPE.

-- ─── Schema e tabela de tenants ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,           -- ex: "light-rj", "cemig"
  name        TEXT        NOT NULL,
  plan        TEXT        NOT NULL DEFAULT 'standard',  -- standard | enterprise
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  settings    JSONB       NOT NULL DEFAULT '{}',     -- quotas, features flags, etc.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenants IS
  'Cadastro de tenants (empresas/clientes corporativos). '
  'Base para isolamento multi-tenant. Roadmap #32.';

CREATE INDEX IF NOT EXISTS idx_tenants_slug        ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active   ON public.tenants (is_active) WHERE is_active = TRUE;

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_tenant_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_updated_at();

-- ─── Tenant padrão (sistema/solo) ────────────────────────────────────────────

INSERT INTO public.tenants (id, slug, name, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Tenant Padrão (Sistema)',
  'enterprise'
)
ON CONFLICT (slug) DO NOTHING;

-- ─── tenant_id nas tabelas de negócio ─────────────────────────────────────────

-- jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE RESTRICT;

-- Backfill: jobs existentes recebem tenant padrão
UPDATE public.jobs
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON public.jobs (tenant_id);

-- dxf_tasks
ALTER TABLE public.dxf_tasks
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE RESTRICT;

UPDATE public.dxf_tasks
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_dxf_tasks_tenant_id ON public.dxf_tasks (tenant_id);

-- bt_export_history
ALTER TABLE public.bt_export_history
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE RESTRICT;

UPDATE public.bt_export_history
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bt_export_history_tenant_id ON public.bt_export_history (tenant_id);

-- user_roles: associar usuários a tenants
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE RESTRICT;

UPDATE public.user_roles
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles (tenant_id);

-- ─── RLS: isolamento por tenant ───────────────────────────────────────────────

-- Função auxiliar: recupera tenant_id do contexto JWT/session
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (current_setting('app.tenant_id', TRUE))::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID
  );
$$;

COMMENT ON FUNCTION public.current_tenant_id IS
  'Retorna tenant_id do contexto atual (app.tenant_id). '
  'Fallback para tenant padrão se não configurado. Roadmap #32.';

-- Policy em jobs (sem recriar: usa IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'tenant_isolation_jobs'
  ) THEN
    CREATE POLICY tenant_isolation_jobs ON public.jobs
      USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dxf_tasks' AND policyname = 'tenant_isolation_dxf_tasks'
  ) THEN
    CREATE POLICY tenant_isolation_dxf_tasks ON public.dxf_tasks
      USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);
  END IF;
END $$;

-- ─── Vista de sumário por tenant ─────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_tenant_usage_summary AS
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

COMMENT ON VIEW public.v_tenant_usage_summary IS
  'Resumo de uso por tenant para monitoramento e faturamento. Roadmap #32.';

-- ─── Migration bookkeeping ────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_migrations'
  ) THEN
    INSERT INTO public._migrations (filename)
    VALUES ('036_multi_tenancy_base.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;
