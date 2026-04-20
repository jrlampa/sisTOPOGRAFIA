-- Migration: 051_canonical_consistency_view.sql
-- 2026-04-20
--
-- Objetivo: Criar view e função de validação de consistência entre dados
-- legados (dxf_tasks) e tabelas canônicas (canonical_poles/canonical_edges).
--
-- Artefatos:
--   1. VIEW public.v_canonical_consistency_report — contagens de legado vs canônico.
--   2. FUNCTION public.fn_validate_canonical_consistency() — retorna TRUE se
--      as contagens estão consistentes, FALSE (com NOTICE) se houver divergência.
--
-- Uso (após aplicar migrações 048–050):
--   SELECT * FROM public.v_canonical_consistency_report;
--   SELECT public.fn_validate_canonical_consistency();

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VIEW de relatório de consistência
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_canonical_consistency_report AS
WITH

-- Contagem de postes BT únicos nos payloads legados
legacy_bt_poles AS (
  SELECT COUNT(DISTINCT pole->>'id') AS cnt
  FROM public.dxf_tasks dt,
       jsonb_array_elements(dt.payload->'btContext'->'topology'->'poles') AS pole
  WHERE jsonb_typeof(dt.payload->'btContext'->'topology'->'poles') = 'array'
    AND pole->>'id' IS NOT NULL
),

-- Contagem de postes MT únicos nos payloads legados
legacy_mt_poles AS (
  SELECT COUNT(DISTINCT pole->>'id') AS cnt
  FROM public.dxf_tasks dt,
       jsonb_array_elements(dt.payload->'mtContext'->'topology'->'poles') AS pole
  WHERE jsonb_typeof(dt.payload->'mtContext'->'topology'->'poles') = 'array'
    AND pole->>'id' IS NOT NULL
),

-- Contagem de arestas BT únicas nos payloads legados
legacy_bt_edges AS (
  SELECT COUNT(DISTINCT edge->>'id') AS cnt
  FROM public.dxf_tasks dt,
       jsonb_array_elements(dt.payload->'btContext'->'topology'->'edges') AS edge
  WHERE jsonb_typeof(dt.payload->'btContext'->'topology'->'edges') = 'array'
    AND edge->>'id' IS NOT NULL
),

-- Contagem de arestas MT únicas nos payloads legados
legacy_mt_edges AS (
  SELECT COUNT(DISTINCT edge->>'id') AS cnt
  FROM public.dxf_tasks dt,
       jsonb_array_elements(dt.payload->'mtContext'->'topology'->'edges') AS edge
  WHERE jsonb_typeof(dt.payload->'mtContext'->'topology'->'edges') = 'array'
    AND edge->>'id' IS NOT NULL
),

-- Contagens nas tabelas canônicas por source
canonical_counts AS (
  SELECT
    COUNT(*) FILTER (WHERE source = 'legacy_bt') AS canonical_bt_poles,
    COUNT(*) FILTER (WHERE source = 'legacy_mt') AS canonical_mt_poles,
    COUNT(*) FILTER (WHERE source = 'backfill')  AS canonical_merged_poles,
    COUNT(*) FILTER (WHERE source = 'canonical') AS canonical_new_poles
  FROM public.canonical_poles
),
canonical_edge_counts AS (
  SELECT
    COUNT(*) FILTER (WHERE source = 'legacy_bt') AS canonical_bt_edges,
    COUNT(*) FILTER (WHERE source = 'legacy_mt') AS canonical_mt_edges,
    COUNT(*) FILTER (WHERE source = 'canonical') AS canonical_new_edges
  FROM public.canonical_edges
)

