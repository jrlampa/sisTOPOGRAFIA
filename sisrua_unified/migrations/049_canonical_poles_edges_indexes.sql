-- Migration: 049_canonical_poles_edges_indexes.sql
-- 2026-04-20
--
-- Objetivo: Adicionar índices e constraints às tabelas canônicas criadas em 048.
--
-- Estratégia de índices:
--   1. Lookup por id lógico do poste (path crítico do dual-read).
--   2. Lookup geográfico por lat/lng (queries de proximidade no mapa).
--   3. Filtro por has_bt / has_mt (camadas separadas no frontend).
--   4. Lookup de arestas por polo origem/destino (travessia do grafo).
--   5. Filtro por source (monitoramento de backfill).
--   6. Índice temporal por created_at (paginação e auditoria).
--
-- Constraints:
--   - condition_status restrito a valores válidos.
--   - node_change_flag restrito a valores válidos.
--   - edge_change_flag restrito a valores válidos.
--   - source restrito a valores válidos.
--
-- Idempotência: seguro executar N vezes (IF NOT EXISTS em índices;
--   constraints com DROP IF EXISTS antes do ADD).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ÍNDICES — canonical_poles
-- ─────────────────────────────────────────────────────────────────────────────

-- Lookup principal: por id lógico do poste
CREATE INDEX IF NOT EXISTS idx_canonical_poles_id
  ON public.canonical_poles (id);

-- Lookup geográfico: bounding-box lat/lng (suporte a queries de mapa)
CREATE INDEX IF NOT EXISTS idx_canonical_poles_lat_lng
  ON public.canonical_poles (lat, lng);

-- Filtro por tecnologia BT
CREATE INDEX IF NOT EXISTS idx_canonical_poles_has_bt
  ON public.canonical_poles (has_bt)
  WHERE has_bt = TRUE;

-- Filtro por tecnologia MT
CREATE INDEX IF NOT EXISTS idx_canonical_poles_has_mt
  ON public.canonical_poles (has_mt)
  WHERE has_mt = TRUE;

-- Filtro por source (monitoramento de backfill e dual-read)
CREATE INDEX IF NOT EXISTS idx_canonical_poles_source
  ON public.canonical_poles (source);

-- Índice temporal para auditoria e paginação
CREATE INDEX IF NOT EXISTS idx_canonical_poles_created_at
  ON public.canonical_poles (created_at DESC);

-- Índice composto: id lógico + source (path crítico do dual-read com discriminação de origem)
CREATE INDEX IF NOT EXISTS idx_canonical_poles_id_source
  ON public.canonical_poles (id, source);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ÍNDICES — canonical_edges
-- ─────────────────────────────────────────────────────────────────────────────

-- Lookup principal: por id lógico da aresta
CREATE INDEX IF NOT EXISTS idx_canonical_edges_id
  ON public.canonical_edges (id);

-- Travessia do grafo: por polo origem (adjacências saindo de um poste)
CREATE INDEX IF NOT EXISTS idx_canonical_edges_from_pole_id
  ON public.canonical_edges (from_pole_id);

-- Travessia do grafo: por polo destino (adjacências chegando em um poste)
CREATE INDEX IF NOT EXISTS idx_canonical_edges_to_pole_id
  ON public.canonical_edges (to_pole_id);

-- Índice composto: grafo bidirecional em query única
-- Suporta: WHERE from_pole_id = X OR to_pole_id = X (com UNION ou OR)
CREATE INDEX IF NOT EXISTS idx_canonical_edges_from_to
  ON public.canonical_edges (from_pole_id, to_pole_id);

-- Filtro por source
CREATE INDEX IF NOT EXISTS idx_canonical_edges_source
  ON public.canonical_edges (source);

