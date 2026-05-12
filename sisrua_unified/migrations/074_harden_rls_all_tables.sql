-- Migration: 074_harden_rls_all_tables.sql
-- 2026-05-11
--
-- Objetivo: Garantir Defense-in-Depth ativando RLS em todas as tabelas de negócio
-- que porventura tenham ficado com RLS desabilitado em migrações anteriores.

BEGIN;

-- 1. Habilitar RLS em tabelas que podem ter sido criadas sem ele ou desabilitado
ALTER TABLE IF EXISTS public.bt_export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collaboration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_snapshots ENABLE ROW LEVEL SECURITY;

-- 2. Garantir que tabelas de configuração/catálogo também tenham RLS (mesmo que permitam leitura anônima/autenticada)
ALTER TABLE IF EXISTS public.constants_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.formula_versions ENABLE ROW LEVEL SECURITY;

-- 3. Caso existam políticas órfãs ou tabelas sem política definida, o Supabase/Postgres
-- por padrão nega todo acesso se RLS estiver ON e nenhuma política permitir.
-- Isso é o comportamento desejado para segurança máxima.

-- 4. Registrar migração
INSERT INTO public._migrations (filename)
VALUES ('074_harden_rls_all_tables.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
