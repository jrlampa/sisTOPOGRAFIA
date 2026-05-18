-- Migration: 101_harden_user_tiers_grants.sql
-- 2026-05-13
--
-- Objetivo: Resolver achado de auditoria 'HIGH' (Grants excessivos).
-- Revogar todas as permissões de roles públicas (authenticated/anon) na tabela user_tiers e re-garantir apenas o necessário.

BEGIN;

-- Revogar TUDO de roles públicas primeiro
REVOKE ALL ON TABLE public.user_tiers FROM authenticated, anon, public;

-- Garantir apenas SELECT para usuários autenticados (protegido por RLS)
GRANT SELECT ON public.user_tiers TO authenticated;

-- Service role mantém tudo
GRANT ALL ON public.user_tiers TO service_role;

-- Registrar a migração (ON CONFLICT para permitir re-execução se necessário, 
-- embora o script de migração já controle isso, aqui garantimos idempotência manual no SQL se rodado avulso)
INSERT INTO public._migrations (filename)
VALUES ('101_harden_user_tiers_grants.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
