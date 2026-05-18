-- Migration: 075_geospatial_validation_and_history_fk.sql
-- 2026-05-11
--
-- Objetivo: Resolver itens 7 e 8 da auditoria técnica.
--   7. Adicionar FK de projeto em export_history para melhor rastreabilidade.
--   8. Melhorar validação e logging na sincronização de geometria de projetos.

BEGIN;

-- 1. Adicionar project_id em bt_export_history
ALTER TABLE IF EXISTS public.bt_export_history 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bt_export_history_project_id ON public.bt_export_history(project_id);

-- 2. Melhorar função de sincronização de geometria com tratamento de erros (Item 8)
CREATE OR REPLACE FUNCTION public.fn_sync_project_boundary_and_area()
RETURNS TRIGGER AS $$
DECLARE
    points_json JSONB;
    coords_text TEXT := '';
    i INTEGER;
    num_points INTEGER;
BEGIN
    BEGIN
        -- Tentar extrair o polígono do app_state (JSONB)
        points_json := NEW.app_state->'polygon';
        
        IF points_json IS NOT NULL AND jsonb_array_length(points_json) >= 3 THEN
            num_points := jsonb_array_length(points_json);
            FOR i IN 0..num_points-1 LOOP
                coords_text := coords_text || (points_json->i->>'lng') || ' ' || (points_json->i->>'lat') || ',';
            END LOOP;
            coords_text := coords_text || (points_json->0->>'lng') || ' ' || (points_json->0->>'lat');
            
            NEW.boundary := ST_GeomFromText('POLYGON((' || coords_text || '))', 4326);
            NEW.area_m2 := ST_Area(NEW.boundary::geography);
        ELSE
            -- Se não houver polígono, tenta usar o raio (Circle)
            IF (NEW.app_state->'radius') IS NOT NULL AND (NEW.app_state->'center') IS NOT NULL THEN
               NEW.boundary := ST_Buffer(
                 ST_SetSRID(ST_MakePoint((NEW.app_state->'center'->>'lng')::numeric, (NEW.app_state->'center'->>'lat')::numeric), 4326)::geography,
                 (NEW.app_state->'radius')::numeric
               )::geometry;
               NEW.area_m2 := ST_Area(NEW.boundary::geography);
            ELSE
               -- Se não há dados geográficos, garantir que área e boundary fiquem limpos
               NEW.boundary := NULL;
               NEW.area_m2 := 0;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- LOG do erro para o PostgreSQL log sem abortar a transação principal (se desejado)
        -- Ou apenas garantir que area_m2 seja NULL para sinalizar erro
        RAISE WARNING 'Falha na validação geométrica para o projeto %: %', NEW.id, SQLERRM;
        NEW.boundary := NULL;
        NEW.area_m2 := NULL;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Registrar migração
INSERT INTO public._migrations (filename)
VALUES ('075_geospatial_validation_and_history_fk.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
