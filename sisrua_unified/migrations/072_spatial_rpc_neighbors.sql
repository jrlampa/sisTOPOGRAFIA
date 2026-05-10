-- 072_spatial_rpc_neighbors.sql
-- Adição de RPC PostGIS para busca eficiente de vizinhos

-- 1. Função RPC para buscar projetos vizinhos por bounding box
-- Isso substitui o filtro no cliente por uma consulta espacial indexada (GIST)
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
        p.is_archived = false
        AND (exclude_id IS NULL OR p.id != exclude_id)
        AND p.boundary && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION public.get_neighboring_projects FROM public;
GRANT EXECUTE ON FUNCTION public.get_neighboring_projects TO authenticated;

COMMENT ON FUNCTION public.get_neighboring_projects IS 'Busca projetos ativos em uma janela geográfica usando índices PostGIS GIST.';
