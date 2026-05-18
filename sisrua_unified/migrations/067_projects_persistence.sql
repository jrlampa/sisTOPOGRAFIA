-- 067_projects_persistence.sql
-- Tabela para persistência de projetos (Recortes Geográficos)

CREATE TYPE project_status AS ENUM ('draft', 'finalized', 'audited');

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    area_m2 NUMERIC DEFAULT 0,
    status project_status DEFAULT 'draft',
    app_state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY projects_tenant_isolation ON public.projects
    USING (tenant_id = (SELECT public.current_tenant_id()))
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

-- Trigger para updated_at
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_tenant_updated_at();

-- Índices
CREATE INDEX idx_projects_tenant ON public.projects(tenant_id);
CREATE INDEX idx_projects_status ON public.projects(status);
