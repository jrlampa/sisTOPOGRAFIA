-- Migration: 062_advanced_perf_rls_hardening.sql
-- 2026-05-05
--
-- Objetivo: Aplicar Supabase Postgres Best Practices para performance e segurança.
--
-- Estratégias aplicadas:
--   1. RLS Hardening (security-rls-performance):
--      Envelopar chamadas de funções (auth.uid(), current_tenant_id()) em subqueries
--      (SELECT ...) para permitir o caching do resultado pelo Postgres durante o scan.
--
--   2. Índices Compostos Multi-Tenant (query-composite-indexes):
--      Substituir índices de coluna única por índices compostos (tenant_id, column)
--      para suportar o isolamento RLS e o filtro de query em uma única operação.
--
--   3. Otimização de Sort (ORDER BY created_at DESC):
--      Adicionar índices BTREE em colunas temporais onde BRIN falha em prover sorted scans.
--
--   4. Suporte a Auditoria Topológica:
--      Índice composto em canonical_poles para acelerar joins na v_network_integrity_audit.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HARDENING DE RLS (Subqueries para Caching)
-- ─────────────────────────────────────────────────────────────────────────────

-- jobs
DROP POLICY IF EXISTS tenant_isolation_jobs ON public.jobs;
CREATE POLICY tenant_isolation_jobs ON public.jobs
  USING (tenant_id = (SELECT public.current_tenant_id()) OR tenant_id IS NULL);

-- dxf_tasks
DROP POLICY IF EXISTS tenant_isolation_dxf_tasks ON public.dxf_tasks;
CREATE POLICY tenant_isolation_dxf_tasks ON public.dxf_tasks
  USING (tenant_id = (SELECT public.current_tenant_id()) OR tenant_id IS NULL);

-- bt_export_history
DROP POLICY IF EXISTS tenant_isolation_bt_export_history ON public.bt_export_history;
CREATE POLICY tenant_isolation_bt_export_history ON public.bt_export_history
  USING (tenant_id = (SELECT public.current_tenant_id()) OR tenant_id IS NULL);

-- canonical_poles
DROP POLICY IF EXISTS canonical_poles_tenant_isolation ON public.canonical_poles;
CREATE POLICY canonical_poles_tenant_isolation ON public.canonical_poles
  USING (tenant_id = (SELECT public.current_tenant_id()));

-- canonical_edges
DROP POLICY IF EXISTS canonical_edges_tenant_isolation ON public.canonical_edges;
CREATE POLICY canonical_edges_tenant_isolation ON public.canonical_edges
  USING (tenant_id = (SELECT public.current_tenant_id()));

-- audit_logs
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON public.audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON public.audit_logs
  USING (tenant_id = (SELECT public.current_tenant_id()) OR auth.role() = 'service_role');

-- audit_logs_partitioned
DROP POLICY IF EXISTS tenant_isolation_audit_logs_partitioned ON public.audit_logs_partitioned;
CREATE POLICY tenant_isolation_audit_logs_partitioned ON public.audit_logs_partitioned
  USING (tenant_id = (SELECT public.current_tenant_id()) OR auth.role() = 'service_role');

-- user_roles
DROP POLICY IF EXISTS tenant_isolation_user_roles ON public.user_roles;
CREATE POLICY tenant_isolation_user_roles ON public.user_roles
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (SELECT public.current_tenant_id())
    OR tenant_id IS NULL
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ÍNDICES COMPOSTOS E OTIMIZAÇÃO DE SORT (BTREE)
-- ─────────────────────────────────────────────────────────────────────────────

-- jobs: suporte a findRecent (tenant + sort)
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_created_at_btree
  ON public.jobs (tenant_id, created_at DESC);

-- bt_export_history: suporte a listagem e dashboards
CREATE INDEX IF NOT EXISTS idx_bt_export_history_tenant_created_at_btree
  ON public.bt_export_history (tenant_id, created_at DESC);

-- dxf_tasks: suporte a lookup por tenant e data
CREATE INDEX IF NOT EXISTS idx_dxf_tasks_tenant_created_at_btree
  ON public.dxf_tasks (tenant_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SUPORTE À TOPOLOGIA CANÔNICA
-- ─────────────────────────────────────────────────────────────────────────────

-- canonical_poles: lookup por id lógico dentro do tenant (JOIN path crítico)
CREATE INDEX IF NOT EXISTS idx_canonical_poles_tenant_id_logical
  ON public.canonical_poles (tenant_id, id);

-- canonical_edges: lookup de conectividade dentro do tenant
CREATE INDEX IF NOT EXISTS idx_canonical_edges_tenant_from_to
  ON public.canonical_edges (tenant_id, from_pole_id, to_pole_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CLEANUP DE ÍNDICES REDUNDANTES
-- ─────────────────────────────────────────────────────────────────────────────

-- Remover índices de coluna única que agora são prefixos de índices compostos
-- (Postgres pode usar o prefixo do índice composto para filtros na primeira coluna)
DROP INDEX IF EXISTS public.idx_jobs_tenant_id;
DROP INDEX IF EXISTS public.idx_dxf_tasks_tenant_id;
DROP INDEX IF EXISTS public.idx_bt_export_history_tenant_id;
DROP INDEX IF EXISTS public.idx_canonical_poles_tenant_id;
DROP INDEX IF EXISTS public.idx_canonical_edges_tenant_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRO DA MIGRAÇÃO
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('062_advanced_perf_rls_hardening.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