-- Índice temporal para auditoria e paginação
CREATE INDEX IF NOT EXISTS idx_canonical_edges_created_at
  ON public.canonical_edges (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CONSTRAINTS DE DOMÍNIO — canonical_poles
-- ─────────────────────────────────────────────────────────────────────────────

-- condition_status: apenas valores válidos do domínio
ALTER TABLE public.canonical_poles
  DROP CONSTRAINT IF EXISTS chk_canonical_poles_condition_status;
ALTER TABLE public.canonical_poles
  ADD CONSTRAINT chk_canonical_poles_condition_status
  CHECK (
    condition_status IS NULL OR
    condition_status IN ('bom_estado', 'desaprumado', 'trincado', 'condenado')
  );

-- node_change_flag: apenas valores válidos do domínio
ALTER TABLE public.canonical_poles
  DROP CONSTRAINT IF EXISTS chk_canonical_poles_node_change_flag;
ALTER TABLE public.canonical_poles
  ADD CONSTRAINT chk_canonical_poles_node_change_flag
  CHECK (
    node_change_flag IS NULL OR
    node_change_flag IN ('existing', 'new', 'remove', 'replace')
  );

-- source: apenas valores válidos do domínio
ALTER TABLE public.canonical_poles
  DROP CONSTRAINT IF EXISTS chk_canonical_poles_source;
ALTER TABLE public.canonical_poles
  ADD CONSTRAINT chk_canonical_poles_source
  CHECK (source IN ('canonical', 'legacy_bt', 'legacy_mt', 'backfill'));

-- lat/lng: coordenadas válidas
ALTER TABLE public.canonical_poles
  DROP CONSTRAINT IF EXISTS chk_canonical_poles_lat;
ALTER TABLE public.canonical_poles
  ADD CONSTRAINT chk_canonical_poles_lat
  CHECK (lat BETWEEN -90.0 AND 90.0);

ALTER TABLE public.canonical_poles
  DROP CONSTRAINT IF EXISTS chk_canonical_poles_lng;
ALTER TABLE public.canonical_poles
  ADD CONSTRAINT chk_canonical_poles_lng
  CHECK (lng BETWEEN -180.0 AND 180.0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CONSTRAINTS DE DOMÍNIO — canonical_edges
-- ─────────────────────────────────────────────────────────────────────────────

-- edge_change_flag: apenas valores válidos do domínio
ALTER TABLE public.canonical_edges
  DROP CONSTRAINT IF EXISTS chk_canonical_edges_edge_change_flag;
ALTER TABLE public.canonical_edges
  ADD CONSTRAINT chk_canonical_edges_edge_change_flag
  CHECK (
    edge_change_flag IS NULL OR
    edge_change_flag IN ('existing', 'new', 'remove', 'replace')
  );

-- source: apenas valores válidos do domínio
ALTER TABLE public.canonical_edges
  DROP CONSTRAINT IF EXISTS chk_canonical_edges_source;
ALTER TABLE public.canonical_edges
  ADD CONSTRAINT chk_canonical_edges_source
  CHECK (source IN ('canonical', 'legacy_bt', 'legacy_mt', 'backfill'));

-- length_meters: não negativo
ALTER TABLE public.canonical_edges
  DROP CONSTRAINT IF EXISTS chk_canonical_edges_length_meters;
ALTER TABLE public.canonical_edges
  ADD CONSTRAINT chk_canonical_edges_length_meters
  CHECK (length_meters IS NULL OR length_meters >= 0.0);

-- cqt_length_meters: não negativo
ALTER TABLE public.canonical_edges
  DROP CONSTRAINT IF EXISTS chk_canonical_edges_cqt_length_meters;
ALTER TABLE public.canonical_edges
  ADD CONSTRAINT chk_canonical_edges_cqt_length_meters
  CHECK (cqt_length_meters IS NULL OR cqt_length_meters >= 0.0);

-- Self-loop: fromPoleId ≠ toPoleId (aresta não pode ligar o poste a si mesmo)
ALTER TABLE public.canonical_edges
  DROP CONSTRAINT IF EXISTS chk_canonical_edges_no_self_loop;
ALTER TABLE public.canonical_edges
  ADD CONSTRAINT chk_canonical_edges_no_self_loop
  CHECK (from_pole_id <> to_pole_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Registrar migration
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('049_canonical_poles_edges_indexes.sql')
ON CONFLICT (filename) DO NOTHING;
