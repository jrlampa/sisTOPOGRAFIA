-- Migration: 057_technical_hardening_audit_remediation.sql
-- 2026-05-02
--
-- Objetivo: Auditoria Corretiva e Hardening do Banco de Dados (Poste-Driven Phase).
--
-- Problemas Identificados (Senior Database Audit):
--   1. Tabelas canônicas (poles/edges) sem tenant_id (falha no isolamento RLS).
--   2. Falta de índices GIN em campos JSONB críticos (bt_structures, ramais).
--   3. Risco de órfãos topológicos (arestas sem postes correspondentes).
--   4. Necessidade de hardening de search_path em funções de infraestrutura.
--   5. Tabelas canônicas fora do sistema centralizado de auditoria/soft-delete.
--
-- Estratégia de Remediação:
--   - Alinhamento de multi-tenancy para tabelas canônicas.
--   - Otimização de performance para consultas BIM.
--   - Implementação de vista de integridade topológica.
--   - Ativação de triggers de auditoria e colunas de soft-delete.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MULTI-TENANCY: HARDENING DAS TABELAS CANÔNICAS
-- ─────────────────────────────────────────────────────────────────────────────

-- Adicionar tenant_id às tabelas canônicas (alinha com Roadmap #32)
ALTER TABLE public.canonical_poles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.canonical_edges
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT;

-- Backfill: assumir tenant padrão para dados existentes
UPDATE public.canonical_poles
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

UPDATE public.canonical_edges
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

-- Índices de suporte ao isolamento
CREATE INDEX IF NOT EXISTS idx_canonical_poles_tenant_id ON public.canonical_poles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_canonical_edges_tenant_id ON public.canonical_edges (tenant_id);

-- RLS: Substituir 'deny_anon' por 'tenant_isolation'
DROP POLICY IF EXISTS canonical_poles_deny_anon ON public.canonical_poles;
DROP POLICY IF EXISTS canonical_poles_tenant_isolation ON public.canonical_poles;
CREATE POLICY canonical_poles_tenant_isolation ON public.canonical_poles
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS canonical_edges_deny_anon ON public.canonical_edges;
DROP POLICY IF EXISTS canonical_edges_tenant_isolation ON public.canonical_edges;
CREATE POLICY canonical_edges_tenant_isolation ON public.canonical_edges
  USING (tenant_id = public.current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PERFORMANCE: ÍNDICES PROFUNDOS (BIM/JSONB)
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice GIN para busca rápida em chaves internas das estruturas BT (si1..si4)
CREATE INDEX IF NOT EXISTS idx_gin_canonical_poles_bt_structures
  ON public.canonical_poles USING GIN (bt_structures);

-- Índice GIN para busca em ramais de clientes
CREATE INDEX IF NOT EXISTS idx_gin_canonical_poles_ramais
  ON public.canonical_poles USING GIN (ramais);

-- Índice GIN para condutores canônicos
CREATE INDEX IF NOT EXISTS idx_gin_canonical_edges_bt_conductors
  ON public.canonical_edges USING GIN (bt_conductors);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AUDITORIA E SOFT-DELETE: ALINHAMENTO DE GOVERNANÇA
-- ─────────────────────────────────────────────────────────────────────────────

-- Adicionar colunas de soft-delete
ALTER TABLE public.canonical_poles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.canonical_edges ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índices parciais para performance em registros ativos
CREATE INDEX IF NOT EXISTS idx_canonical_poles_active 
  ON public.canonical_poles (tenant_id, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_edges_active 
  ON public.canonical_edges (tenant_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Triggers de Auditoria Genérica (ver 021)
DROP TRIGGER IF EXISTS trg_audit_canonical_poles ON public.canonical_poles;
CREATE TRIGGER trg_audit_canonical_poles
  AFTER INSERT OR UPDATE OR DELETE ON public.canonical_poles
  FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

DROP TRIGGER IF EXISTS trg_audit_canonical_edges ON public.canonical_edges;
CREATE TRIGGER trg_audit_canonical_edges
  AFTER INSERT OR UPDATE OR DELETE ON public.canonical_edges
  FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log_generic();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INTEGRIDADE: AUDITORIA TOPOLÓGICA (Orphan Detection)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_network_integrity_audit AS
SELECT
  e.pk           AS edge_pk,
  e.id           AS edge_id,
  e.tenant_id,
  e.from_pole_id,
  e.to_pole_id,
  CASE 
    WHEN p_from.pk IS NULL THEN 'ORPHAN_FROM'
    WHEN p_to.pk IS NULL THEN 'ORPHAN_TO'
    ELSE 'HEALTHY'
  END AS integrity_status,
  e.source
FROM public.canonical_edges e
LEFT JOIN public.canonical_poles p_from 
  ON p_from.id = e.from_pole_id AND p_from.tenant_id = e.tenant_id AND p_from.deleted_at IS NULL
LEFT JOIN public.canonical_poles p_to   
  ON p_to.id = e.to_pole_id AND p_to.tenant_id = e.tenant_id AND p_to.deleted_at IS NULL
WHERE e.deleted_at IS NULL;

COMMENT ON VIEW public.v_network_integrity_audit IS
  'Vista de auditoria para detectar arestas cujos postes lógicos não existem. '
  'Essencial pois canonical_edges usa TEXT IDs em vez de FKs para flexibilidade.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HARDENING: INFRAESTRUTURA DE SEGURANÇA
-- ─────────────────────────────────────────────────────────────────────────────

-- Garantir que a função de contexto não seja vulnerável a injeção de search_path
ALTER FUNCTION public.current_tenant_id() SET search_path = public, pg_temp;

-- Revogar permissões DML de views para anon/authenticated (garantia extra)
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON public.v_network_integrity_audit TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRO DA MIGRAÇÃO
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('057_technical_hardening_audit_remediation.sql')
ON CONFLICT (filename) DO NOTHING;
