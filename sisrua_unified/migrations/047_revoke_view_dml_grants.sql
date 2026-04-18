-- Migration: 047_revoke_view_dml_grants.sql
-- 2026-04-18
--
-- Problema: as views criadas em 046 (v_audit_summary, v_constants_catalog_latest,
-- v_lgpd_retention_due) herdaram DML grants automáticos (INSERT/UPDATE/DELETE/TRUNCATE)
-- via DEFAULT PRIVILEGES legados no schema public. Esses grants são indevidos em views
-- somente-leitura.
--
-- Ações:
--   1. Revogar todos os grants DML nas 3 views.
--   2. Re-conceder somente SELECT onde adequado.
--   3. Alterar DEFAULT PRIVILEGES para que novas tabelas/views NÃO herdem DML para anon/authenticated.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REVOGAR DML EXCESSIVO NAS VIEWS CRIADAS EM 046
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON public.v_audit_summary          FROM anon, authenticated;
REVOKE ALL ON public.v_constants_catalog_latest FROM anon, authenticated;
REVOKE ALL ON public.v_lgpd_retention_due     FROM anon, authenticated;

-- Re-grant mínimo necessário
GRANT SELECT ON public.v_audit_summary          TO authenticated;
GRANT SELECT ON public.v_constants_catalog_latest TO authenticated;
GRANT SELECT ON public.v_constants_catalog_latest TO anon;
GRANT SELECT ON public.v_lgpd_retention_due     TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CORRIGIR DEFAULT PRIVILEGES — evitar herança automática de DML
--    para anon/authenticated em futuras views e tabelas.
-- ─────────────────────────────────────────────────────────────────────────────

-- Revogar default privileges DML para anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

-- Revogar default privileges DML para authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM authenticated;

-- Revogar default SELECT default privilege para anon (exceto onde explicitamente concedido)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT ON TABLES FROM anon;

-- Revogar default SELECT default privilege para authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT ON TABLES FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registrar migration
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public._migrations (filename)
VALUES ('047_revoke_view_dml_grants.sql')
ON CONFLICT (filename) DO NOTHING;
