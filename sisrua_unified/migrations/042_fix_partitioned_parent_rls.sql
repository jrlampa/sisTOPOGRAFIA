-- Migration: 042_fix_partitioned_parent_rls.sql
-- Tech Lead Debug – 2026-04-17
--
-- PROBLEMA: Tabelas partitioned parent (jobs_partitioned, dxf_tasks_partitioned,
-- bt_export_history_partitioned) têm RLS=ON mas zero policies → bloqueio total.
--
-- ANÁLISE:
--   - Estas tabelas NÃO possuem coluna tenant_id (design diferente das tabelas ativas).
--   - As tabelas ativas (jobs, dxf_tasks, bt_export_history) já têm RLS + policies corretos.
--   - Os grants para anon/authenticated já foram REVOGADOS em 041 nestas tabelas.
--   - Apenas service_role acessa estas tabelas (sem exposição a usuários finais).
--
-- DECISÃO: DISABLE ROW LEVEL SECURITY — seguro pois:
--   1. Sem grants para anon/authenticated (acesso efetivamente bloqueado).
--   2. Tabelas prospectivas, não são as tabelas de produção ativas.
--   3. Elimina o bloqueio deny-all causado por RLS=ON sem policies.

ALTER TABLE public.jobs_partitioned             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dxf_tasks_partitioned        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bt_export_history_partitioned DISABLE ROW LEVEL SECURITY;

-- ─── Registrar migration ─────────────────────────────────────────────────────
INSERT INTO public._migrations (filename)
VALUES ('042_fix_partitioned_parent_rls.sql')
ON CONFLICT (filename) DO NOTHING;
