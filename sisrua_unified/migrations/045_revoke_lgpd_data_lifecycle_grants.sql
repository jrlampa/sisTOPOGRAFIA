-- Migration: 045_revoke_lgpd_data_lifecycle_grants.sql
-- Tech Lead Debug – 2026-04-17
--
-- Supabase auto-concede ALL PRIVILEGES para anon/authenticated em cada nova
-- tabela criada no schema public. A tabela lgpd_data_lifecycle (migration 043)
-- recebeu esses grants automaticamente. Este fix revoga os DML desnecessários.
--
-- Política: lgpd_data_lifecycle é gerenciado apenas via service_role.
-- authenticated recebe somente SELECT (já coberto pelo RLS com policy).

REVOKE ALL ON public.lgpd_data_lifecycle FROM anon;
REVOKE ALL ON public.lgpd_data_lifecycle FROM authenticated;

-- Re-grant somente SELECT para authenticated (RLS policy filtra por tenant_id)
GRANT SELECT ON public.lgpd_data_lifecycle TO authenticated;

-- ─── Registrar migration ─────────────────────────────────────────────────────
INSERT INTO public._migrations (filename)
VALUES ('045_revoke_lgpd_data_lifecycle_grants.sql')
ON CONFLICT (filename) DO NOTHING;
