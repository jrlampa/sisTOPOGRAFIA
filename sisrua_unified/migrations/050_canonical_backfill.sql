-- Migration: 050_canonical_backfill.sql
-- 2026-04-20
--
-- Objetivo: Backfill idempotente dos dados BT/MT legados para as tabelas canônicas.
--
-- Fonte dos dados legados:
--   dxf_tasks.payload->'btContext'->'topology' → BtTopology (poles, edges, transformers)
--   dxf_tasks.payload->'mtContext'->'topology' → MtTopology (poles, edges)
--
-- Estratégia:
--   1. Extrair postes BT únicos (por id) de todos os jobs históricos.
--   2. Extrair postes MT únicos (por id) de todos os jobs históricos.
--   3. Inserir em canonical_poles com source='legacy_bt' / 'legacy_mt' / 'backfill'
--      (backfill quando o mesmo id existe em ambos BT e MT).
--   4. Extrair arestas BT e MT e inserir em canonical_edges.
--   5. Tudo via INSERT … ON CONFLICT DO NOTHING → 100% idempotente.
--
-- Nota: payload.btContext.topology pode ser null se o job não tinha topologia BT.
-- A função JSONB skippa silenciosamente esses casos.

-- ─────────────────────────────────────────────────────────────────────────────
-- Função auxiliar: backfill de postes BT legados
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_backfill_canonical_poles_bt()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  -- Extrai todos os postes BT de dxf_tasks que ainda não estão em canonical_poles
  -- com source='legacy_bt'. Usa DISTINCT ON para pegar apenas o registo mais recente
  -- de cada id de poste (caso o mesmo poste apareça em múltiplos jobs).
  WITH bt_poles_raw AS (
    SELECT DISTINCT ON (pole->>'id')
      pole->>'id'                                    AS pole_id,
      (pole->>'lat')::double precision               AS lat,
      (pole->>'lng')::double precision               AS lng,
      COALESCE(pole->>'title', '')                   AS title,
      pole->'btStructures'                           AS bt_structures,
      pole->'ramais'                                 AS ramails,
      pole->'poleSpec'                               AS pole_spec,
      pole->>'conditionStatus'                       AS condition_status,
      pole->>'equipmentNotes'                        AS equipment_notes,
      pole->>'generalNotes'                          AS general_notes,
      COALESCE((pole->>'circuitBreakPoint')::boolean, false) AS circuit_break_point,
      COALESCE((pole->>'verified')::boolean, false)  AS verified,
      pole->>'nodeChangeFlag'                        AS node_change_flag,
      dt.created_at                                  AS job_created_at
    FROM public.dxf_tasks dt,
         jsonb_array_elements(
           dt.payload->'btContext'->'topology'->'poles'
         ) AS pole
    WHERE dt.payload->'btContext'->'topology'->'poles' IS NOT NULL
      AND jsonb_typeof(dt.payload->'btContext'->'topology'->'poles') = 'array'
      AND pole->>'id' IS NOT NULL
      AND (pole->>'lat')::double precision BETWEEN -90.0 AND 90.0
      AND (pole->>'lng')::double precision BETWEEN -180.0 AND 180.0
    ORDER BY pole->>'id', dt.created_at DESC
  )
  INSERT INTO public.canonical_poles (
    id, lat, lng, title,
    has_bt, has_mt,
    bt_structures, mt_structures,
    ramais, pole_spec,
    condition_status,
    equipment_notes, general_notes,
    circuit_break_point, verified, node_change_flag,
    source
  )
  SELECT
    pole_id, lat, lng, title,
    TRUE,   -- has_bt
    FALSE,  -- has_mt (somente BT neste passo)
    bt_structures, NULL,
    ramails, pole_spec,
    CASE
      WHEN condition_status IN ('bom_estado','desaprumado','trincado','condenado')
        THEN condition_status
      ELSE NULL
    END,
    equipment_notes, general_notes,
    circuit_break_point, verified,
    CASE
      WHEN node_change_flag IN ('existing','new','remove','replace')
        THEN node_change_flag
      ELSE NULL
    END,
    'legacy_bt'
  FROM bt_poles_raw
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Função auxiliar: backfill de postes MT legados
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_backfill_canonical_poles_mt()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  WITH mt_poles_raw AS (
    SELECT DISTINCT ON (pole->>'id')
      pole->>'id'                                    AS pole_id,
      (pole->>'lat')::double precision               AS lat,
      (pole->>'lng')::double precision               AS lng,
      COALESCE(pole->>'title', '')                   AS title,
      pole->'mtStructures'                           AS mt_structures,
      COALESCE((pole->>'verified')::boolean, false)  AS verified,
      pole->>'nodeChangeFlag'                        AS node_change_flag,
      dt.created_at                                  AS job_created_at
    FROM public.dxf_tasks dt,
         jsonb_array_elements(
           dt.payload->'mtContext'->'topology'->'poles'
         ) AS pole
    WHERE dt.payload->'mtContext'->'topology'->'poles' IS NOT NULL
      AND jsonb_typeof(dt.payload->'mtContext'->'topology'->'poles') = 'array'
      AND pole->>'id' IS NOT NULL
      AND (pole->>'lat')::double precision BETWEEN -90.0 AND 90.0
      AND (pole->>'lng')::double precision BETWEEN -180.0 AND 180.0
    ORDER BY pole->>'id', dt.created_at DESC
  )
  INSERT INTO public.canonical_poles (
    id, lat, lng, title,
    has_bt, has_mt,
    bt_structures, mt_structures,
    ramais, pole_spec,
    condition_status,
    equipment_notes, general_notes,
    circuit_break_point, verified, node_change_flag,
    source
  )
  SELECT
    pole_id, lat, lng, title,
    FALSE,  -- has_bt
    TRUE,   -- has_mt
    NULL, mt_structures,
    NULL, NULL,
    NULL,
    NULL, NULL,
    FALSE, verified,
    CASE
      WHEN node_change_flag IN ('existing','new','remove','replace')
        THEN node_change_flag
      ELSE NULL
    END,
    'legacy_mt'
  FROM mt_poles_raw
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Função auxiliar: backfill de arestas BT legadas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_backfill_canonical_edges_bt()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  WITH bt_edges_raw AS (
    SELECT DISTINCT ON (edge->>'id')
      edge->>'id'                                     AS edge_id,
      edge->>'fromPoleId'                             AS from_pole_id,
      edge->>'toPoleId'                               AS to_pole_id,
      (edge->>'lengthMeters')::double precision       AS length_meters,
      edge->'conductors'                              AS bt_conductors,
      COALESCE((edge->>'verified')::boolean, false)   AS verified,
      edge->>'edgeChangeFlag'                         AS edge_change_flag,
      dt.created_at
    FROM public.dxf_tasks dt,
         jsonb_array_elements(
           dt.payload->'btContext'->'topology'->'edges'
         ) AS edge
    WHERE dt.payload->'btContext'->'topology'->'edges' IS NOT NULL
      AND jsonb_typeof(dt.payload->'btContext'->'topology'->'edges') = 'array'
      AND edge->>'id' IS NOT NULL
      AND edge->>'fromPoleId' IS NOT NULL
      AND edge->>'toPoleId' IS NOT NULL
      AND edge->>'fromPoleId' <> edge->>'toPoleId'
    ORDER BY edge->>'id', dt.created_at DESC
  )
  INSERT INTO public.canonical_edges (
    id, from_pole_id, to_pole_id,
    length_meters,
    bt_conductors, mt_conductors,
    verified, edge_change_flag,
    source
  )
  SELECT
    edge_id, from_pole_id, to_pole_id,
    CASE WHEN length_meters >= 0 THEN length_meters ELSE NULL END,
    bt_conductors, NULL,
    verified,
    CASE
      WHEN edge_change_flag IN ('existing','new','remove','replace')
        THEN edge_change_flag
      ELSE NULL
    END,
    'legacy_bt'
  FROM bt_edges_raw
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Função auxiliar: backfill de arestas MT legadas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_backfill_canonical_edges_mt()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  WITH mt_edges_raw AS (
    SELECT DISTINCT ON (edge->>'id')
      edge->>'id'                                     AS edge_id,
      edge->>'fromPoleId'                             AS from_pole_id,
      edge->>'toPoleId'                               AS to_pole_id,
      (edge->>'lengthMeters')::double precision       AS length_meters,
      COALESCE((edge->>'verified')::boolean, false)   AS verified,
      edge->>'edgeChangeFlag'                         AS edge_change_flag,
      dt.created_at
    FROM public.dxf_tasks dt,
         jsonb_array_elements(
           dt.payload->'mtContext'->'topology'->'edges'
         ) AS edge
    WHERE dt.payload->'mtContext'->'topology'->'edges' IS NOT NULL
      AND jsonb_typeof(dt.payload->'mtContext'->'topology'->'edges') = 'array'
      AND edge->>'id' IS NOT NULL
      AND edge->>'fromPoleId' IS NOT NULL
      AND edge->>'toPoleId' IS NOT NULL
      AND edge->>'fromPoleId' <> edge->>'toPoleId'
    ORDER BY edge->>'id', dt.created_at DESC
  )
  INSERT INTO public.canonical_edges (
    id, from_pole_id, to_pole_id,
    length_meters,
    bt_conductors, mt_conductors,
    verified, edge_change_flag,
    source
  )
  SELECT
    edge_id, from_pole_id, to_pole_id,
    CASE WHEN length_meters >= 0 THEN length_meters ELSE NULL END,
    NULL, NULL,   -- MT edges no legado não têm condutores detalhados
    verified,
    CASE
      WHEN edge_change_flag IN ('existing','new','remove','replace')
        THEN edge_change_flag
      ELSE NULL
    END,
    'legacy_mt'
  FROM mt_edges_raw
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Executar o backfill imediatamente ao aplicar esta migration
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  n_bt_poles  INTEGER;
  n_mt_poles  INTEGER;
  n_bt_edges  INTEGER;
  n_mt_edges  INTEGER;
BEGIN
  n_bt_poles := public.fn_backfill_canonical_poles_bt();
  n_mt_poles := public.fn_backfill_canonical_poles_mt();
  n_bt_edges := public.fn_backfill_canonical_edges_bt();
  n_mt_edges := public.fn_backfill_canonical_edges_mt();

  RAISE NOTICE 'Backfill canônico: % postes BT, % postes MT, % arestas BT, % arestas MT',
    n_bt_poles, n_mt_poles, n_bt_edges, n_mt_edges;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants para service_role poder chamar as funções de backfill
-- ─────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fn_backfill_canonical_poles_bt() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_backfill_canonical_poles_mt() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_backfill_canonical_edges_bt() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_backfill_canonical_edges_mt() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registrar migration
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('050_canonical_backfill.sql')
ON CONFLICT (filename) DO NOTHING;
