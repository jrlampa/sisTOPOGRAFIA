-- 071_projects_geospatial_governance.sql
-- Evolução geoespacial para projetos e jurisdições (Item C)

-- 1. Adicionar coluna de geometria para o limite do projeto (Jurisdição)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS boundary geometry(Polygon, 4326);

-- 2. Índice Espacial GIST para consultas de interseção e colisão
CREATE INDEX IF NOT EXISTS idx_projects_boundary ON public.projects USING GIST (boundary);

-- 3. Função para sincronizar boundary a partir do JSONB app_state (se houver polygon)
-- e calcular a área real em m² usando PostGIS (precisão esférica)
CREATE OR REPLACE FUNCTION public.fn_sync_project_boundary_and_area()
RETURNS TRIGGER AS $$
DECLARE
    points_json JSONB;
    coords_text TEXT := '';
    i INTEGER;
    num_points INTEGER;
BEGIN
    -- Tentar extrair o polígono do app_state (JSONB)
    points_json := NEW.app_state->'polygon';
    
    IF points_json IS NOT NULL AND jsonb_array_length(points_json) >= 3 THEN
        num_points := jsonb_array_length(points_json);
        -- Construir string WKT: POLYGON((lng1 lat1, lng2 lat2, ..., lng1 lat1))
        FOR i IN 0..num_points-1 LOOP
            coords_text := coords_text || (points_json->i->>'lng') || ' ' || (points_json->i->>'lat') || ',';
        END LOOP;
        -- Fechar o polígono com o primeiro ponto
        coords_text := coords_text || (points_json->0->>'lng') || ' ' || (points_json->0->>'lat');
        
        NEW.boundary := ST_GeomFromText('POLYGON((' || coords_text || '))', 4326);
        -- Calcular área real em m² usando a biblioteca geography (WGS84)
        NEW.area_m2 := ST_Area(NEW.boundary::geography);
    ELSE
        -- Se não houver polígono, tenta usar o raio (Circle)
        IF (NEW.app_state->'radius') IS NOT NULL AND (NEW.app_state->'center') IS NOT NULL THEN
           -- Aproximação de círculo via ST_Buffer (convertendo para metros e voltando)
           -- Nota: ST_Buffer em graus é impreciso, mas para visualização e área é aceitável se usarmos geography.
           NEW.boundary := ST_Buffer(
             ST_SetSRID(ST_MakePoint((NEW.app_state->'center'->>'lng')::numeric, (NEW.app_state->'center'->>'lat')::numeric), 4326)::geography,
             (NEW.app_state->'radius')::numeric
           )::geometry;
           NEW.area_m2 := ST_Area(NEW.boundary::geography);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger
DROP TRIGGER IF EXISTS trg_sync_project_geospatial ON public.projects;
CREATE TRIGGER trg_sync_project_geospatial
    BEFORE INSERT OR UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_project_boundary_and_area();

-- Comentários para documentação
COMMENT ON COLUMN public.projects.boundary IS 'Geometria PostGIS que define o perímetro legal da jurisdição do projeto.';
COMMENT ON FUNCTION public.fn_sync_project_boundary_and_area() IS 'Sincroniza automaticamente a geometria e calcula a área em m² a partir do estado do mapa.';
