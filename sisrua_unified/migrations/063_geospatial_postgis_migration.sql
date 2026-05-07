-- Migration: 063_geospatial_postgis_migration.sql
-- 2026-05-05
--
-- Objetivo: Migração para PostGIS e Indexação Espacial Nativa.
--
-- Estratégia:
--   1. Habilitar extensão PostGIS (nativa no Supabase).
--   2. Adicionar coluna geometry(Point, 4326) em canonical_poles.
--   3. Backfill de geometria a partir das colunas lat/lng existentes.
--   4. Implementar índice GIST para consultas de proximidade e bounding-box.
--   5. Garantir sincronização automática via trigger.

BEGIN;

-- 1. Habilitar PostGIS se disponível (Supabase costuma ter no schema 'extensions')
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- 2. Adicionar coluna de geometria em canonical_poles
ALTER TABLE public.canonical_poles 
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- 3. Backfill: converter lat/lng para Point
-- Nota: ST_MakePoint(longitude, latitude)
UPDATE public.canonical_poles
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

-- 4. Índice Espacial GIST
CREATE INDEX IF NOT EXISTS idx_canonical_poles_geom 
  ON public.canonical_poles USING GIST (geom);

-- 5. Trigger para Sincronização Automática
-- Garante que se lat ou lng forem alterados via API legada ou manual, geom acompanhe.
CREATE OR REPLACE FUNCTION public.fn_sync_canonical_poles_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.lat IS DISTINCT FROM OLD.lat OR NEW.lng IS DISTINCT FROM OLD.lng OR NEW.geom IS NULL) THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_canonical_poles_geom ON public.canonical_poles;
CREATE TRIGGER trg_sync_canonical_poles_geom
  BEFORE INSERT OR UPDATE ON public.canonical_poles
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_canonical_poles_geom();

-- 6. Adicionar suporte a bt_export_history (opcional, mas recomendado para heatmaps)
ALTER TABLE public.bt_export_history 
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Backfill bt_export_history via join com canonical_poles
-- Tenta associar o ponto crítico do export ao geom do polo canônico correspondente
UPDATE public.bt_export_history h
SET geom = p.geom
FROM public.canonical_poles p
WHERE h.critical_pole_id = p.id 
  AND h.tenant_id = p.tenant_id
  AND h.geom IS NULL
  AND p.geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bt_export_history_geom 
  ON public.bt_export_history USING GIST (geom);

-- 7. Registrar migração
INSERT INTO public._migrations (filename)
VALUES ('063_geospatial_postgis_migration.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
