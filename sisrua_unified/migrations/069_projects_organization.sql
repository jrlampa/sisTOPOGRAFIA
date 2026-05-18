-- 069_projects_organization.sql
-- Evolução para organização e ciclo de vida de projetos (Item B)

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Geral',
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON public.projects(is_archived);

-- Comentário para documentação
COMMENT ON COLUMN public.projects.category IS 'Categoria ou pasta para organização lógica de projetos (ex: Regional Norte, 2026, Vistoria).';
COMMENT ON COLUMN public.projects.is_archived IS 'Flag para ocultar projetos concluídos ou legados sem deletar os dados.';
