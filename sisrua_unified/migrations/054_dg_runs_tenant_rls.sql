-- 054_dg_runs_tenant_rls.sql
-- Adiciona isolamento multi-tenant à camada DG.
--
-- Problema: dg_runs e tabelas relacionadas não possuíam tenant_id,
-- impossibilitando Row Level Security (RLS) por tenant.
--
-- Estratégia:
--   1. Adicionar coluna tenant_id (nullable inicialmente para compatibilidade).
--   2. Criar índice por tenant para queries filtradas.
--   3. Habilitar RLS e criar policy de isolamento usando current_tenant_id().
--   4. Aplicar o mesmo padrão às tabelas filhas (ON DELETE CASCADE já garante consistência).
--
-- Idempotência: seguro executar N vezes.

-- ─── 1. Adicionar tenant_id ───────────────────────────────────────────────────

ALTER TABLE public.dg_runs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.dg_candidates
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE public.dg_scenarios
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE public.dg_constraints
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

ALTER TABLE public.dg_recommendations
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- ─── 2. Índices por tenant ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dg_runs_tenant_id
  ON public.dg_runs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_dg_runs_tenant_computed
  ON public.dg_runs (tenant_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dg_candidates_tenant_id
  ON public.dg_candidates (tenant_id);

CREATE INDEX IF NOT EXISTS idx_dg_scenarios_tenant_id
  ON public.dg_scenarios (tenant_id);

-- ─── 3. RLS em dg_runs ───────────────────────────────────────────────────────

ALTER TABLE public.dg_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dg_runs_tenant_isolation ON public.dg_runs;
CREATE POLICY dg_runs_tenant_isolation
  ON public.dg_runs
  USING (
    tenant_id IS NULL   -- dados legados sem tenant ainda visíveis para manutenção
    OR tenant_id = public.current_tenant_id()
  );

-- ─── 4. RLS em dg_candidates ──────────────────────────────────────────────────

ALTER TABLE public.dg_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dg_candidates_tenant_isolation ON public.dg_candidates;
CREATE POLICY dg_candidates_tenant_isolation
  ON public.dg_candidates
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

-- ─── 5. RLS em dg_scenarios ───────────────────────────────────────────────────

ALTER TABLE public.dg_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dg_scenarios_tenant_isolation ON public.dg_scenarios;
CREATE POLICY dg_scenarios_tenant_isolation
  ON public.dg_scenarios
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

-- ─── 6. Views: recriar para incluir tenant_id ─────────────────────────────────

CREATE OR REPLACE VIEW dg_run_ranking_v AS
SELECT
  s.run_id,
  s.scenario_id,
  s.feasible,
  s.objective_score,
  ROW_NUMBER() OVER (
    PARTITION BY s.run_id
    ORDER BY s.feasible DESC, s.objective_score DESC
  ) AS rank_in_run,
  s.created_at,
  s.tenant_id
FROM dg_scenarios s;

CREATE OR REPLACE VIEW dg_discard_rate_by_constraint_v AS
WITH totals AS (
  SELECT run_id, tenant_id, COUNT(*)::NUMERIC AS total_scenarios
  FROM dg_scenarios
  GROUP BY run_id, tenant_id
)
SELECT
  c.run_id,
  c.code,
  COUNT(DISTINCT c.scenario_id) AS discarded_scenarios,
  t.total_scenarios,
  CASE
    WHEN t.total_scenarios = 0 THEN 0
    ELSE ROUND((COUNT(DISTINCT c.scenario_id)::NUMERIC / t.total_scenarios) * 100, 2)
  END AS discard_rate_percent,
  t.tenant_id
FROM dg_constraints c
JOIN totals t ON t.run_id = c.run_id
GROUP BY c.run_id, c.code, t.total_scenarios, t.tenant_id;

-- ─── Registrar migration ──────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('054_dg_runs_tenant_rls.sql')
ON CONFLICT (filename) DO NOTHING;
