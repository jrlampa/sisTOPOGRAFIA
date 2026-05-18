-- Migration: 073_advanced_perf_rls_governance.sql
-- 2026-05-11
--
-- Objetivo: Aplicar Supabase Postgres Best Practices (Tier 3.1)
--
-- Melhorias:
--   1. RLS Caching: Substituir subqueries por (SELECT public.current_tenant_id()) em novas tabelas.
--   2. FK Indexing: Indexar colunas de chave estrangeira em tabelas de colaboração e projetos.
--   3. Composite Indexing: Otimizar listagem de projetos (tenant + archived + sort).
--   4. RPC Hardening: Aplicar isolamento de tenant na busca de vizinhos espaciais.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HARDENING DE RLS (Subqueries para Caching & Padronização)
-- ─────────────────────────────────────────────────────────────────────────────

-- projects
DROP POLICY IF EXISTS projects_tenant_isolation ON public.projects;
CREATE POLICY projects_tenant_isolation ON public.projects
    USING (tenant_id = (SELECT public.current_tenant_id()));

-- collaboration_sessions
DROP POLICY IF EXISTS tenant_isolation_sessions ON public.collaboration_sessions;
CREATE POLICY tenant_isolation_sessions ON public.collaboration_sessions
    USING (tenant_id = (SELECT public.current_tenant_id()));

-- collaboration_history
DROP POLICY IF EXISTS tenant_isolation_history ON public.collaboration_history;
CREATE POLICY tenant_isolation_history ON public.collaboration_history
    USING (sessao_id IN (
        SELECT id FROM public.collaboration_sessions 
        WHERE tenant_id = (SELECT public.current_tenant_id())
    ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ÍNDICES DE CHAVE ESTRANGEIRA (FK Indexing)
-- ─────────────────────────────────────────────────────────────────────────────

-- collaboration_sessions
CREATE INDEX IF NOT EXISTS idx_coll_sessions_tenant_id ON public.collaboration_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coll_sessions_responsavel_id ON public.collaboration_sessions(responsavel_id);

-- collaboration_history
CREATE INDEX IF NOT EXISTS idx_coll_history_usuario_id ON public.collaboration_history(usuario_id);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÍNDICE COMPOSTO DE ALTA PERFORMANCE (Multi-Tenant Listing)
-- ─────────────────────────────────────────────────────────────────────────────

-- Otimiza a query principal da ProjectPage: filter by tenant, filter by archived, sort by created_at
CREATE INDEX IF NOT EXISTS idx_projects_tenant_archived_created
  ON public.projects (tenant_id, is_archived, created_at DESC);

-- Cleanup de índices de coluna única agora redundantes
DROP INDEX IF EXISTS public.idx_projects_tenant;
DROP INDEX IF EXISTS public.idx_projects_archived;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC HARDENING (Isolamento de Tenant)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_neighboring_projects(
    min_lat numeric, 
    max_lat numeric, 
    min_lng numeric, 
    max_lng numeric,
    exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    boundary_json jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, 
        p.name, 
        ST_AsGeoJSON(p.boundary)::jsonb as boundary_json
    FROM 
        public.projects p
    WHERE 
        p.tenant_id = (SELECT public.current_tenant_id()) -- Hardened
        AND p.is_archived = false
        AND (exclude_id IS NULL OR p.id != exclude_id)
        AND p.boundary && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRO DA MIGRAÇÃO
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('073_advanced_perf_rls_governance.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
