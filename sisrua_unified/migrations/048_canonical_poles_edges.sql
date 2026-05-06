-- Migration: 048_canonical_poles_edges.sql
-- 2026-04-20
--
-- Objetivo: Criar tabelas canônicas do modelo Poste-Driven.
--
-- Estratégia:
--   1. canonical_poles  — Aggregate Root PoleNode (unifica BT + MT).
--   2. canonical_edges  — NetworkEdge canônica (unifica BtEdge + MtEdge).
--   3. Nenhuma tabela legada é alterada ou removida nesta fase.
--   4. Backfill (preenchimento dos dados legados) é feito em 050_canonical_backfill.sql.
--
-- Segurança:
--   - RLS habilitado por padrão (service_role bypassa automaticamente).
--   - Acesso de anon/authenticated negado até política explícita.
--   - Sem DEFAULT PRIVILEGES herdados (ver 047).
--
-- Idempotência: seguro executar N vezes (IF NOT EXISTS em tudo).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA canonical_poles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.canonical_poles (
  -- Identidade
  id            TEXT        NOT NULL,
  -- Localização geográfica
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  title         TEXT        NOT NULL DEFAULT '',
  -- Flags de tecnologia
  has_bt        BOOLEAN     NOT NULL DEFAULT FALSE,
  has_mt        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Estruturas físicas (JSONB para flexibilidade de campos si1..si4 / n1..n4)
  bt_structures JSONB,     -- { si1, si2, si3, si4 }
  mt_structures JSONB,     -- { n1, n2, n3, n4 }
  -- Dados elétricos BT
  ramais        JSONB,     -- CanonicalRamalEntry[]
  pole_spec     JSONB,     -- { heightM, nominalEffortDan }
  condition_status TEXT,  -- bom_estado | desaprumado | trincado | condenado
  -- Notas
  equipment_notes TEXT,
  general_notes   TEXT,
  -- Flags operacionais
  circuit_break_point BOOLEAN NOT NULL DEFAULT FALSE,
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  node_change_flag    TEXT,   -- existing | new | remove | replace
  -- Auditoria
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Rastreabilidade de origem (para backfill e dual-read)
  source        TEXT        NOT NULL DEFAULT 'canonical',  -- canonical | legacy_bt | legacy_mt | backfill
  -- Chave primária composta: id do polo é único dentro de uma sessão de projeto,
  -- mas pode ser reutilizado entre projetos diferentes. Usamos surrogate key.
  pk            BIGSERIAL   PRIMARY KEY
);

COMMENT ON TABLE public.canonical_poles IS
  'Tabela canônica de postes (Aggregate Root PoleNode). '
  'Unifica BtPoleNode e MtPoleNode. Fase B1 do Poste-Driven restart. '
  'NÃO substitui dados legados — coexiste durante migração.';

COMMENT ON COLUMN public.canonical_poles.id IS
  'ID lógico do poste (pole_id do grafo de rede). '
  'Não é único globalmente; use pk como chave surrogate no banco.';

COMMENT ON COLUMN public.canonical_poles.source IS
  'Origem do registro: canonical (criado diretamente), '
  'legacy_bt (backfill de BtPoleNode), legacy_mt (backfill de MtPoleNode), '
  'backfill (fusão de ambos).';

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_canonical_poles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonical_poles_updated_at ON public.canonical_poles;
CREATE TRIGGER trg_canonical_poles_updated_at
  BEFORE UPDATE ON public.canonical_poles
  FOR EACH ROW EXECUTE FUNCTION public.set_canonical_poles_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA canonical_edges
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.canonical_edges (
  -- Identidade
  id              TEXT        NOT NULL,
  -- Conectividade (IDs lógicos dos postes — não FKs para permitir projetos efêmeros)
  from_pole_id    TEXT        NOT NULL,
  to_pole_id      TEXT        NOT NULL,
  -- Geometria
  length_meters   DOUBLE PRECISION,
  cqt_length_meters DOUBLE PRECISION,  -- comprimento elétrico CQT (apenas BT)
  -- Condutores por tecnologia (JSONB para flexibilidade)
  bt_conductors              JSONB,  -- CanonicalConductorEntry[]
  mt_conductors              JSONB,  -- CanonicalConductorEntry[]
  bt_replacement_conductors  JSONB,  -- CanonicalConductorEntry[] (projeto BT)
  -- Flags operacionais
  remove_on_execution BOOLEAN NOT NULL DEFAULT FALSE,
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  edge_change_flag    TEXT,   -- existing | new | remove | replace
  -- Auditoria
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Rastreabilidade de origem
  source        TEXT        NOT NULL DEFAULT 'canonical',
  -- Chave primária surrogate
  pk            BIGSERIAL   PRIMARY KEY
);

COMMENT ON TABLE public.canonical_edges IS
  'Tabela canônica de arestas de rede (NetworkEdge). '
  'Unifica BtEdge e MtEdge. Fase B1 do Poste-Driven restart. '
  'from_pole_id/to_pole_id são IDs lógicos (não FKs) para suportar projetos efêmeros.';

COMMENT ON COLUMN public.canonical_edges.cqt_length_meters IS
  'Comprimento elétrico para cálculo CQT. Apenas BT. '
  'Pode diferir de length_meters por ajuste técnico do projetista.';

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_canonical_edges_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonical_edges_updated_at ON public.canonical_edges;
CREATE TRIGGER trg_canonical_edges_updated_at
  BEFORE UPDATE ON public.canonical_edges
  FOR EACH ROW EXECUTE FUNCTION public.set_canonical_edges_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.canonical_poles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_edges ENABLE ROW LEVEL SECURITY;

-- Denegar tudo para anon e authenticated (backend usa service_role que bypassa RLS)
DROP POLICY IF EXISTS canonical_poles_deny_anon ON public.canonical_poles;
CREATE POLICY canonical_poles_deny_anon ON public.canonical_poles
  FOR ALL
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS canonical_edges_deny_anon ON public.canonical_edges;
CREATE POLICY canonical_edges_deny_anon ON public.canonical_edges
  FOR ALL
  TO anon, authenticated
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GRANTS EXPLÍCITOS PARA service_role
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canonical_poles TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.canonical_poles_pk_seq  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canonical_edges TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.canonical_edges_pk_seq  TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registrar migration
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('048_canonical_poles_edges.sql')
ON CONFLICT (filename) DO NOTHING;
