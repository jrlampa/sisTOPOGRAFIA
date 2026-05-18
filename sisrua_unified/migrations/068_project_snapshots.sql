-- 068_project_snapshots.sql
-- Tabela para congelar versões de projetos (Snapshots)

CREATE TABLE IF NOT EXISTS public.project_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    app_state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY snapshots_tenant_isolation ON public.project_snapshots
    USING (project_id IN (SELECT id FROM projects));

-- Índices
CREATE INDEX idx_snapshots_project ON public.project_snapshots(project_id);