SELECT
  -- Legado
  (SELECT cnt FROM legacy_bt_poles)   AS legacy_bt_poles_unique,
  (SELECT cnt FROM legacy_mt_poles)   AS legacy_mt_poles_unique,
  (SELECT cnt FROM legacy_bt_edges)   AS legacy_bt_edges_unique,
  (SELECT cnt FROM legacy_mt_edges)   AS legacy_mt_edges_unique,
  -- Canônico
  c.canonical_bt_poles,
  c.canonical_mt_poles,
  c.canonical_merged_poles,
  c.canonical_new_poles,
  ce.canonical_bt_edges,
  ce.canonical_mt_edges,
  ce.canonical_new_edges,
  -- Deltas (positivo = falta no canônico; negativo = excesso no canônico)
  (SELECT cnt FROM legacy_bt_poles) - c.canonical_bt_poles  AS delta_bt_poles,
  (SELECT cnt FROM legacy_mt_poles) - c.canonical_mt_poles  AS delta_mt_poles,
  (SELECT cnt FROM legacy_bt_edges) - ce.canonical_bt_edges AS delta_bt_edges,
  (SELECT cnt FROM legacy_mt_edges) - ce.canonical_mt_edges AS delta_mt_edges,
  -- Timestamp do relatório
  now() AS report_at
FROM canonical_counts c, canonical_edge_counts ce;

COMMENT ON VIEW public.v_canonical_consistency_report IS
  'Relatório de consistência entre payloads legados (dxf_tasks) e tabelas canônicas. '
  'Delta > 0 indica postes/arestas presentes no legado mas ausentes no canônico. '
  'Delta = 0 indica consistência completa para o source correspondente.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNÇÃO de validação — retorna TRUE se consistente
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_validate_canonical_consistency()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  r              RECORD;
  is_consistent  BOOLEAN := TRUE;
BEGIN
  SELECT * INTO r FROM public.v_canonical_consistency_report;

  IF r.delta_bt_poles <> 0 THEN
    RAISE NOTICE 'INCONSISTÊNCIA: % postes BT do legado ausentes no canônico (delta=%)',
      ABS(r.delta_bt_poles), r.delta_bt_poles;
    is_consistent := FALSE;
  END IF;

  IF r.delta_mt_poles <> 0 THEN
    RAISE NOTICE 'INCONSISTÊNCIA: % postes MT do legado ausentes no canônico (delta=%)',
      ABS(r.delta_mt_poles), r.delta_mt_poles;
    is_consistent := FALSE;
  END IF;

  IF r.delta_bt_edges <> 0 THEN
    RAISE NOTICE 'INCONSISTÊNCIA: % arestas BT do legado ausentes no canônico (delta=%)',
      ABS(r.delta_bt_edges), r.delta_bt_edges;
    is_consistent := FALSE;
  END IF;

  IF r.delta_mt_edges <> 0 THEN
    RAISE NOTICE 'INCONSISTÊNCIA: % arestas MT do legado ausentes no canônico (delta=%)',
      ABS(r.delta_mt_edges), r.delta_mt_edges;
    is_consistent := FALSE;
  END IF;

  IF is_consistent THEN
    RAISE NOTICE 'CONSISTÊNCIA OK: canônico alinhado com legado '
      '(BT poles=%, MT poles=%, BT edges=%, MT edges=%)',
      r.legacy_bt_poles_unique, r.legacy_mt_poles_unique,
      r.legacy_bt_edges_unique, r.legacy_mt_edges_unique;
  END IF;

  RETURN is_consistent;
END;
$$;

COMMENT ON FUNCTION public.fn_validate_canonical_consistency() IS
  'Valida alinhamento entre payloads legados e tabelas canônicas. '
  'Retorna TRUE se todos os deltas são zero. '
  'Emite NOTICE para cada divergência encontrada.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.v_canonical_consistency_report TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_validate_canonical_consistency() TO service_role;

-- Bloquear acesso de anon/authenticated à view (contém metadados de jobs)
REVOKE ALL ON public.v_canonical_consistency_report FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Executar validação imediatamente após o backfill (050)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  ok BOOLEAN;
BEGIN
  ok := public.fn_validate_canonical_consistency();
  IF NOT ok THEN
    RAISE WARNING '051: Consistência canônica incompleta. Execute fn_backfill_canonical_* novamente.';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registrar migration
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('051_canonical_consistency_view.sql')
ON CONFLICT (filename) DO NOTHING;
